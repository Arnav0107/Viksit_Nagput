import os
from datetime import datetime
from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./auditchain.db")

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class Contractor(Base):
    __tablename__ = "contractors"

    id = Column(String, primary_key=True, index=True) # e.g., "antony-waste", "bvg-india", "amrut-repairs"
    name = Column(String, nullable=False)
    type = Column(String, nullable=False) # "waste" or "road"
    total_claims_inr = Column(Float, default=0.0)
    fraud_flags_confirmed = Column(Integer, default=0) # count of confirmed fraud rulings

    weighbridge_logs = relationship("WeighbridgeLog", back_populates="contractor")
    road_repairs = relationship("RoadRepair", back_populates="contractor")

class WeighbridgeLog(Base):
    __tablename__ = "weighbridge_logs"

    id = Column(String, primary_key=True, index=True) # ticketId (e.g., WB-2026-XXXX)
    truck_id = Column(String, index=True, nullable=False)
    contractor_id = Column(String, ForeignKey("contractors.id"), nullable=False)
    timestamp = Column(DateTime, nullable=False, default=datetime.utcnow)
    weight_kg = Column(Float, nullable=False)
    driver_name = Column(String, nullable=False)
    gps_route_id = Column(String, nullable=True)
    status = Column(String, default="under_review") # "verified", "flagged", "under_review", "confirmed_fraud", "cleared"
    flag_reason = Column(Text, nullable=True)
    tx_hash = Column(String, nullable=True) # Blockchain Transaction Hash
    benchmarked_difference_pct = Column(Float, default=0.0) # deviation from benchmark
    disposition = Column(String, nullable=True) # "confirmed_fraud", "cleared", or null
    auditor_note = Column(Text, nullable=True) # Auditor ruling justification

    contractor = relationship("Contractor", back_populates="weighbridge_logs")
    gps_trip = relationship("GPSTrip", uselist=False, back_populates="weighbridge_log")

class GPSLog(Base):
    __tablename__ = "gps_logs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    truck_id = Column(String, index=True, nullable=False)
    timestamp = Column(DateTime, nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    speed_kmh = Column(Float, default=0.0)

class GPSTrip(Base):
    __tablename__ = "gps_trips"

    id = Column(String, primary_key=True, index=True) # e.g. TRIP-XXXX
    truck_id = Column(String, index=True, nullable=False)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    route_name = Column(String, nullable=True)
    passed_dumping_ground = Column(Boolean, default=False)
    weighbridge_log_id = Column(String, ForeignKey("weighbridge_logs.id"), nullable=True)

    weighbridge_log = relationship("WeighbridgeLog", back_populates="gps_trip")

class RoadRepair(Base):
    __tablename__ = "road_repairs"

    id = Column(String, primary_key=True, index=True) # repairId (e.g., RR-2026-XXXX)
    contractor_id = Column(String, ForeignKey("contractors.id"), nullable=False)
    ward_name = Column(String, nullable=False)
    location_gps = Column(String, nullable=False) # "lat,lon"
    before_photo_url = Column(Text, nullable=False)
    after_photo_url = Column(Text, nullable=False)
    work_completed_date = Column(DateTime, nullable=False)
    sla_expiry_date = Column(DateTime, nullable=False)
    status = Column(String, default="active") # "active", "breached", "verified", "confirmed_fraud", "cleared"
    complaints_count = Column(Integer, default=0)
    tx_hash = Column(String, nullable=True) # Blockchain Transaction Hash
    disposition = Column(String, nullable=True) # "confirmed_fraud", "cleared", or null
    auditor_note = Column(Text, nullable=True) # Auditor ruling justification

    contractor = relationship("Contractor", back_populates="road_repairs")

class Vehicle(Base):
    __tablename__ = "vehicles"

    truck_id = Column(String, primary_key=True, index=True) # e.g., "MH-31-EQ-4520"
    rated_capacity_kg = Column(Integer, nullable=False, default=10000)

class DumpingGroundGateLog(Base):
    __tablename__ = "dumping_ground_gate_logs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    truck_id = Column(String, index=True, nullable=False)
    entry_timestamp = Column(DateTime, nullable=False, default=datetime.utcnow)
    gate_id = Column(String, nullable=False, default="BHANDEWADI-GATE-1")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    Base.metadata.create_all(bind=engine)


