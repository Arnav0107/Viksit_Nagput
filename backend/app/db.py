import os
from datetime import datetime
from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./auditchain.db")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL, connect_args={
                       "check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class Contractor(Base):
    __tablename__ = "contractors"

    # e.g., "antony-waste", "bvg-india", "amrut-repairs"
    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)  # "waste" or "road"
    total_claims_inr = Column(Float, default=0.0)
    # count of confirmed fraud rulings
    fraud_flags_confirmed = Column(Integer, default=0)

    weighbridge_logs = relationship(
        "WeighbridgeLog", back_populates="contractor")
    road_repairs = relationship("RoadRepair", back_populates="contractor")


class WeighbridgeLog(Base):
    __tablename__ = "weighbridge_logs"

    # ticketId (e.g., WB-2026-XXXX)
    id = Column(String, primary_key=True, index=True)
    truck_id = Column(String, index=True, nullable=False)
    contractor_id = Column(String, ForeignKey(
        "contractors.id"), nullable=False)
    timestamp = Column(DateTime, nullable=False, default=datetime.utcnow)
    weight_kg = Column(Float, nullable=False)
    driver_name = Column(String, nullable=False)
    gps_route_id = Column(String, nullable=True)
    # "verified", "flagged", "under_review", "confirmed_fraud", "cleared"
    status = Column(String, default="under_review")
    flag_reason = Column(Text, nullable=True)
    tx_hash = Column(String, nullable=True)  # Blockchain Transaction Hash
    benchmarked_difference_pct = Column(
        Float, default=0.0)  # deviation from benchmark
    # "confirmed_fraud", "cleared", or null
    disposition = Column(String, nullable=True)
    auditor_note = Column(Text, nullable=True)  # Auditor ruling justification
    # Administrative zone name (e.g. Laxmi Nagar, Dharampeth)
    zone = Column(String, nullable=True)

    contractor = relationship("Contractor", back_populates="weighbridge_logs")
    gps_trip = relationship("GPSTrip", uselist=False,
                            back_populates="weighbridge_log")


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

    id = Column(String, primary_key=True, index=True)  # e.g. TRIP-XXXX
    truck_id = Column(String, index=True, nullable=False)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    route_name = Column(String, nullable=True)
    passed_dumping_ground = Column(Boolean, default=False)
    weighbridge_log_id = Column(String, ForeignKey(
        "weighbridge_logs.id"), nullable=True)

    weighbridge_log = relationship("WeighbridgeLog", back_populates="gps_trip")


class RoadRepair(Base):
    __tablename__ = "road_repairs"

    # repairId (e.g., RR-2026-XXXX)
    id = Column(String, primary_key=True, index=True)
    contractor_id = Column(String, ForeignKey(
        "contractors.id"), nullable=False)
    ward_name = Column(String, nullable=False)
    location_gps = Column(String, nullable=False)  # "lat,lon"
    before_photo_url = Column(Text, nullable=False)
    after_photo_url = Column(Text, nullable=False)
    work_completed_date = Column(DateTime, nullable=False)
    sla_expiry_date = Column(DateTime, nullable=False)
    # "active", "breached", "verified", "confirmed_fraud", "cleared"
    status = Column(String, default="active")
    complaints_count = Column(Integer, default=0)
    tx_hash = Column(String, nullable=True)  # Blockchain Transaction Hash
    # "confirmed_fraud", "cleared", or null
    disposition = Column(String, nullable=True)
    auditor_note = Column(Text, nullable=True)  # Auditor ruling justification

    contractor = relationship("Contractor", back_populates="road_repairs")


class Vehicle(Base):
    __tablename__ = "vehicles"

    truck_id = Column(String, primary_key=True,
                      index=True)  # e.g., "MH-31-EQ-4520"
    rated_capacity_kg = Column(Integer, nullable=False, default=10000)


class DumpingGroundGateLog(Base):
    __tablename__ = "dumping_ground_gate_logs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    truck_id = Column(String, index=True, nullable=False)
    entry_timestamp = Column(DateTime, nullable=False, default=datetime.utcnow)
    gate_id = Column(String, nullable=False, default="BHANDEWADI-GATE-1")


class CitizenComplaint(Base):
    __tablename__ = "citizen_complaints"

    id = Column(String, primary_key=True, index=True)  # UUID string
    repair_id = Column(String, ForeignKey("road_repairs.id"), nullable=True)
    photo_url = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    ai_category = Column(String, nullable=True)
    ai_severity = Column(String, nullable=True)
    ai_reasoning = Column(Text, nullable=True)
    status = Column(String, default="submitted")
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    road_repair = relationship("RoadRepair", backref="citizen_complaints")


class GarbageHotspot(Base):
    __tablename__ = "garbage_hotspots"

    id = Column(String, primary_key=True, index=True)
    ward_name = Column(String, nullable=False, index=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    title = Column(String, nullable=False)
    category = Column(String, nullable=True)
    report_count = Column(Integer, default=1, nullable=False)
    status = Column(String, default="open")
    first_reported_at = Column(
        DateTime, nullable=False, default=datetime.utcnow)
    last_reported_at = Column(
        DateTime, nullable=False, default=datetime.utcnow)
    acknowledged_by = Column(String, nullable=True)
    acknowledged_at = Column(DateTime, nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    resolution_note = Column(Text, nullable=True)

    reports = relationship(
        "GarbageReport", back_populates="hotspot", cascade="all, delete-orphan")


class GarbageReport(Base):
    __tablename__ = "garbage_reports"

    id = Column(String, primary_key=True, index=True)
    hotspot_id = Column(String, ForeignKey(
        "garbage_hotspots.id"), nullable=False, index=True)
    photo_url = Column(String, nullable=False)
    extra_file_url = Column(String, nullable=True)
    description = Column(Text, nullable=False)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    ward_name = Column(String, nullable=True)
    ai_is_duplicate_of_hotspot = Column(Boolean, default=False)
    ai_match_confidence = Column(Float, nullable=True)
    ai_reasoning = Column(Text, nullable=True)
    status = Column(String, default="submitted")
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    hotspot = relationship("GarbageHotspot", back_populates="reports")


class DustbinRequest(Base):
    __tablename__ = "dustbin_requests"

    id = Column(String, primary_key=True, index=True)
    ward_name = Column(String, nullable=False, index=True)
    area_description = Column(Text, nullable=False)
    reason = Column(Text, nullable=False)
    photo_url = Column(String, nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    request_count = Column(Integer, default=1, nullable=False)
    status = Column(String, default="pending")
    officer_note = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=True)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
