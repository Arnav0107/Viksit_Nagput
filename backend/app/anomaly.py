import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Optional
from app.db import WeighbridgeLog, GPSTrip, Vehicle, DumpingGroundGateLog

# --- Geographic & Geofence Constants ---

# Latitude of the Bhandewadi Municipal Solid Waste (MSW) Landfill & Processing Plant in East Nagpur.
BHANDEWADI_LAT = 21.1408

# Longitude of the Bhandewadi Municipal Solid Waste (MSW) Landfill & Processing Plant in East Nagpur.
BHANDEWADI_LON = 79.1622

# Geofence perimeter radius (500m) surrounding the Bhandewadi waste facility, accounting for terminal access roads and commercial GPS circular error probable (CEP) accuracy.
DUMPING_RADIUS_KM = 0.5


# --- Weighbridge & Fleet Operation Constants ---

# Industrial electronic weighbridge sensor tolerance (0.1% to 0.15% of a ~10,000-15,000 kg rated truck capacity) per IS 14361 / OIML R76 Class III metrological specifications.
WEIGHBRIDGE_MEASUREMENT_TOLERANCE_KG = 15.0

# Standard municipal waste collection shift turnaround cycle per NMC operating guidelines, used as a fallback threshold when a truck has fewer than 3 GPS trips.
DEFAULT_TRIP_TURNAROUND_HOURS = 24.0

# Minimum sample size of completed GPS trips required to reliably compute a vehicle-specific empirical average turnaround duration.
MIN_HISTORICAL_TRIPS_FOR_AVERAGE = 3

# Documented default vehicle rated payload capacity constant (10,000 kg / 10 MT):
# Standard dual-axle municipal compactor truck rated payload benchmark per NMC / Swachh Bharat Mission fleet guidelines,
# used as a defensible baseline when vehicle-specific capacity telemetry is unspecified.
DEFAULT_VEHICLE_RATED_CAPACITY_KG = 10000.0
BENCHMARK_TRUCK_WEIGHT_KG = 10000.0

# Maximum permissible structural safety overload threshold percentage (+10% over rated gross payload capacity):
# Exceeding this threshold violates Central Motor Vehicles Rules (CMVR) axle-weight limits and signals vehicle overloading.
OVERLOAD_SAFETY_MARGIN_PCT = 10.0

# Operational checkpoint tolerance window (+/- 30 minutes) between truck GPS trip arrival and physical gate-barrier RFID timestamp at Bhandewadi facility entrance.
GATE_LOG_TOLERANCE_MINUTES = 30.0


# --- Statistical & Machine Learning Constants ---

# Minimum system-wide weighbridge observations required before running statistical and machine learning anomaly detection.
MIN_TOTAL_LOGS_FOR_ML = 10

# Minimum observations required per contractor to construct a statistically meaningful parametric baseline (sample mean and standard deviation).
MIN_CONTRACTOR_LOGS_FOR_ML = 5

# Primary statistical anomaly threshold corresponding to the ~99th percentile under a normal distribution (|z| > 2.5, p < 0.012), indicating extreme deviation from contractor baseline.
Z_SCORE_PRIMARY_THRESHOLD = 2.5

# Borderline statistical threshold (|z| > 1.5, ~86.6th percentile) required to corroborate and admit an Isolation Forest ML outlier flag, eliminating arbitrary fixed-contamination assumptions.
Z_SCORE_BORDERLINE_THRESHOLD = 1.5

# Reproducibility seed for Isolation Forest random partitioning.
ML_RANDOM_SEED = 42


def run_anomaly_detection(db: Session):
    """
    Scans the database for anomalies and updates statuses and flag reasons.
    Combines deterministic GPS-vs-weighbridge checks, dual-system gate-log verification cross-checks,
    vehicle capacity overloading checks, empirical repeated-weight tolerances, and defensible statistical z-score thresholds corroborated by Isolation Forest ML.
    """
    # 1. Deterministic GPS-vs-Weighbridge checks
    # Find trips matching weighbridge logs where GPS indicates dumping ground was never reached
    trips = db.query(GPSTrip).all()
    for trip in trips:
        if trip.weighbridge_log_id:
            log = db.query(WeighbridgeLog).filter(WeighbridgeLog.id == trip.weighbridge_log_id).first()
            if log and not trip.passed_dumping_ground:
                # Contractor logged a drop-off, but GPS shows truck never went near the dumping ground
                log.status = "flagged"
                log.flag_reason = "GPS Contradiction: Truck did not reach the Bhandewadi dumping ground during this shift."

    # 1b. Deterministic Independent Gate-Log Verification (Dual-System Verification)
    # Even if GPS telemetry claims the truck visited (passed_dumping_ground=True), cross-verify with independent physical boom-barrier RFID logs.
    gate_logs = db.query(DumpingGroundGateLog).all()
    tolerance_delta = timedelta(minutes=GATE_LOG_TOLERANCE_MINUTES)
    for trip in trips:
        if trip.weighbridge_log_id and trip.passed_dumping_ground:
            window_start = trip.start_time - tolerance_delta
            window_end = trip.end_time + tolerance_delta
            has_gate_match = any(
                gl.truck_id == trip.truck_id and window_start <= gl.entry_timestamp <= window_end
                for gl in gate_logs
            )
            if not has_gate_match:
                log = db.query(WeighbridgeLog).filter(WeighbridgeLog.id == trip.weighbridge_log_id).first()
                if log and log.status != "flagged":
                    log.status = "flagged"
                    log.flag_reason = (
                        f"Gate Verification Mismatch: GPS claims dumping-ground visit but no corresponding gate-log entry "
                        f"found for truck {trip.truck_id} at Bhandewadi checkpoint - possible GPS spoofing, unverified physical presence."
                    )

    # 2. Vehicle Overloading Check (Exceeding rated vehicle capacity by > 10% safety margin)
    # Distinct from benchmark deviation, gross structural overloading violates road safety specs and indicates billing manipulation.
    vehicles = {v.truck_id: v.rated_capacity_kg for v in db.query(Vehicle).all()}
    all_wb_logs = db.query(WeighbridgeLog).all()
    for log in all_wb_logs:
        cap = float(vehicles.get(log.truck_id, DEFAULT_VEHICLE_RATED_CAPACITY_KG))
        # Update deviation percentage dynamically against this specific vehicle's rated capacity
        log.benchmarked_difference_pct = round(((log.weight_kg - cap) / cap) * 100.0, 2)

        overload_limit = cap * (1.0 + OVERLOAD_SAFETY_MARGIN_PCT / 100.0)
        if log.weight_kg > overload_limit:
            excess_pct = ((log.weight_kg - cap) / cap) * 100.0
            if log.status != "flagged":
                log.status = "flagged"
                log.flag_reason = (
                    f"Vehicle Overloaded: {log.weight_kg:,.1f}kg recorded against {cap:,.0f}kg rated capacity "
                    f"(+{excess_pct:.1f}% over rated capacity, exceeding {OVERLOAD_SAFETY_MARGIN_PCT:.0f}% safety margin)."
                )

    # 3. Check for repeated identical weights per contractor
    # Detects possible recycled deadweight loads (e.g. static ballast/boulders billed multiple times)
    logs = db.query(WeighbridgeLog).order_by(WeighbridgeLog.contractor_id, WeighbridgeLog.timestamp).all()
    if len(logs) > 1:
        # Precompute contractor-specific historical weight standard deviations
        contractor_weights = {}
        for l in logs:
            if l.weight_kg is not None:
                contractor_weights.setdefault(l.contractor_id, []).append(l.weight_kg)
        
        contractor_stds = {}
        for cid, weights in contractor_weights.items():
            contractor_stds[cid] = float(np.std(weights, ddof=1)) if len(weights) >= 2 else 0.0

        # Precompute truck-specific historical average trip durations from GPSTrip start/end times
        # A truck cannot plausibly complete two independent collection sweeps faster than its observed trip time
        truck_trips = db.query(GPSTrip).all()
        truck_durations = {}
        for t in truck_trips:
            if t.start_time and t.end_time and t.end_time >= t.start_time:
                dur_hours = (t.end_time - t.start_time).total_seconds() / 3600.0
                truck_durations.setdefault(t.truck_id, []).append(dur_hours)

        truck_typical_trip_times = {}
        for tid, durs in truck_durations.items():
            if len(durs) >= MIN_HISTORICAL_TRIPS_FOR_AVERAGE:
                truck_typical_trip_times[tid] = float(np.mean(durs))
            else:
                # Fall back to documented default (24h) when truck has fewer than 3 historical trips
                truck_typical_trip_times[tid] = DEFAULT_TRIP_TURNAROUND_HOURS

        prev_weight = None
        prev_contractor = None
        prev_log = None

        for log in logs:
            if prev_weight is not None and prev_contractor == log.contractor_id and prev_log is not None:
                weight_diff = abs(log.weight_kg - prev_weight)
                time_diff = (log.timestamp - prev_log.timestamp).total_seconds() / 3600.0

                # Weight tolerance: Max of standard weighbridge measurement precision constant and contractor weight standard deviation.
                c_std = contractor_stds.get(log.contractor_id, 0.0)
                weight_tolerance = max(WEIGHBRIDGE_MEASUREMENT_TOLERANCE_KG, c_std)

                # Time window: Derived from the vehicle's historical average trip duration from GPS telemetry
                typical_trip_time = truck_typical_trip_times.get(log.truck_id, DEFAULT_TRIP_TURNAROUND_HOURS)

                if weight_diff <= weight_tolerance and time_diff <= typical_trip_time:
                    reason_str = (
                        f"Suspicious Weight Pattern: Weight difference {weight_diff:.1f}kg is within computed tolerance "
                        f"of {weight_tolerance:.1f}kg (weighbridge precision + contractor variance); "
                        f"recurred within {time_diff:.1f}h vs typical trip time of {typical_trip_time:.1f}h."
                    )
                    log.status = "flagged"
                    log.flag_reason = reason_str
                    if prev_log.status != "flagged":
                        prev_log.status = "flagged"
                        prev_log.flag_reason = reason_str

            prev_weight = log.weight_kg
            prev_contractor = log.contractor_id
            prev_log = log

    # 4. Statistical Z-Score Outlier Analysis corroborated by Isolation Forest ML
    all_logs = db.query(WeighbridgeLog).all()
    if len(all_logs) >= MIN_TOTAL_LOGS_FOR_ML:
        data = [{
            "id": l.id,
            "contractor_id": l.contractor_id,
            "weight_kg": l.weight_kg,
            "timestamp": l.timestamp
        } for l in all_logs if l.weight_kg is not None]

        df = pd.DataFrame(data)

        for contractor_id in df["contractor_id"].unique():
            c_df = df[df["contractor_id"] == contractor_id]
            if len(c_df) >= MIN_CONTRACTOR_LOGS_FOR_ML:
                c_mean = float(c_df["weight_kg"].mean())
                c_std = float(c_df["weight_kg"].std(ddof=1))

                # Compute per-contractor z-score for each weight reading
                if c_std > 0:
                    z_scores = (c_df["weight_kg"] - c_mean) / c_std
                else:
                    z_scores = pd.Series(0.0, index=c_df.index)

                # Fit Isolation Forest as secondary corroborating signal
                X = c_df[["weight_kg"]].values
                clf = IsolationForest(contamination="auto", random_state=ML_RANDOM_SEED)
                if_preds = clf.fit_predict(X)

                for idx, pred in zip(c_df.index, if_preds):
                    z = float(z_scores.loc[idx])
                    abs_z = abs(z)
                    is_if_anomaly = (pred == -1)

                    # Primary statistical cutoff is |z| > 2.5 (~99th percentile).
                    # Secondary corroboration: log only gets ML 'under_review' if Isolation Forest flags it (-1)
                    # AND the z-score independently confirms at least a borderline outlier (|z| >= 1.5).
                    if (is_if_anomaly and abs_z >= Z_SCORE_BORDERLINE_THRESHOLD) or (abs_z >= Z_SCORE_PRIMARY_THRESHOLD):
                        log_id = c_df.loc[idx, "id"]
                        log = db.query(WeighbridgeLog).filter(WeighbridgeLog.id == log_id).first()
                        # Only update if not already flagged by stronger deterministic checks
                        if log and log.status != "flagged":
                            log.status = "under_review"
                            log.flag_reason = (
                                f"ML Detection: Statistical weight outlier (|z|={abs_z:.2f} >= {Z_SCORE_BORDERLINE_THRESHOLD:.1f}, "
                                f"z-score: {z:+.2f}). Baseline mean: {c_mean:.1f}kg, std dev: {c_std:.1f}kg."
                            )

    db.commit()


def calculate_benchmarks(
    weight_kg: float,
    contractor_id: Optional[str] = None,
    truck_id: Optional[str] = None,
    db: Optional[Session] = None
) -> float:
    """
    Calculates percentage deviation of a logged truck weight against its specific vehicle rated capacity.
    If truck_id is provided, looks up rated_capacity_kg from the vehicles table.
    Falls back to DEFAULT_VEHICLE_RATED_CAPACITY_KG (10,000 kg standard dual-axle compactor)
    if vehicle is not found or truck_id is unspecified.
    """
    capacity = DEFAULT_VEHICLE_RATED_CAPACITY_KG
    if truck_id:
        if db is not None:
            vehicle = db.query(Vehicle).filter(Vehicle.truck_id == truck_id).first()
            if vehicle and vehicle.rated_capacity_kg:
                capacity = float(vehicle.rated_capacity_kg)
        else:
            try:
                from app.db import SessionLocal
                session = SessionLocal()
                vehicle = session.query(Vehicle).filter(Vehicle.truck_id == truck_id).first()
                if vehicle and vehicle.rated_capacity_kg:
                    capacity = float(vehicle.rated_capacity_kg)
                session.close()
            except Exception:
                capacity = DEFAULT_VEHICLE_RATED_CAPACITY_KG

    diff_pct = ((weight_kg - capacity) / capacity) * 100.0
    return round(diff_pct, 2)
