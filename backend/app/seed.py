import uuid
from datetime import datetime, timedelta
import random
from sqlalchemy.orm import Session
from app.db import (
    engine,
    Base,
    Contractor,
    WeighbridgeLog,
    GPSLog,
    GPSTrip,
    RoadRepair,
    Vehicle,
    DumpingGroundGateLog,
    init_db,
    CitizenComplaint,
    GarbageHotspot,
    GarbageReport,
    DustbinRequest,
)
from app.anomaly import run_anomaly_detection, calculate_benchmarks
from app.blockchain import lock_weighbridge_record, lock_road_repair_record

# GPS bounds for Nagpur routes
# Bhandewadi dumping ground: 21.1408, 79.1622
# Dharampeth (West Nagpur): 21.1426, 79.0559
# Sadar (Central Nagpur): 21.1611, 79.0805
# Civil Lines (Admin hub): 21.1517, 79.0734

def generate_route_coordinates(start_lat, start_lon, end_lat, end_lon, steps=15):
    """Generates coordinate sequence between two points."""
    coords = []
    for i in range(steps):
        t = i / (steps - 1)
        lat = start_lat + t * (end_lat - start_lat) + random.uniform(-0.001, 0.001)
        lon = start_lon + t * (end_lon - start_lon) + random.uniform(-0.001, 0.001)
        coords.append((lat, lon))
    return coords

def seed_data(db: Session):
    # Clear existing data
    db.query(CitizenComplaint).delete()
    db.query(GarbageReport).delete()
    db.query(GarbageHotspot).delete()
    db.query(DustbinRequest).delete()
    db.query(RoadRepair).delete()
    db.query(GPSTrip).delete()
    db.query(GPSLog).delete()
    db.query(WeighbridgeLog).delete()
    db.query(Contractor).delete()
    db.query(Vehicle).delete()
    db.query(DumpingGroundGateLog).delete()
    db.commit()

    print("Seeding vehicle fleet capacities...")
    # Distinct vehicle fleet across realistic Indian municipal waste-truck capacity classes:
    # 7,000 kg (7 MT Dumper Placer / Light Compactor), 10,000 kg (10 MT Standard Dual-Axle Compactor),
    # 14,000 kg (14 MT Heavy Tipper Compactor), 16,000 kg (16 MT Heavy Multi-Axle Hauler).
    vehicles = [
        Vehicle(truck_id="MH-31-EQ-4520", rated_capacity_kg=14000),  # Heavy 14 MT Tipper Compactor (Antony Waste)
        Vehicle(truck_id="MH-31-EQ-4521", rated_capacity_kg=10000),  # Standard 10 MT Compactor (Antony Waste)
        Vehicle(truck_id="MH-31-EQ-4522", rated_capacity_kg=7000),   # Medium 7 MT Dumper Placer (Antony Waste)
        Vehicle(truck_id="MH-49-AT-8812", rated_capacity_kg=10000),  # Standard 10 MT Compactor (BVG India)
        Vehicle(truck_id="MH-49-AT-8813", rated_capacity_kg=16000),  # Heavy 16 MT Multi-Axle Hauler (BVG India)
        Vehicle(truck_id="MH-49-AT-8814", rated_capacity_kg=7000),   # Medium 7 MT Dumper Placer (BVG India)
    ]
    db.add_all(vehicles)
    db.commit()

    print("Seeding contractors...")
    antony = Contractor(id="antony-waste", name="Antony Waste Handling Ltd", type="waste", total_claims_inr=42500000.00)
    bvg = Contractor(id="bvg-india", name="BVG India Ltd", type="waste", total_claims_inr=38900000.00)
    amrut = Contractor(id="amrut-repairs", name="Amrut Yojana Road Builders", type="road", total_claims_inr=15000000.00)
    db.add_all([antony, bvg, amrut])
    db.commit()

    print("Seeding weighbridge logs, GPS trips, and independent gate logs...")
    
    # Daily tonnage aggregates for April to July 2026 showing the drop
    start_date = datetime(2026, 4, 1)
    end_date = datetime(2026, 7, 31)
    
    current_date = start_date
    truck_pool = [
        ("MH-31-EQ-4520", "antony-waste"),
        ("MH-31-EQ-4521", "antony-waste"),
        ("MH-31-EQ-4522", "antony-waste"),
        ("MH-49-AT-8812", "bvg-india"),
        ("MH-49-AT-8813", "bvg-india"),
        ("MH-49-AT-8814", "bvg-india"),
    ]
    
    ticket_counter = 1000
    trip_counter = 5000
    
    # Vehicle capacity lookup dictionary for realistic baseline generation
    vehicle_caps = {v.truck_id: v.rated_capacity_kg for v in vehicles}

    # 1. Seeding regular logs (showing high tonnage in April/May, then drop in June/July)
    # For every regular log where passed_dumping_ground is True, seed a matching physical DumpingGroundGateLog entry.
    for i in range(30):
        log_date = start_date + timedelta(days=random.randint(0, 120))
        # Ensure random regular logs do not collide with specific exhibit test cases (July 10-11, June 15-16)
        while (log_date.month == 7 and log_date.day in [10, 11]) or (log_date.month == 6 and log_date.day in [15, 16]):
            log_date = start_date + timedelta(days=random.randint(0, 120))
        
        # Determine weight scale based on month to simulate the actual drop
        month_scale = 1.0
        if log_date.month == 4: # April
            month_scale = 1.15
        elif log_date.month == 5: # May
            month_scale = 1.05
        elif log_date.month == 6: # June
            month_scale = 0.92
        elif log_date.month == 7: # July
            month_scale = 0.82
            
        truck_id, contractor_id = random.choice(truck_pool)
        cap = float(vehicle_caps.get(truck_id, 10000))
        
        # Load weight scaled to that truck's specific rated capacity (approx 85% to 110% of rated capacity)
        weight = random.uniform(cap * 0.85, cap * 1.10) * month_scale
        
        ticket_id = f"WB-2026-{ticket_counter}"
        ticket_counter += 1
        
        timestamp = log_date.replace(hour=random.randint(8, 18), minute=random.randint(0, 59))
        
        # Determine if it's verified or under_review
        status = "verified"
        flag_reason = None
        
        zones = ["Laxmi Nagar", "Dharampeth", "Hanuman Nagar", "Dhantoli", "Nehru Nagar", "Gandhi Baugh", "Sataranjipura", "Lakadganj", "Ashi Nagar", "Mangalwari"]
        log_zone = random.choice(zones)
        
        # Lock on-chain dynamically to get a genuine transaction hash
        try:
            lock_res = lock_weighbridge_record(
                ticket_id=ticket_id,
                truck_id=truck_id,
                contractor=contractor_id,
                weight_kg=round(weight, 1),
                timestamp=timestamp,
                gps_route_id=f"RT-{random.randint(101, 110)}",
                disposition="cleared"
            )
            tx_hash = lock_res["tx_hash"]
        except Exception as e:
            print(f"Warning: Failed to lock record {ticket_id} on-chain: {e}")
            tx_hash = f"0x{uuid.uuid4().hex[:64]}"
        
        weigh_log = WeighbridgeLog(
            id=ticket_id,
            truck_id=truck_id,
            contractor_id=contractor_id,
            timestamp=timestamp,
            weight_kg=round(weight, 1),
            driver_name=f"Driver {random.randint(1, 20)}",
            gps_route_id=f"RT-{random.randint(101, 110)}",
            status=status,
            flag_reason=flag_reason,
            tx_hash=tx_hash,
            benchmarked_difference_pct=calculate_benchmarks(weight, contractor_id, truck_id, db),
            zone=log_zone
        )
        db.add(weigh_log)
        
        # Add corresponding GPS trip
        trip_id = f"TRIP-{trip_counter}"
        trip_counter += 1
        
        passed_dumping = True
        
        gps_trip = GPSTrip(
            id=trip_id,
            truck_id=truck_id,
            start_time=timestamp - timedelta(hours=2),
            end_time=timestamp,
            route_name="Civil Lines to Bhandewadi Dumping Ground",
            passed_dumping_ground=passed_dumping,
            weighbridge_log_id=ticket_id
        )
        db.add(gps_trip)

        # Seed matching physical barrier gate-log entry close to arrival time
        gate_entry = DumpingGroundGateLog(
            truck_id=truck_id,
            entry_timestamp=timestamp - timedelta(minutes=random.randint(2, 10)),
            gate_id="BHANDEWADI-GATE-1"
        )
        db.add(gate_entry)

        # Generate realistic GPS telemetry coordinates for this trip (Civil Lines to Bhandewadi)
        coords = generate_route_coordinates(21.1517, 79.0734, 21.1408, 79.1622, steps=10)
        for g_idx, (lat, lon) in enumerate(coords):
            gps_log = GPSLog(
                truck_id=truck_id,
                timestamp=timestamp - timedelta(minutes=(10 - g_idx) * 12),
                latitude=lat,
                longitude=lon,
                speed_kmh=random.uniform(18.0, 42.0)
            )
            db.add(gps_log)

    # 2. SEEDING THE SPECIFIC ANOMALIES (THE EXHIBITS FOR DEMO)
    
    # Anomaly A: GPS-vs-Weighbridge Contradiction (Antony Waste Handling)
    # Truck MH-31-EQ-4520 (Rated capacity: 14,000 kg) registered a drop-off of 14,820 kg, but GPS records show Sadar / Dharampeth
    # CRITICAL: NO DumpingGroundGateLog entry is seeded here, because the truck never arrived at the dumping ground.
    ticket_a = "WB-2026-8021"
    truck_a = "MH-31-EQ-4520"
    timestamp_a = datetime(2026, 7, 10, 14, 30, 0)
    tx_hash_a = f"0x{uuid.uuid4().hex[:64]}"
    
    weigh_a = WeighbridgeLog(
        id=ticket_a,
        truck_id=truck_a,
        contractor_id="antony-waste",
        timestamp=timestamp_a,
        weight_kg=14820.0,
        driver_name="Satish Gawande",
        gps_route_id="RT-901",
        status="under_review", # Will be flagged in processing
        flag_reason=None,
        tx_hash=None,
        benchmarked_difference_pct=calculate_benchmarks(14820.0, "antony-waste", truck_a, db),
        zone="Dharampeth"
    )
    db.add(weigh_a)
    
    trip_a = GPSTrip(
        id="TRIP-9021",
        truck_id=truck_a,
        start_time=timestamp_a - timedelta(hours=2),
        end_time=timestamp_a,
        route_name="Sadar Commercial Sweep (Falsified Destination)",
        passed_dumping_ground=False, # Did not visit dump yard!
        weighbridge_log_id=ticket_a
    )
    db.add(trip_a)
    
    # Write coordinates for the GPS path of Anomaly A (Sadars / Dharampeth path - NO Bhandewadi)
    coords_a = generate_route_coordinates(21.1517, 79.0734, 21.1611, 79.0805, steps=15)
    for idx, (lat, lon) in enumerate(coords_a):
        gps_log = GPSLog(
            truck_id=truck_a,
            timestamp=timestamp_a - timedelta(minutes=(15 - idx) * 8),
            latitude=lat,
            longitude=lon,
            speed_kmh=random.uniform(20.0, 45.0)
        )
        db.add(gps_log)
        
    # Anomaly B: Repeated Identical Weights (BVG India Ltd)
    # Truck MH-49-AT-8812 (Rated capacity: 10,000 kg) registered exact weights of 12,450.0 kg three times in 36 hours.
    # Indicative of recycled sand/boulder loads.
    # Note: These trips DO show passed_dumping_ground=True, so matching gate-log entries ARE seeded.
    bvg_truck = "MH-49-AT-8812"
    bvg_weight = 12450.0
    timestamps_b = [
        datetime(2026, 6, 15, 9, 15, 0),
        datetime(2026, 6, 15, 17, 45, 0),
        datetime(2026, 6, 16, 11, 30, 0),
    ]
    
    for idx, ts in enumerate(timestamps_b):
        ticket_b = f"WB-2026-910{idx}"
        tx_hash_b = f"0x{uuid.uuid4().hex[:64]}"
        
        weigh_b = WeighbridgeLog(
            id=ticket_b,
            truck_id=bvg_truck,
            contractor_id="bvg-india",
            timestamp=ts,
            weight_kg=bvg_weight,
            driver_name="Ramesh Patil",
            gps_route_id="RT-704",
            status="under_review", # Will be flagged in processing
            flag_reason=None,
            tx_hash=None,
            benchmarked_difference_pct=calculate_benchmarks(bvg_weight, "bvg-india", bvg_truck, db),
            zone="Gandhi Baugh"
        )
        db.add(weigh_b)
        
        trip_b = GPSTrip(
            id=f"TRIP-910{idx}",
            truck_id=bvg_truck,
            start_time=ts - timedelta(hours=3),
            end_time=ts,
            route_name="Sitabuldi to Bhandewadi Dumping Ground",
            passed_dumping_ground=True, # Actually went to dump yard, but recycled materials
            weighbridge_log_id=ticket_b
        )
        db.add(trip_b)
        
        # Seed matching gate-barrier entry for BVG trips
        db.add(DumpingGroundGateLog(
            truck_id=bvg_truck,
            entry_timestamp=ts - timedelta(minutes=5),
            gate_id="BHANDEWADI-GATE-1"
        ))
        
        coords_b = generate_route_coordinates(21.1466, 79.0888, 21.1408, 79.1622, steps=15)
        for g_idx, (lat, lon) in enumerate(coords_b):
            gps_log = GPSLog(
                truck_id=bvg_truck,
                timestamp=ts - timedelta(minutes=(15 - g_idx) * 12),
                latitude=lat,
                longitude=lon,
                speed_kmh=random.uniform(15.0, 50.0)
            )
            db.add(gps_log)

    # Anomaly C: GPS-Claimed Visit with Missing Gate Log (Simulated GPS Spoofing)
    # Truck MH-31-EQ-4521 (Antony Waste, 10,000 kg capacity)
    # GPS claims trip to Bhandewadi (passed_dumping_ground=True), but NO physical RFID gate log exists!
    ticket_c = "WB-2026-8022"
    truck_c = "MH-31-EQ-4521"
    timestamp_c = datetime(2026, 7, 11, 11, 15, 0)
    tx_hash_c = f"0x{uuid.uuid4().hex[:64]}"

    weigh_c = WeighbridgeLog(
        id=ticket_c,
        truck_id=truck_c,
        contractor_id="antony-waste",
        timestamp=timestamp_c,
        weight_kg=10250.0,
        driver_name="Nilesh Bhende",
        gps_route_id="RT-902",
        status="under_review",
        flag_reason=None,
        tx_hash=None,
        benchmarked_difference_pct=calculate_benchmarks(10250.0, "antony-waste", truck_c, db),
        zone="Dharampeth"
    )
    db.add(weigh_c)

    trip_c = GPSTrip(
        id="TRIP-9022",
        truck_id=truck_c,
        start_time=timestamp_c - timedelta(hours=2),
        end_time=timestamp_c,
        route_name="Dharampeth to Bhandewadi (Spoofed GPS)",
        passed_dumping_ground=True, # GPS claims visited
        weighbridge_log_id=ticket_c
    )
    db.add(trip_c)
    # NOTE: NO DumpingGroundGateLog is created for truck_c at timestamp_c!

    coords_c = generate_route_coordinates(21.1426, 79.0559, 21.1408, 79.1622, steps=15)
    for g_idx, (lat, lon) in enumerate(coords_c):
        gps_log = GPSLog(
            truck_id=truck_c,
            timestamp=timestamp_c - timedelta(minutes=(15 - g_idx) * 8),
            latitude=lat,
            longitude=lon,
            speed_kmh=random.uniform(22.0, 48.0)
        )
        db.add(gps_log)

    # Anomaly D: Vehicle Overloaded in Laxmi Nagar Zone (Antony Waste)
    ticket_d = "WB-2026-8023"
    truck_d = "MH-31-EQ-4522" # Rated capacity: 7000 kg
    timestamp_d = datetime(2026, 7, 12, 10, 30, 0)
    tx_hash_d = f"0x{uuid.uuid4().hex[:64]}"

    weigh_d = WeighbridgeLog(
        id=ticket_d,
        truck_id=truck_d,
        contractor_id="antony-waste",
        timestamp=timestamp_d,
        weight_kg=9200.0, # Exceeds 7000kg by >10% safety margin (overloaded)
        driver_name="Sanjay Patil",
        gps_route_id="RT-903",
        status="under_review",
        flag_reason=None,
        tx_hash=None,
        benchmarked_difference_pct=calculate_benchmarks(9200.0, "antony-waste", truck_d, db),
        zone="Laxmi Nagar"
    )
    db.add(weigh_d)

    trip_d = GPSTrip(
        id="TRIP-9023",
        truck_id=truck_d,
        start_time=timestamp_d - timedelta(hours=2),
        end_time=timestamp_d,
        route_name="Laxmi Nagar to Bhandewadi Dumping Ground",
        passed_dumping_ground=True,
        weighbridge_log_id=ticket_d
    )
    db.add(trip_d)

    db.add(DumpingGroundGateLog(
        truck_id=truck_d,
        entry_timestamp=timestamp_d - timedelta(minutes=5),
        gate_id="BHANDEWADI-GATE-1"
    ))

    coords_d = generate_route_coordinates(21.1265, 79.0520, 21.1408, 79.1622, steps=10)
    for idx, (lat, lon) in enumerate(coords_d):
        gps_log = GPSLog(
            truck_id=truck_d,
            timestamp=timestamp_d - timedelta(minutes=(10 - idx) * 12),
            latitude=lat,
            longitude=lon,
            speed_kmh=random.uniform(18.0, 40.0)
        )
        db.add(gps_log)

    # 3. SEEDING ROAD REPAIR SLA RECORDS
    print("Seeding road repair SLA records...")
    
    # SLA Case 1: Breached / High complaints (Dharampeth Zone)
    rr1 = RoadRepair(
        id="RR-2026-001",
        contractor_id="amrut-repairs",
        ward_name="Dharampeth Zone",
        location_gps="21.1426,79.0559",
        before_photo_url="https://images.unsplash.com/photo-1515162305285-0293e4767cc2?auto=format&fit=crop&w=600&q=80",
        after_photo_url="https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=600&q=80",
        work_completed_date=datetime.utcnow() - timedelta(days=25),
        sla_expiry_date=datetime.utcnow() + timedelta(days=5),
        status="breached",
        complaints_count=8,
        tx_hash=None
    )
    
    # SLA Case 2: Active / Under Review (Mangalwari Zone)
    rr2 = RoadRepair(
        id="RR-2026-002",
        contractor_id="amrut-repairs",
        ward_name="Mangalwari Zone",
        location_gps="21.1611,79.0805",
        before_photo_url="https://images.unsplash.com/photo-1584467541268-b040f83be3fd?auto=format&fit=crop&w=600&q=80",
        after_photo_url="https://images.unsplash.com/photo-1605117882932-f9e32b03fea9?auto=format&fit=crop&w=600&q=80",
        work_completed_date=datetime.utcnow() - timedelta(days=10),
        sla_expiry_date=datetime.utcnow() + timedelta(days=20),
        status="active",
        complaints_count=1,
        tx_hash=None
    )
    
    # SLA Case 3: Verified / Cleared (Hanuman Nagar Zone)
    # Lock on-chain dynamically to get a real transaction hash
    work_date_rr3 = datetime.utcnow() - timedelta(days=32)
    sla_expiry_rr3 = datetime.utcnow() - timedelta(days=2)
    try:
        lock_res = lock_road_repair_record(
            repair_id="RR-2026-003",
            contractor="amrut-repairs",
            ward_name="Hanuman Nagar Zone",
            location_gps="21.1189,79.1039",
            before_photo_url="https://images.unsplash.com/photo-1515162305285-0293e4767cc2?auto=format&fit=crop&w=600&q=80",
            after_photo_url="https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=600&q=80",
            work_date=work_date_rr3,
            sla_expiry_date=sla_expiry_rr3,
            disposition="cleared"
        )
        tx_hash_rr3 = lock_res["tx_hash"]
    except Exception as e:
        print(f"Warning: Failed to lock road repair RR-2026-003 on-chain: {e}")
        tx_hash_rr3 = f"0x{uuid.uuid4().hex[:64]}"

    rr3 = RoadRepair(
        id="RR-2026-003",
        contractor_id="amrut-repairs",
        ward_name="Hanuman Nagar Zone",
        location_gps="21.1189,79.1039",
        before_photo_url="https://images.unsplash.com/photo-1515162305285-0293e4767cc2?auto=format&fit=crop&w=600&q=80",
        after_photo_url="https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=600&q=80",
        work_completed_date=work_date_rr3,
        sla_expiry_date=sla_expiry_rr3,
        status="verified",
        complaints_count=0,
        tx_hash=tx_hash_rr3
    )
    
    db.add_all([rr1, rr2, rr3])
    db.commit()

    print("Running anomaly detection analysis over seeded logs...")
    run_anomaly_detection(db)
    print("Database seeding completed successfully.")
    try:
        from app.auth import DEMO_ACCOUNTS_METADATA
        print("\n" + "=" * 68)
        print(" [NMC] TrashTrail Nagpur - Demo Login Credentials (RBAC Enabled)")
        print("=" * 68)
        for cred in DEMO_ACCOUNTS_METADATA:
            print(f" [{cred['role'].upper():<7}] Username: {cred['username']:<16} Password: {cred['password']:<12} ({cred['display_name']})")
        print("=" * 68 + "\n")
    except Exception:
        pass

if __name__ == "__main__":
    init_db()
    from app.db import SessionLocal
    db = SessionLocal()
    try:
        seed_data(db)
    finally:
        db.close()
