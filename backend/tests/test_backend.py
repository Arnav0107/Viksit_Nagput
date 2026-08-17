import os
import unittest
from datetime import datetime, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Set test environment
os.environ["DATABASE_URL"] = "sqlite:///./test_auditchain.db"

from app.db import Base, Contractor, WeighbridgeLog, GPSTrip, GPSLog, RoadRepair
from app.anomaly import run_anomaly_detection, calculate_benchmarks

class TestAuditChainBackend(unittest.TestCase):
    def setUp(self):
        # Create test DB
        self.engine = create_engine("sqlite:///./test_auditchain.db")
        Base.metadata.create_all(bind=self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()
        
        # Seed contractors
        self.antony = Contractor(id="antony-waste", name="Antony Waste", type="waste", total_claims_inr=100000)
        self.bvg = Contractor(id="bvg-india", name="BVG India", type="waste", total_claims_inr=100000)
        self.db.add_all([self.antony, self.bvg])
        self.db.commit()

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(bind=self.engine)
        self.engine.dispose()
        # Delete file
        if os.path.exists("./test_auditchain.db"):
            os.remove("./test_auditchain.db")

    def test_gps_contradiction_flagging(self):
        # Case A: Truck logged a drop but passed_dumping_ground is False
        log_id = "WB-TEST-001"
        truck_id = "MH-31-AA-1111"
        timestamp = datetime.utcnow()
        
        weigh_log = WeighbridgeLog(
            id=log_id,
            truck_id=truck_id,
            contractor_id="antony-waste",
            timestamp=timestamp,
            weight_kg=12000.0,
            driver_name="Test Driver",
            status="under_review",
            benchmarked_difference_pct=0.0
        )
        self.db.add(weigh_log)
        
        gps_trip = GPSTrip(
            id="TRIP-TEST-001",
            truck_id=truck_id,
            start_time=timestamp - timedelta(hours=1),
            end_time=timestamp,
            passed_dumping_ground=False, # Contradiction!
            weighbridge_log_id=log_id
        )
        self.db.add(gps_trip)
        self.db.commit()
        
        # Run detector
        run_anomaly_detection(self.db)
        
        # Reload
        updated_log = self.db.query(WeighbridgeLog).filter(WeighbridgeLog.id == log_id).first()
        self.assertEqual(updated_log.status, "flagged")
        self.assertIn("GPS Contradiction", updated_log.flag_reason)

    def test_repeated_weight_flagging(self):
        # Case B: Contractor logs exact same weight twice within 48 hours
        truck_id = "MH-49-BB-2222"
        timestamp1 = datetime.utcnow() - timedelta(hours=10)
        timestamp2 = datetime.utcnow()
        
        log1 = WeighbridgeLog(
            id="WB-TEST-002",
            truck_id=truck_id,
            contractor_id="bvg-india",
            timestamp=timestamp1,
            weight_kg=10500.0, # identical
            driver_name="Driver A",
            status="under_review"
        )
        log2 = WeighbridgeLog(
            id="WB-TEST-003",
            truck_id=truck_id,
            contractor_id="bvg-india",
            timestamp=timestamp2,
            weight_kg=10500.0, # identical
            driver_name="Driver B",
            status="under_review"
        )
        self.db.add_all([log1, log2])
        self.db.commit()
        
        # Run detector
        run_anomaly_detection(self.db)
        
        # Reload and check
        updated_log1 = self.db.query(WeighbridgeLog).filter(WeighbridgeLog.id == "WB-TEST-002").first()
        updated_log2 = self.db.query(WeighbridgeLog).filter(WeighbridgeLog.id == "WB-TEST-003").first()
        
        self.assertEqual(updated_log1.status, "flagged")
        self.assertEqual(updated_log2.status, "flagged")
        self.assertIn("Suspicious Weight Pattern", updated_log2.flag_reason)

    def test_benchmark_calculations(self):
        # Base weight benchmark is 10,000kg.
        # 12,000kg should be +20%
        diff = calculate_benchmarks(12000.0, "antony-waste")
        self.assertEqual(diff, 20.0)
        
        # 8,500kg should be -15%
        diff2 = calculate_benchmarks(8500.0, "antony-waste")
        self.assertEqual(diff2, -15.0)

    def test_gate_verification_mismatch_flagging(self):
        # Case D: GPS claims passed_dumping_ground=True, but NO DumpingGroundGateLog exists
        log_id = "WB-TEST-004"
        truck_id = "MH-31-AA-9999"
        timestamp = datetime.utcnow()

        weigh_log = WeighbridgeLog(
            id=log_id,
            truck_id=truck_id,
            contractor_id="antony-waste",
            timestamp=timestamp,
            weight_kg=10000.0,
            driver_name="Test Driver D",
            status="under_review"
        )
        self.db.add(weigh_log)

        gps_trip = GPSTrip(
            id="TRIP-TEST-004",
            truck_id=truck_id,
            start_time=timestamp - timedelta(hours=2),
            end_time=timestamp,
            passed_dumping_ground=True,  # GPS claims true
            weighbridge_log_id=log_id
        )
        self.db.add(gps_trip)
        self.db.commit()

        # Run detector without adding a DumpingGroundGateLog
        run_anomaly_detection(self.db)

        # Reload and check
        updated_log = self.db.query(WeighbridgeLog).filter(WeighbridgeLog.id == log_id).first()
        self.assertEqual(updated_log.status, "flagged")
        self.assertIn("Gate Verification Mismatch", updated_log.flag_reason)

    def test_garbage_hotspot_clustering_and_dustbin_requests(self):
        from app.db import GarbageHotspot, GarbageReport, DustbinRequest
        from app.garbage_ai import resolve_ward_from_coordinates, haversine_meters

        # 1. Ward resolution check (Sataranjipura centroid: 21.1620, 79.1120)
        ward = resolve_ward_from_coordinates(21.1622, 79.1122)
        self.assertEqual(ward, "Sataranjipura")

        # 2. Garbage Hotspot and Report creation
        now = datetime.utcnow()
        hotspot = GarbageHotspot(
            id="HOTSPOT-TEST001",
            ward_name=ward,
            latitude=21.1622,
            longitude=79.1122,
            title="Overflowing bin near Sataranjipura",
            category="overflowing_bin",
            report_count=1,
            status="open",
            first_reported_at=now,
            last_reported_at=now
        )
        report1 = GarbageReport(
            id="GRB-TEST001",
            hotspot=hotspot,
            photo_url="/uploads/test1.jpg",
            description="Overflowing dustbin spilling trash on road",
            latitude=21.1622,
            longitude=79.1122,
            ward_name=ward,
            status="submitted",
            created_at=now
        )
        self.db.add_all([hotspot, report1])
        self.db.commit()

        # 3. Simulate second duplicate report nearby (20 meters away)
        distance = haversine_meters(21.1622, 79.1122, 21.1623, 79.1123)
        self.assertLess(distance, 150.0)

        hotspot.report_count += 1
        report2 = GarbageReport(
            id="GRB-TEST002",
            hotspot=hotspot,
            photo_url="/uploads/test2.jpg",
            description="Dustbin full and overflowing again",
            latitude=21.1623,
            longitude=79.1123,
            ward_name=ward,
            ai_is_duplicate_of_hotspot=True,
            ai_match_confidence=0.9,
            ai_reasoning="Same location and overflowing bin issue",
            status="submitted",
            created_at=now
        )
        self.db.add(report2)
        self.db.commit()

        # Verify cluster tally
        saved_hotspot = self.db.query(GarbageHotspot).filter(GarbageHotspot.id == "HOTSPOT-TEST001").first()
        self.assertEqual(saved_hotspot.report_count, 2)
        self.assertEqual(len(saved_hotspot.reports), 2)

        # 4. Dustbin Request Tallying
        dbr = DustbinRequest(
            id="DBR-TEST001",
            ward_name=ward,
            area_description="MG Road near main chowk",
            reason="Need additional bin for commercial shops",
            latitude=21.1620,
            longitude=79.1120,
            request_count=1,
            status="pending",
            created_at=now,
            updated_at=now
        )
        self.db.add(dbr)
        self.db.commit()

        # Second request nearby increments count
        dbr.request_count += 1
        self.db.commit()

        saved_dbr = self.db.query(DustbinRequest).filter(DustbinRequest.id == "DBR-TEST001").first()
        self.assertEqual(saved_dbr.request_count, 2)
        self.assertEqual(saved_dbr.status, "pending")

if __name__ == "__main__":
    unittest.main()


