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

if __name__ == "__main__":
    unittest.main()

