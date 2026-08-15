import uuid
from datetime import datetime, timedelta
import random
from sqlalchemy.orm import Session
from app.db import engine, Base, Contractor, WeighbridgeLog, GPSLog, GPSTrip, RoadRepair, init_db
from app.anomaly import run_anomaly_detection, calculate_benchmarks

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
    db.query(RoadRepair).delete()
    db.query(GPSTrip).delete()
    db.query(GPSLog).delete()
    db.query(WeighbridgeLog).delete()
    db.query(Contractor).delete()
    db.commit()

    print("Seeding contractors...")
    antony = Contractor(id="antony-waste", name="Antony Waste Handling Ltd", type="waste", total_claims_inr=42500000.00)
    bvg = Contractor(id="bvg-india", name="BVG India Ltd", type="waste", total_claims_inr=38900000.00)
    amrut = Contractor(id="amrut-repairs", name="Amrut Yojana Road Builders", type="road", total_claims_inr=15000000.00)
    db.add_all([antony, bvg, amrut])
    db.commit()

    print("Seeding weighbridge logs and GPS trips...")
    
    # Let's seed daily tonnage aggregates for April to July 2026 to show the massive drop
    # April 2026: ~42,000 MT total (approx 1,400 MT/day)
    # May 2026: ~38,500 MT total (approx 1,240 MT/day)
    # June 2026: ~35,200 MT total (approx 1,170 MT/day)
    # July 2026: ~33,600 MT total (approx 1,080 MT/day) -> ~8,400 MT drop from April!
    
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
    
    # We will generate individual logs for key dates, and aggregate summaries for the rest to keep it fast.
    # To display detailed audit trail, we will generate ~80 detailed weighbridge logs.
    detailed_dates = [
        datetime(2026, 7, 10),
        datetime(2026, 7, 11),
        datetime(2026, 7, 12),
        datetime(2026, 6, 15),
        datetime(2026, 6, 16),
        datetime(2026, 5, 20),
    ]
    
    ticket_counter = 1000
    trip_counter = 5000
    
    # 1. Seeding regular logs (showing high tonnage in April/May, then drop in June/July)
    # Antony Waste handles about 55% of waste, BVG 45%
    for i in range(120):
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
        
        # Base weight ~10,000 kg (10 MT)
        weight = random.uniform(8500, 12500) * month_scale
        
        ticket_id = f"WB-2026-{ticket_counter}"
        ticket_counter += 1
        
        timestamp = log_date.replace(hour=random.randint(8, 18), minute=random.randint(0, 59))
        
        # Determine if it's verified or under_review
        status = "verified"
        flag_reason = None
        
        # Mock transaction hash
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
            benchmarked_difference_pct=calculate_benchmarks(weight, contractor_id)
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

    # 2. SEEDING THE SPECIFIC ANOMALIES (THE EXHIBITS FOR DEMO)
    
    # Anomaly A: GPS-vs-Weighbridge Contradiction (Antony Waste Handling)
    # Truck MH-31-EQ-4520 registered a drop-off of 14,820 kg, but its GPS records show it was driving around Sadar / Dharampeth
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
        tx_hash=tx_hash_a,
        benchmarked_difference_pct=calculate_benchmarks(14820.0, "antony-waste")
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
    # Bhandewadi dumping ground is at: 21.1408, 79.1622
    # This falsified route drives from Civil Lines (21.1517, 79.0734) to Sadar (21.1611, 79.0805) and wanders around (21.155, 79.078)
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
    # Truck MH-49-AT-8812 registered exact weights of 12,450.0 kg three times in 36 hours.
    # Indicative of recycled sand/boulder loads.
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
            tx_hash=tx_hash_b,
            benchmarked_difference_pct=calculate_benchmarks(bvg_weight, "bvg-india")
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
        
        # Path for BVG Truck (actually reaches Bhandewadi dumping ground 21.1408, 79.1622)
        # Starts from Sitabuldi (21.1466, 79.0888) and goes to Bhandewadi
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

    # 3. SEEDING ROAD REPAIR SLA RECORDS
    # Amrut Yojana post-pipeline road restorations
    # Ward names: Dharampeth, Sadar, Lakadganj, Hanuman Nagar, Gandhibagh
    print("Seeding road repair SLA records...")
    
    # SLA Case 1: Breached / High complaints (Dharampeth Zone)
    # Contractor failed to restore road after laying sewer pipelines.
    rr1 = RoadRepair(
        id="RR-2026-001",
        contractor_id="amrut-repairs",
        ward_name="Dharampeth Zone",
        location_gps="21.1426,79.0559",
        before_photo_url="https://images.unsplash.com/photo-1515162305285-0293e4767cc2?auto=format&fit=crop&w=600&q=80", # Muddy, broken ditch road
        after_photo_url="https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=600&q=80", # Poor asphalt patchwork
        work_completed_date=datetime.utcnow() - timedelta(days=25), # 25 days ago
        sla_expiry_date=datetime.utcnow() + timedelta(days=5),      # SLA expires in 5 days
        status="breached", # Over complaints threshold
        complaints_count=8, # Triggered breach
        tx_hash=f"0x{uuid.uuid4().hex[:64]}"
    )
    
    # SLA Case 2: Active / Under Review (Mangalwari Zone)
    # Restoration recently done, SLA countdown active
    rr2 = RoadRepair(
        id="RR-2026-002",
        contractor_id="amrut-repairs",
        ward_name="Mangalwari Zone",
        location_gps="21.1611,79.0805",
        before_photo_url="https://images.unsplash.com/photo-1584467541268-b040f83be3fd?auto=format&fit=crop&w=600&q=80",
        after_photo_url="https://images.unsplash.com/photo-1605117882932-f9e32b03fea9?auto=format&fit=crop&w=600&q=80",
        work_completed_date=datetime.utcnow() - timedelta(days=10), # 10 days ago
        sla_expiry_date=datetime.utcnow() + timedelta(days=20),     # 20 days left
        status="active",
        complaints_count=1,
        tx_hash=f"0x{uuid.uuid4().hex[:64]}"
    )
    
    # SLA Case 3: Verified / Cleared (Hanuman Nagar Zone)
    # Work passed without any complaints
    rr3 = RoadRepair(
        id="RR-2026-003",
        contractor_id="amrut-repairs",
        ward_name="Hanuman Nagar Zone",
        location_gps="21.1189,79.1039",
        before_photo_url="https://images.unsplash.com/photo-1515162305285-0293e4767cc2?auto=format&fit=crop&w=600&q=80",
        after_photo_url="https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=600&q=80",
        work_completed_date=datetime.utcnow() - timedelta(days=32), # Completed 32 days ago
        sla_expiry_date=datetime.utcnow() - timedelta(days=2),      # SLA expired 2 days ago
        status="verified",
        complaints_count=0,
        tx_hash=f"0x{uuid.uuid4().hex[:64]}"
    )
    
    db.add_all([rr1, rr2, rr3])
    db.commit()

    print("Running anomaly detection analysis over seeded logs...")
    run_anomaly_detection(db)
    print("Database seeding completed successfully.")

if __name__ == "__main__":
    init_db()
    from app.db import SessionLocal
    db = SessionLocal()
    try:
        seed_data(db)
    finally:
        db.close()
