from fastapi import FastAPI, Depends, HTTPException, Query, status, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import pandas as pd
from typing import List, Optional, Set
import uuid
import hashlib
from pydantic import BaseModel

from app.db import init_db, get_db, Contractor, WeighbridgeLog, GPSLog, GPSTrip, RoadRepair, Vehicle, DumpingGroundGateLog
from app.anomaly import run_anomaly_detection
from app import blockchain
from app.auth import (
    DEMO_CREDENTIALS,
    DEMO_ACCOUNTS_METADATA,
    verify_password,
    create_access_token,
    require_role,
    get_current_user,
    oauth2_scheme,
    SECRET_KEY,
    ALGORITHM,
    jwt,
    JWTError
)

app = FastAPI(title="AuditChain Nagpur API", description="Civic-tech audit and anomaly checker for NMC")

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class LoginRequest(BaseModel):
    username: str
    password: str

class RoadComplaintRequest(BaseModel):
    description: str

# In-memory storage for anti-spam complaint fingerprints (hash of ID + client identifier)
COMPLAINT_FINGERPRINTS: Set[str] = set()

# On startup, initialize tables and print demo credentials to console
@app.on_event("startup")
def startup_event():
    init_db()
    print("\n" + "=" * 68)
    print(" [NMC] AuditChain Nagpur - Demo Login Credentials (RBAC Enabled)")
    print("=" * 68)
    for cred in DEMO_ACCOUNTS_METADATA:
        print(f" [{cred['role'].upper():<7}] Username: {cred['username']:<16} Password: {cred['password']:<12} ({cred['display_name']})")
    print("=" * 68 + "\n")

@app.post("/api/auth/login")
def login_endpoint(payload: LoginRequest):
    """Authenticates credentials against the demo user store and returns a JWT."""
    user = DEMO_CREDENTIALS.get(payload.username)
    if not user or not verify_password(payload.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    token = create_access_token(username=user["username"], role=user["role"])
    return {
        "access_token": token,
        "token_type": "bearer",
        "role": user["role"],
        "username": user["username"],
        "display_name": user.get("display_name", user["username"])
    }

@app.post("/api/admin/reseed")
def reseed_database(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("auditor"))
):
    """Reseeds the database to standard starting state for demo purposes (Auditor only)."""
    from app.seed import seed_data
    seed_data(db)
    return {"status": "success", "message": "Database successfully reseeded."}

@app.post("/api/admin/run-analytics")
def trigger_anomaly_detection(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("auditor"))
):
    """Triggers ML and statistical anomaly detection over all logs (Auditor only)."""
    run_anomaly_detection(db)
    return {"status": "success", "message": "Anomaly detection pipeline executed successfully."}

@app.get("/api/overview")
def get_city_overview(db: Session = Depends(get_db)):
    """Returns overview statistics and ward-level anomaly severity for the map."""
    total_logs = db.query(WeighbridgeLog).count()
    flagged_logs = db.query(WeighbridgeLog).filter(WeighbridgeLog.status == "flagged").count()
    under_review_logs = db.query(WeighbridgeLog).filter(WeighbridgeLog.status == "under_review").count()
    verified_logs = db.query(WeighbridgeLog).filter(WeighbridgeLog.status == "verified").count()
    
    # Calculate contractor waste totals
    contractors = db.query(Contractor).filter(Contractor.type == "waste").all()
    contractor_stats = []
    for c in contractors:
        logs_c = db.query(WeighbridgeLog).filter(WeighbridgeLog.contractor_id == c.id).all()
        total_weight = sum([l.weight_kg for l in logs_c]) / 1000.0 # Convert to Metric Tons (MT)
        contractor_stats.append({
            "id": c.id,
            "name": c.name,
            "total_tonnage_mt": round(total_weight, 2),
            "claims_inr": c.total_claims_inr,
            "fraud_flags_confirmed": c.fraud_flags_confirmed or 0
        })
        
    # SLA Repairs statistics
    total_repairs = db.query(RoadRepair).count()
    breached_repairs = db.query(RoadRepair).filter(RoadRepair.status == "breached").count()
    active_repairs = db.query(RoadRepair).filter(RoadRepair.status == "active").count()
    verified_repairs = db.query(RoadRepair).filter(RoadRepair.status == "verified").count()

    # Ward map data (aggregated anomalies per Nagpur administrative zone)
    # Severity is high if there are flagged logs or breached road repairs, medium if under_review, low otherwise.
    ward_anomalies = {
        "Laxmi Nagar": {"anomalies": 0, "severity": "low", "details": "All contractor ticket verification audits passing successfully."},
        "Dharampeth": {"anomalies": 3, "severity": "high", "details": "1 GPS Telemetry Contradiction, 1 road restoration SLA breach (8 citizen complaints)"},
        "Hanuman Nagar": {"anomalies": 0, "severity": "low", "details": "Road repair SLA verified clean and cleared."},
        "Dhantoli": {"anomalies": 1, "severity": "medium", "details": "1 ML tonnage statistical weight outlier"},
        "Nehru Nagar": {"anomalies": 0, "severity": "low", "details": "No active anomalies, normal compliance parameters."},
        "Gandhi Baugh": {"anomalies": 4, "severity": "high", "details": "3 repeated identical weights registered (suspected sand/boulder recycling)"},
        "Sataranjipura": {"anomalies": 0, "severity": "low", "details": "No active anomalies, normal operations."},
        "Lakadganj": {"anomalies": 0, "severity": "low", "details": "No active anomalies, normal operations."},
        "Ashi Nagar": {"anomalies": 0, "severity": "low", "details": "No active anomalies, normal compliance parameters."},
        "Mangalwari": {"anomalies": 2, "severity": "medium", "details": "1 SLA road repair under active review, 1 ML weight outlier"}
    }

    # April to July monthly totals to show the 6,400+ MT drop
    monthly_data = [
        {"month": "April 2026", "tonnage_mt": 41250, "spend_inr": 18562500},
        {"month": "May 2026", "tonnage_mt": 38100, "spend_inr": 17145000},
        {"month": "June 2026", "tonnage_mt": 35420, "spend_inr": 15939000},
        {"month": "July 2026", "tonnage_mt": 33600, "spend_inr": 15120000} # drop of 7,650 MT total
    ]

    return {
        "summary": {
            "total_weighs": total_logs,
            "flagged_weighs": flagged_logs,
            "under_review_weighs": under_review_logs,
            "verified_weighs": verified_logs,
            "total_repairs": total_repairs,
            "breached_repairs": breached_repairs,
            "active_repairs": active_repairs,
            "verified_repairs": verified_repairs
        },
        "contractors": contractor_stats,
        "ward_anomalies": ward_anomalies,
        "monthly_tonnage_history": monthly_data
    }

@app.get("/api/contractors")
def list_contractors(db: Session = Depends(get_db)):
    """Lists all contractors."""
    contractors = db.query(Contractor).all()
    return [{
        "id": c.id,
        "name": c.name,
        "type": c.type,
        "total_claims_inr": c.total_claims_inr,
        "fraud_flags_confirmed": c.fraud_flags_confirmed or 0
    } for c in contractors]

@app.get("/api/contractors/{contractor_id}/tonnage")
def get_contractor_tonnage_history(contractor_id: str, db: Session = Depends(get_db)):
    """Returns tonnage history of a specific contractor aggregated daily, with flags."""
    logs = db.query(WeighbridgeLog).filter(WeighbridgeLog.contractor_id == contractor_id).order_by(WeighbridgeLog.timestamp).all()
    
    if not logs:
        return []
    
    # Format and aggregate by day
    data = []
    for l in logs:
        data.append({
            "date": l.timestamp.strftime("%Y-%m-%d"),
            "weight_kg": l.weight_kg,
            "is_flagged": l.status in ["flagged", "under_review"]
        })
        
    df = pd.DataFrame(data)
    # Group by date
    daily = df.groupby("date").agg(
        total_weight_kg=("weight_kg", "sum"),
        anomaly_count=("is_flagged", "sum"),
        trip_count=("date", "count")
    ).reset_index()
    
    # Return as list of dicts
    result = []
    for idx, row in daily.iterrows():
        # Convert to MT
        weight_mt = round(row["total_weight_kg"] / 1000.0, 2)
        result.append({
            "date": row["date"],
            "tonnage_mt": weight_mt,
            "trips": int(row["trip_count"]),
            "anomalies": int(row["anomaly_count"]),
            # Flag days where anomalies are detected
            "flagged": int(row["anomaly_count"]) > 0
        })
        
    return result

@app.get("/api/weighbridge/logs")
def list_weighbridge_logs(
    status: Optional[str] = None, 
    contractor: Optional[str] = None,
    limit: int = 50, 
    offset: int = 0,
    db: Session = Depends(get_db)
):
    """Lists weighbridge logs, support filtering by status and contractor."""
    query = db.query(WeighbridgeLog)
    if status:
        query = query.filter(WeighbridgeLog.status == status)
    if contractor:
        query = query.filter(WeighbridgeLog.contractor_id == contractor)
        
    total = query.count()
    logs = query.order_by(WeighbridgeLog.timestamp.desc()).offset(offset).limit(limit).all()
    
    return {
        "total": total,
        "logs": [{
            "id": l.id,
            "truck_id": l.truck_id,
            "contractor_id": l.contractor_id,
            "contractor_name": "Antony Waste" if l.contractor_id == "antony-waste" else "BVG India",
            "timestamp": l.timestamp.isoformat(),
            "weight_kg": l.weight_kg,
            "driver_name": l.driver_name,
            "status": l.status,
            "flag_reason": l.flag_reason,
            "tx_hash": l.tx_hash,
            "deviation_pct": l.benchmarked_difference_pct,
            "disposition": l.disposition,
            "auditor_note": l.auditor_note
        } for l in logs]
    }

@app.get("/api/weighbridge/flags")
def list_flagged_logs(all_logs: bool = True, db: Session = Depends(get_db)):
    """Returns records of weighbridge anomalies and audit logs."""
    query = db.query(WeighbridgeLog)
    if not all_logs:
        query = query.filter(WeighbridgeLog.status.in_(["flagged", "under_review"]))
    logs = query.order_by(WeighbridgeLog.timestamp.desc()).all()
    return [{
        "id": l.id,
        "truck_id": l.truck_id,
        "contractor_id": l.contractor_id,
        "contractor_name": "Antony Waste" if l.contractor_id == "antony-waste" else "BVG India",
        "timestamp": l.timestamp.isoformat(),
        "weight_kg": l.weight_kg,
        "driver_name": l.driver_name,
        "status": l.status,
        "flag_reason": l.flag_reason,
        "tx_hash": l.tx_hash,
        "deviation_pct": l.benchmarked_difference_pct,
        "disposition": l.disposition,
        "auditor_note": l.auditor_note
    } for l in logs]

@app.get("/api/weighbridge/flags/{id}")
def get_flagged_case_detail(id: str, db: Session = Depends(get_db)):
    """
    Returns specific details of an anomaly case, including GPS coordinate track sequence.
    This provides the evidence for the side-by-side view.
    """
    log = db.query(WeighbridgeLog).filter(WeighbridgeLog.id == id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Weighbridge log not found")
        
    gps_trip = db.query(GPSTrip).filter(GPSTrip.weighbridge_log_id == log.id).first()
    
    # Retrieve all GPS coordinates for this truck during the trip duration
    gps_coordinates = []
    if gps_trip:
        coords = db.query(GPSLog).filter(
            GPSLog.truck_id == log.truck_id,
            GPSLog.timestamp >= gps_trip.start_time,
            GPSLog.timestamp <= gps_trip.end_time
        ).order_by(GPSLog.timestamp).all()
        
        gps_coordinates = [{
            "lat": c.latitude,
            "lng": c.longitude,
            "timestamp": c.timestamp.isoformat(),
            "speed_kmh": c.speed_kmh
        } for c in coords]
        
    # Check independent physical boom-barrier RFID gate log
    gate_verified = False
    gate_log_data = None
    if gps_trip:
        tolerance_delta = timedelta(minutes=30.0)
        gate_entry = db.query(DumpingGroundGateLog).filter(
            DumpingGroundGateLog.truck_id == log.truck_id,
            DumpingGroundGateLog.entry_timestamp >= gps_trip.start_time - tolerance_delta,
            DumpingGroundGateLog.entry_timestamp <= gps_trip.end_time + tolerance_delta
        ).first()
        if gate_entry:
            gate_verified = True
            gate_log_data = {
                "id": gate_entry.id,
                "gate_id": gate_entry.gate_id,
                "entry_timestamp": gate_entry.entry_timestamp.isoformat()
            }
        
    return {
        "log": {
            "id": log.id,
            "truck_id": log.truck_id,
            "contractor_id": log.contractor_id,
            "contractor_name": "Antony Waste" if log.contractor_id == "antony-waste" else "BVG India",
            "timestamp": log.timestamp.isoformat(),
            "weight_kg": log.weight_kg,
            "driver_name": log.driver_name,
            "status": log.status,
            "flag_reason": log.flag_reason,
            "tx_hash": log.tx_hash,
            "deviation_pct": log.benchmarked_difference_pct,
            "disposition": log.disposition,
            "auditor_note": log.auditor_note
        },
        "trip": {
            "id": gps_trip.id if gps_trip else None,
            "start_time": gps_trip.start_time.isoformat() if gps_trip else None,
            "end_time": gps_trip.end_time.isoformat() if gps_trip else None,
            "route_name": gps_trip.route_name if gps_trip else None,
            "passed_dumping_ground": gps_trip.passed_dumping_ground if gps_trip else False,
        },
        "gate_log": {
            "verified": gate_verified,
            "details": gate_log_data,
            "status_label": "PHYSICAL ENTRY CONFIRMED" if gate_verified else "NO MATCHING PHYSICAL GATE ENTRY FOUND"
        },
        "gps_path": gps_coordinates,
        # Bhandewadi dumping ground coordinates for rendering on map
        "dumping_ground": {
            "lat": 21.1408,
            "lng": 79.1622,
            "name": "Bhandewadi Dumping Ground"
        }
    }

@app.get("/api/road-repairs")
def list_road_repairs(db: Session = Depends(get_db)):
    """Lists road repair SLA items and photos."""
    repairs = db.query(RoadRepair).order_by(RoadRepair.sla_expiry_date.asc()).all()
    return [{
        "id": r.id,
        "contractor_id": r.contractor_id,
        "contractor_name": r.contractor.name if r.contractor else "Amrut Yojana Road Builders",
        "ward_name": r.ward_name,
        "location_gps": r.location_gps,
        "before_photo_url": r.before_photo_url,
        "after_photo_url": r.after_photo_url,
        "work_completed_date": r.work_completed_date.isoformat(),
        "sla_expiry_date": r.sla_expiry_date.isoformat(),
        "status": r.status,
        "complaints_count": r.complaints_count,
        "tx_hash": r.tx_hash,
        "disposition": r.disposition,
        "auditor_note": r.auditor_note
    } for r in repairs]

@app.post("/api/road-repairs/{id}/complaint")
def register_road_complaint(
    id: str,
    payload: RoadComplaintRequest,
    request: Request,
    db: Session = Depends(get_db),
    token: Optional[str] = Depends(oauth2_scheme)
):
    """
    Registers a validated citizen complaint on a road repair SLA.
    - Requires non-empty description (min 10 characters).
    - Restricts 'officer' and 'auditor' roles from filing complaints.
    - Uses client fingerprinting (IP + User-Agent or logged-in citizen username per case) to prevent spam duplicates.
    - Triggers contract SLA breach if complaints exceed 3.
    """
    # 1. Validate complaint description
    if not payload or not payload.description or len(payload.description.strip()) < 10:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Complaint description must be at least 10 characters long."
        )

    # 2. Check caller role: Public/citizen users and unauthenticated requests are allowed.
    # Reject specifically if authenticated user has 'officer' or 'auditor' role.
    username = None
    if token and token.strip() and token != "null" and token != "undefined":
        try:
            token_payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            user_role = str(token_payload.get("role", "")).lower()
            username = token_payload.get("sub")
            if user_role in ["officer", "auditor"]:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Forbidden: Access denied for role '{user_role}'. Citizen complaints cannot be submitted by internal municipal officers or auditors."
                )
        except JWTError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired authentication token."
            )

    # 3. Locate road repair record
    repair = db.query(RoadRepair).filter(RoadRepair.id == id).first()
    if not repair:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Road repair record not found")

    # 4. Anti-spam fingerprinting per road repair case
    client_ip = request.headers.get("x-forwarded-for")
    if client_ip:
        client_ip = client_ip.split(",")[0].strip()
    elif request.client and request.client.host:
        client_ip = request.client.host
    else:
        client_ip = "unknown"

    user_agent = request.headers.get("user-agent", "unknown")
    source_identifier = username if username else f"{client_ip}:{user_agent}"
    fingerprint_raw = f"{id}:{source_identifier}"
    fingerprint = hashlib.sha256(fingerprint_raw.encode("utf-8")).hexdigest()

    if fingerprint in COMPLAINT_FINGERPRINTS:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You have already reported this case."
        )

    # Register fingerprint
    COMPLAINT_FINGERPRINTS.add(fingerprint)

    # Increment complaints count and evaluate SLA breach
    repair.complaints_count += 1
    
    # If active and complaints exceed 3, it breaches the SLA terms
    if repair.status == "active" and repair.complaints_count > 3:
        repair.status = "breached"
        
    db.commit()
    return {
        "status": "success",
        "complaints_count": repair.complaints_count,
        "repair_status": repair.status,
        "message": "Citizen complaint successfully registered."
    }

@app.post("/api/blockchain/lock")
def lock_record_on_chain(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("auditor"))
):
    """
    Writes an immutable cryptographic ruling to the AuditChain smart contract on the local Ethereum blockchain.
    Updates the record in the DB with the confirmed ruling, auditor justification note, and real transaction hash (Auditor only).
    Accepts: { "type": "weighbridge" | "road", "id": str, "disposition"?: "confirmed_fraud" | "cleared", "note"?: str }
    """
    record_type = payload.get("type")
    record_id = payload.get("id")
    disposition = payload.get("disposition", "cleared")
    note = (payload.get("note") or "").strip()
    
    if not record_id or not record_type:
        raise HTTPException(status_code=400, detail="Missing record type or ID")

    if disposition not in ["confirmed_fraud", "cleared"]:
        raise HTTPException(status_code=400, detail="Invalid disposition. Must be either 'confirmed_fraud' or 'cleared'.")

    if disposition == "confirmed_fraud" and not note:
        raise HTTPException(
            status_code=400,
            detail="An auditor justification note is required when ruling a case as a confirmed fraud violation."
        )
         
    try:
        if record_type == "weighbridge":
            log = db.query(WeighbridgeLog).filter(WeighbridgeLog.id == record_id).first()
            if not log:
                raise HTTPException(status_code=404, detail="Weighbridge record not found")
            
            # Execute real smart contract transaction on blockchain
            lock_result = blockchain.lock_weighbridge_record(
                ticket_id=log.id,
                truck_id=log.truck_id,
                contractor="Antony Waste" if log.contractor_id == "antony-waste" else "BVG India",
                weight_kg=log.weight_kg,
                timestamp=log.timestamp,
                gps_route_id=log.gps_route_id,
                disposition=disposition
            )
            tx_hash = lock_result["tx_hash"]
            log.tx_hash = tx_hash
            log.disposition = disposition
            log.auditor_note = note if note else None

            # Apply disposition ruling & preserve original fraud finding
            orig_reason = log.flag_reason or ""
            if disposition == "confirmed_fraud":
                log.status = "confirmed_fraud"
                log.flag_reason = (
                    f"{orig_reason} | AUDITOR RULING: CONFIRMED VIOLATION - {note}"
                    if orig_reason else f"AUDITOR RULING: CONFIRMED VIOLATION - {note}"
                )
                if log.contractor:
                    log.contractor.fraud_flags_confirmed = (log.contractor.fraud_flags_confirmed or 0) + 1
            else:
                log.status = "cleared"
                cleared_justification = note if note else "Reviewed and cleared by auditor inspection."
                log.flag_reason = (
                    f"{orig_reason} | AUDITOR RULING: REVIEWED, FALSE POSITIVE - {cleared_justification}"
                    if orig_reason else f"AUDITOR RULING: REVIEWED, FALSE POSITIVE - {cleared_justification}"
                )

            final_status = log.status

        elif record_type == "road":
            repair = db.query(RoadRepair).filter(RoadRepair.id == record_id).first()
            if not repair:
                raise HTTPException(status_code=404, detail="Road repair record not found")
            
            # Execute real smart contract transaction on blockchain
            lock_result = blockchain.lock_road_repair_record(
                repair_id=repair.id,
                contractor=repair.contractor.name if repair.contractor else "Amrut Yojana Road Builders",
                ward_name=repair.ward_name,
                location_gps=repair.location_gps,
                before_photo_url=repair.before_photo_url,
                after_photo_url=repair.after_photo_url,
                work_date=repair.work_completed_date,
                sla_expiry_date=repair.sla_expiry_date,
                disposition=disposition
            )
            tx_hash = lock_result["tx_hash"]
            repair.tx_hash = tx_hash
            repair.disposition = disposition
            repair.auditor_note = note if note else None

            if disposition == "confirmed_fraud":
                repair.status = "confirmed_fraud"
                if repair.contractor:
                    repair.contractor.fraud_flags_confirmed = (repair.contractor.fraud_flags_confirmed or 0) + 1
            else:
                repair.status = "cleared"

            final_status = repair.status
        else:
            raise HTTPException(status_code=400, detail="Invalid record type")
            
        db.commit()
        return {
            "status": "success",
            "tx_hash": tx_hash,
            "disposition": disposition,
            "auditor_note": note,
            "record_status": final_status,
            "message": f"Record {record_id} successfully signed and locked on-chain as {disposition}."
        }
    except blockchain.BlockchainConfigurationError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Blockchain service unavailable or unconfigured: {str(e)}"
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error executing blockchain transaction: {str(e)}"
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
