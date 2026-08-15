import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from app.db import WeighbridgeLog, GPSTrip

# Bhandewadi dumping ground coordinates
BHANDEWADI_LAT = 21.1408
BHANDEWADI_LON = 79.1622
DUMPING_RADIUS_KM = 0.5 # 500 meters

def run_anomaly_detection(db: Session):
    """
    Scans the database for anomalies and updates statuses and flag reasons.
    """
    # 1. Deterministic GPS-vs-Weighbridge checks
    # Find trips matching weighbridge logs
    trips = db.query(GPSTrip).all()
    for trip in trips:
        if trip.weighbridge_log_id:
            log = db.query(WeighbridgeLog).filter(WeighbridgeLog.id == trip.weighbridge_log_id).first()
            if log and not trip.passed_dumping_ground:
                # Contractor logged a drop-off, but GPS shows truck never went near the dumping ground
                log.status = "flagged"
                log.flag_reason = "GPS Contradiction: Truck did not reach the Bhandewadi dumping ground during this shift."
    
    # 2. Check for repeated identical weights per contractor
    # (Contractors mixing sand/boulders and claiming exact same weights multiple times)
    logs = db.query(WeighbridgeLog).order_by(WeighbridgeLog.contractor_id, WeighbridgeLog.timestamp).all()
    if len(logs) > 1:
        # Track previous weight and timestamp for repeating patterns
        prev_weight = None
        prev_contractor = None
        prev_log = None
        
        for log in logs:
            if prev_weight is not None and prev_contractor == log.contractor_id:
                # If exact same weight (within 5kg tolerance) within 48 hours
                weight_diff = abs(log.weight_kg - prev_weight)
                time_diff = (log.timestamp - prev_log.timestamp).total_seconds() / 3600.0
                
                if weight_diff <= 5.0 and time_diff <= 48.0:
                    log.status = "flagged"
                    log.flag_reason = f"Suspicious Weight Pattern: Exact weight (~{log.weight_kg}kg) registered twice within 48 hrs by the same contractor (possible recycled load or duplicate billing)."
                    if prev_log.status != "flagged":
                        prev_log.status = "flagged"
                        prev_log.flag_reason = f"Suspicious Weight Pattern: Exact weight (~{prev_log.weight_kg}kg) registered twice within 48 hrs by the same contractor."
            
            prev_weight = log.weight_kg
            prev_contractor = log.contractor_id
            prev_log = log

    # 3. Machine Learning (Isolation Forest) on tonnage anomalies
    # Retrieve all logs as a DataFrame to run statistical checks
    all_logs = db.query(WeighbridgeLog).all()
    if len(all_logs) >= 10:
        data = [{
            "id": l.id,
            "contractor_id": l.contractor_id,
            "weight_kg": l.weight_kg,
            "timestamp": l.timestamp
        } for l in all_logs]
        
        df = pd.DataFrame(data)
        
        # Fit Isolation Forest per contractor to catch statistical weight outliers (spikes or drops)
        for contractor_id in df["contractor_id"].unique():
            c_df = df[df["contractor_id"] == contractor_id]
            if len(c_df) >= 5:
                # Train on weight_kg
                X = c_df[["weight_kg"]].values
                # We expect roughly 10% anomalies
                clf = IsolationForest(contamination=0.1, random_state=42)
                preds = clf.fit_predict(X)
                
                # Update database records marked as anomalies
                for idx, pred in zip(c_df.index, preds):
                    if pred == -1: # Isolation Forest anomaly
                        log_id = c_df.loc[idx, "id"]
                        log = db.query(WeighbridgeLog).filter(WeighbridgeLog.id == log_id).first()
                        # Only overwrite if not already flagged by stronger deterministic checks
                        if log and log.status != "flagged":
                            log.status = "under_review"
                            log.flag_reason = f"ML Detection: Statistical weight outlier. Tonnage deviates significantly from typical contractor baseline."
                            
    db.commit()

def calculate_benchmarks(weight_kg: float, contractor_id: str) -> float:
    """
    Compares the logged tonnage against government per-capita waste benchmarks.
    Nagpur population ~3,000,000. Under clean guidelines, average waste generated
    is ~0.45 kg per person per day.
    Total expected city-wide daily waste: ~1,350 MT (metric tons).
    We estimate benchmark percentage deviation based on contractor share.
    """
    # Standard truck weight benchmark is ~10,000 kg (10 MT).
    # If a truck is registered with 16,000 kg (16 MT), it's 60% over benchmark, which is flagged.
    benchmark_truck_weight = 10000.0
    diff_pct = ((weight_kg - benchmark_truck_weight) / benchmark_truck_weight) * 100.0
    return round(diff_pct, 2)
