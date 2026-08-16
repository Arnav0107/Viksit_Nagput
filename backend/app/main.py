import os
import shutil
from fastapi import FastAPI, Depends, HTTPException, Query, status, Request, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import pandas as pd
from typing import List, Optional, Set
import uuid
import hashlib
from pydantic import BaseModel

from app.db import init_db, get_db, Contractor, WeighbridgeLog, GPSLog, GPSTrip, RoadRepair, Vehicle, DumpingGroundGateLog, CitizenComplaint
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
    
    # Blockchain startup health-check
    try:
        from app.blockchain import get_web3_client
        w3, contract, account = get_web3_client()
        address = contract.address
        bytecode = w3.eth.get_code(address)
        if not bytecode or bytecode == b'\x00' or bytecode == b'' or bytecode.hex() in ["0x", ""]:
            raise Exception(f"Contract address {address} has no deployed bytecode on the local blockchain.")
        print(f"[OK] Blockchain Health Check PASSED: Contract verified at {address}")
    except Exception as e:
        print("\n" + "!" * 80)
        print(" [WARNING BLOCKCHAIN UNREACHABLE] Startup health-check notice:")
        print(f" Error: {str(e)}")
        print(" Note: Backend will run in offline mode for blockchain operations.")
        print(" To enable on-chain locking, start Anvil and deploy contracts via scripts/setup_blockchain.ps1")
        print("!" * 80 + "\n")


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

def deploy_contract_on_chain():
    import os
    import subprocess
    import re
    from pathlib import Path

    user_profile = os.environ.get("USERPROFILE") or os.environ.get("HOME")
    forge_path = "forge"
    if user_profile:
        foundry_bin = Path(user_profile) / ".foundry" / "bin" / "forge"
        if os.name == 'nt':
            foundry_bin = foundry_bin.with_suffix('.exe')
        if foundry_bin.exists():
            forge_path = str(foundry_bin)

    project_root = Path(__file__).resolve().parent.parent.parent
    contracts_dir = project_root / "contracts"
    
    cmd = [
        forge_path,
        "create",
        "src/AuditChain.sol:AuditChain",
        "--rpc-url", "http://127.0.0.1:8545",
        "--private-key", "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
        "--broadcast"
    ]
    
    result = subprocess.run(cmd, cwd=str(contracts_dir), capture_output=True, text=True)
    if result.returncode != 0:
        raise Exception(f"Forge contract deployment failed: {result.stderr}")
        
    match = re.search(r"Deployed to:\s*(0x[0-9a-fA-F]{40})", result.stdout)
    if not match:
        raise Exception(f"Could not parse deployed contract address from forge output: {result.stdout}")
        
    new_address = match.group(1)
    
    env_path = project_root / "backend" / ".env"
    if env_path.exists():
        with open(env_path, "r", encoding="utf-8") as f:
            lines = f.readlines()
        
        updated = False
        for i, line in enumerate(lines):
            if line.startswith("CONTRACT_ADDRESS="):
                lines[i] = f"CONTRACT_ADDRESS={new_address}\n"
                updated = True
                break
        if not updated:
            lines.append(f"CONTRACT_ADDRESS={new_address}\n")
            
        with open(env_path, "w", encoding="utf-8") as f:
            f.writelines(lines)
            
    os.environ["CONTRACT_ADDRESS"] = new_address
    return new_address

@app.post("/api/admin/reseed")
def reseed_database(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("auditor"))
):
    """Reseeds the database and redeploys the smart contract fresh on the local blockchain (Auditor only)."""
    try:
        new_address = deploy_contract_on_chain()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to redeploy smart contract: {str(e)}"
        )
        
    from app.seed import seed_data
    seed_data(db)
    return {"status": "success", "message": f"Contract successfully redeployed at {new_address} and database reseeded."}

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
    zones = [
        "Laxmi Nagar",
        "Dharampeth",
        "Hanuman Nagar",
        "Dhantoli",
        "Nehru Nagar",
        "Gandhi Baugh",
        "Sataranjipura",
        "Lakadganj",
        "Ashi Nagar",
        "Mangalwari"
    ]
    ward_anomalies = {}
    for zone in zones:
        wb_logs = db.query(WeighbridgeLog).filter(WeighbridgeLog.zone == zone).all()
        repairs = db.query(RoadRepair).all()
        zone_repairs = [r for r in repairs if r.ward_name.replace(" Zone", "") == zone]
        
        flagged_wb = sum(1 for l in wb_logs if l.status == "flagged")
        breached_rr = sum(1 for r in zone_repairs if r.status == "breached")
        total_anomalies = flagged_wb + breached_rr
        
        under_review_wb = sum(1 for l in wb_logs if l.status == "under_review")
        active_rr = sum(1 for r in zone_repairs if r.status == "active")
        
        if flagged_wb > 0 or breached_rr > 0:
            severity = "high"
        elif under_review_wb > 0 or active_rr > 0:
            severity = "medium"
        else:
            severity = "low"
            
        details_parts = []
        if flagged_wb > 0:
            details_parts.append(f"{flagged_wb} flagged weighbridge log(s)")
        if breached_rr > 0:
            breached_complaints = sum(r.complaints_count for r in zone_repairs if r.status == "breached")
            details_parts.append(f"{breached_rr} road restoration SLA breach(es) ({breached_complaints} citizen complaints)")
        if under_review_wb > 0:
            details_parts.append(f"{under_review_wb} weighbridge log(s) under review")
        if active_rr > 0:
            active_complaints = sum(r.complaints_count for r in zone_repairs if r.status == "active")
            details_parts.append(f"{active_rr} road repair SLA(s) under active review ({active_complaints} citizen complaints)")
            
        if not details_parts:
            details = "All contractor ticket verification audits passing successfully."
        else:
            details = ", ".join(details_parts)
            
        ward_anomalies[zone] = {
            "anomalies": total_anomalies,
            "severity": severity,
            "details": details
        }

    # Calculate monthly tonnage history dynamically
    from collections import defaultdict
    monthly_groups = defaultdict(float)
    all_logs = db.query(WeighbridgeLog).all()
    for log in all_logs:
        month_name = log.timestamp.strftime("%B %Y")
        monthly_groups[month_name] += log.weight_kg / 1000.0

    month_order = {
        "April 2026": 1,
        "May 2026": 2,
        "June 2026": 3,
        "July 2026": 4
    }
    
    monthly_data = []
    sorted_months = sorted(monthly_groups.keys(), key=lambda m: month_order.get(m, 99))
    for m in sorted_months:
        tonnage_mt = round(monthly_groups[m], 2)
        spend_inr = round(tonnage_mt * 450.0, 2)
        monthly_data.append({
            "month": m,
            "tonnage_mt": tonnage_mt,
            "spend_inr": spend_inr
        })

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

def normalize_contractor(name: str) -> str:
    if not name:
        return ""
    n = name.lower()
    if "antony" in n:
        return "antony-waste"
    if "bvg" in n:
        return "bvg-india"
    if "amrut" in n or "yojana" in n:
        return "amrut-repairs"
    return n

@app.get("/api/blockchain/verify/{tx_hash}")
def verify_blockchain_record(tx_hash: str, db: Session = Depends(get_db)):
    """
    Queries local EVM and verifies data integrity between local DB and on-chain records.
    """
    try:
        w3, contract, account = blockchain.get_web3_client()
        tx = w3.eth.get_transaction(tx_hash)
        receipt = w3.eth.get_transaction_receipt(tx_hash)
        block = w3.eth.get_block(receipt['blockNumber'])
        timestamp_iso = datetime.fromtimestamp(block['timestamp']).isoformat()
    except blockchain.BlockchainConfigurationError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Blockchain service unavailable: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Transaction with hash {tx_hash} was not found on-chain."
        )

    wb_record = db.query(WeighbridgeLog).filter(WeighbridgeLog.tx_hash == tx_hash).first()
    rr_record = db.query(RoadRepair).filter(RoadRepair.tx_hash == tx_hash).first()
    
    if not wb_record and not rr_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No local database record found matching transaction hash {tx_hash}."
        )
        
    mismatches = []
    
    if wb_record:
        try:
            on_chain = contract.functions.getWeighbridgeRecord(wb_record.id).call()
            # on_chain: (ticketId, truckId, contractor, weightKg, timestamp, gpsRouteHash, dataHash, blockNumber, exists)
            if on_chain[0] != wb_record.id:
                mismatches.append(f"ticketId: Local '{wb_record.id}' vs On-Chain '{on_chain[0]}'")
            if on_chain[1] != wb_record.truck_id:
                mismatches.append(f"truckId: Local '{wb_record.truck_id}' vs On-Chain '{on_chain[1]}'")
            if normalize_contractor(on_chain[2]) != normalize_contractor(wb_record.contractor_id):
                mismatches.append(f"contractor: Local '{wb_record.contractor_id}' vs On-Chain '{on_chain[2]}'")
            if abs(on_chain[3] - round(wb_record.weight_kg)) > 0.1:
                mismatches.append(f"weightKg: Local '{wb_record.weight_kg}' vs On-Chain '{on_chain[3]}'")
            if abs(on_chain[4] - int(wb_record.timestamp.timestamp())) > 5:
                mismatches.append(f"timestamp: Local '{int(wb_record.timestamp.timestamp())}' vs On-Chain '{on_chain[4]}'")
        except Exception as e:
            mismatches.append(f"Failed to fetch or compare weighbridge record from contract: {str(e)}")
    else:
        try:
            on_chain = contract.functions.getRoadRepairRecord(rr_record.id).call()
            # on_chain: (repairId, contractor, wardName, locationGps, beforePhotoHash, afterPhotoHash, workDate, slaExpiryDate, complaintsCount, blockNumber, exists)
            if on_chain[0] != rr_record.id:
                mismatches.append(f"repairId: Local '{rr_record.id}' vs On-Chain '{on_chain[0]}'")
            if normalize_contractor(on_chain[1]) != normalize_contractor(rr_record.contractor_id):
                mismatches.append(f"contractor: Local '{rr_record.contractor_id}' vs On-Chain '{on_chain[1]}'")
            if on_chain[2] != rr_record.ward_name:
                mismatches.append(f"wardName: Local '{rr_record.ward_name}' vs On-Chain '{on_chain[2]}'")
            if on_chain[3] != rr_record.location_gps:
                mismatches.append(f"locationGps: Local '{rr_record.location_gps}' vs On-Chain '{on_chain[3]}'")
            
            disp_tag = rr_record.disposition or "cleared"
            expected_before_hash = blockchain.compute_data_hash(f"{rr_record.before_photo_url or 'NO_BEFORE_PHOTO'}|DISP:{disp_tag}")
            expected_after_hash = blockchain.compute_data_hash(f"{rr_record.after_photo_url or 'NO_AFTER_PHOTO'}|DISP:{disp_tag}")
            
            if on_chain[4] != expected_before_hash:
                mismatches.append(f"beforePhotoHash: Recomputed '{expected_before_hash}' vs On-Chain '{on_chain[4]}'")
            if on_chain[5] != expected_after_hash:
                mismatches.append(f"afterPhotoHash: Recomputed '{expected_after_hash}' vs On-Chain '{on_chain[5]}'")
                
            if abs(on_chain[6] - int(rr_record.work_completed_date.timestamp())) > 5:
                mismatches.append(f"workDate: Local '{int(rr_record.work_completed_date.timestamp())}' vs On-Chain '{on_chain[6]}'")
            if abs(on_chain[7] - int(rr_record.sla_expiry_date.timestamp())) > 5:
                mismatches.append(f"slaExpiryDate: Local '{int(rr_record.sla_expiry_date.timestamp())}' vs On-Chain '{on_chain[7]}'")
            if on_chain[8] != rr_record.complaints_count:
                mismatches.append(f"complaintsCount: Local '{rr_record.complaints_count}' vs On-Chain '{on_chain[8]}'")
        except Exception as e:
            mismatches.append(f"Failed to fetch or compare road repair record from contract: {str(e)}")

    integrity_match = len(mismatches) == 0

    return {
        "success": receipt['status'] == 1,
        "blockNumber": receipt['blockNumber'],
        "timestamp": timestamp_iso,
        "sender": tx['from'],
        "lockedHash": tx_hash,
        "integrity_match": integrity_match,
        "mismatches": mismatches
    }

# ---------------------------------------------------------
# Public Citizen Complaints API (Additive)
# ---------------------------------------------------------

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

@app.post("/api/complaints")
async def submit_citizen_complaint(
    photo: UploadFile = File(...),
    description: str = Form(...),
    repair_id: Optional[str] = Form(None),
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
    db: Session = Depends(get_db)
):
    """
    Public endpoint for citizens to submit road repair complaints with photos and optional GPS.
    Zero authentication required.
    """
    if not description or len(description.strip()) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Complaint description is required."
        )

    # Save photo file locally
    file_ext = os.path.splitext(photo.filename)[1] if photo.filename else ".jpg"
    if not file_ext:
        file_ext = ".jpg"
    filename = f"complaint_{uuid.uuid4().hex[:12]}{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(photo.file, buffer)

    photo_url = f"/uploads/{filename}"
    complaint_id = f"CMP-{uuid.uuid4().hex[:8].upper()}"

    new_complaint = CitizenComplaint(
        id=complaint_id,
        repair_id=repair_id.strip() if (repair_id and repair_id.strip()) else None,
        photo_url=photo_url,
        description=description.strip(),
        latitude=latitude,
        longitude=longitude,
        ai_category=None,
        ai_severity=None,
        ai_reasoning=None,
        status="submitted",
        created_at=datetime.utcnow()
    )

    db.add(new_complaint)
    db.commit()
    db.refresh(new_complaint)

    return {
        "id": new_complaint.id,
        "repair_id": new_complaint.repair_id,
        "photo_url": new_complaint.photo_url,
        "description": new_complaint.description,
        "latitude": new_complaint.latitude,
        "longitude": new_complaint.longitude,
        "ai_category": new_complaint.ai_category,
        "ai_severity": new_complaint.ai_severity,
        "ai_reasoning": new_complaint.ai_reasoning,
        "status": new_complaint.status,
        "created_at": new_complaint.created_at.isoformat() if new_complaint.created_at else None
    }

@app.get("/api/complaints")
def list_citizen_complaints(
    repair_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    List all citizen complaints, optionally filtered by repair_id.
    """
    query = db.query(CitizenComplaint)
    if repair_id and repair_id.strip():
        query = query.filter(CitizenComplaint.repair_id == repair_id.strip())
    complaints = query.order_by(CitizenComplaint.created_at.desc()).all()
    return [
        {
            "id": c.id,
            "repair_id": c.repair_id,
            "photo_url": c.photo_url,
            "description": c.description,
            "latitude": c.latitude,
            "longitude": c.longitude,
            "ai_category": c.ai_category,
            "ai_severity": c.ai_severity,
            "ai_reasoning": c.ai_reasoning,
            "status": c.status,
            "created_at": c.created_at.isoformat() if c.created_at else None
        }
        for c in complaints
    ]

@app.get("/api/complaints/{repair_id}")
def get_citizen_complaints_by_repair(
    repair_id: str,
    db: Session = Depends(get_db)
):
    """
    List complaints specific to a road repair ID.
    """
    complaints = db.query(CitizenComplaint).filter(CitizenComplaint.repair_id == repair_id).order_by(CitizenComplaint.created_at.desc()).all()
    return [
        {
            "id": c.id,
            "repair_id": c.repair_id,
            "photo_url": c.photo_url,
            "description": c.description,
            "latitude": c.latitude,
            "longitude": c.longitude,
            "ai_category": c.ai_category,
            "ai_severity": c.ai_severity,
            "ai_reasoning": c.ai_reasoning,
            "status": c.status,
            "created_at": c.created_at.isoformat() if c.created_at else None
        }
        for c in complaints
    ]

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
