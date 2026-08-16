# AuditChain Nagpur — Frontend

> **Civic-Tech Municipal Audit & Tamper-Proof Cryptographic Verification Dashboard for Nagpur Municipal Corporation (NMC)**

AuditChain Nagpur exposes waste-contractor weighbridge fraud detection, road-repair SLA tracking, and cryptographic on-chain sealing of auditor rulings via Solidity smart contracts on EVM.

---

## 🏛️ Local Architecture & Ports

| Service | Port / URL | Description |
| :--- | :--- | :--- |
| **Frontend UI (Vite)** | `http://localhost:3000` | React 19 + TypeScript + Tailwind CSS |
| **Backend API (FastAPI)** | `http://127.0.0.1:8001` | SQLite DB, Anomaly ML, REST endpoints |
| **Local EVM Node (Anvil)** | `http://127.0.0.1:8545` | `AuditChain.sol` Smart Contract |

---

## 🚀 Quickstart & Local Run Instructions

### 1. Start the Backend API
```bash
cd backend
# Create and activate virtualenv
python -m venv .venv
.venv\Scripts\activate   # On Windows (or source .venv/bin/activate on Linux/Mac)

# Install dependencies
pip install -r requirements.txt

# Run initial seed and anomaly detection pipeline
python -m app.seed
python -m app.anomaly

# Start FastAPI server
python -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload
```

### 2. Start the Frontend Dev Server
```bash
cd frontend
# Install Node dependencies
npm install

# Start Vite dev server on port 3000
npm run dev
```

Open your browser at `http://localhost:3000`.

---

## 👥 Demo Accounts (1-Click Presets)

The login screen features 1-click credential presets for demo and jury evaluations:

| Role | Username | Password | Display Name | Access Scope |
| :--- | :--- | :--- | :--- | :--- |
| **Lead Auditor** | `auditor_nmc` | `auditor123` | NMC Lead Auditor | Full RBAC: on-chain rulings, contract sealing, database reseed |
| **Ward Officer** | `officer_ward7` | `officer123` | Ward Zone Officer | Telemetry review, case exhibit inspection, SLA tracking |
| **Citizen Public** | `citizen_nagpur` | `public123` | Public Transparency | Read-only ledger, citizen complaint filing on road repairs |
| **Anonymous Public** | *None* | *None* | Public Citizen | Direct access to Public Transparency portal without login |

---

## 🌟 Core Features & Modules

### 1. Zone Summary (`Overview.tsx`)
- **10 Nagpur Administrative Wards**: *Laxmi Nagar, Dharampeth, Hanuman Nagar, Dhantoli, Nehru Nagar, Gandhi Baugh, Sataranjipura, Lakadganj, Ashi Nagar, Mangalwari*.
- **Interactive Leaflet Map**: Severity-colored markers (`low` = forest green, `medium` = ochre, `high` = crimson) scaled by anomaly count with interactive popups.
- **April–July Tonnage Collapse Chart**: Recharts AreaChart visualizing the 6,400+ MT sudden drop with monetary spend tooltips.
- **Audited Contractor Quick Cards**: Fast navigation into contractor dossiers.

### 2. Contractor Performance Audit (`ContractorDetail.tsx`)
- **Contractor Tabs**: Switch between `Antony Waste Handling Cell Ltd` and `BVG India Pvt Ltd`.
- **Daily Tonnage Curve**: Area chart with reference generation targets (740 MT / 610 MT) and pulsing red dot markers on anomalous days.
- **Recent Filings Registry**: Table of the 10 most recent weighbridge tickets with 1-click inspection links.

### 3. Evidence Exhibits & GIS Telemetry (`FlaggedCases.tsx`)
- **Docket Slip Mockup**: Vehicle rated capacity deviation calculation, driver signature, filing timestamp.
- **Physical Boom-Barrier Gate Verification**: RFID badge checking entry against independent barrier logs.
- **GIS Route Analysis**: Polyline route mapping, 500m geofence around Bhandewadi MSW Dump Yard, and warning flags for routes that never visited the dump yard.
- **Auditor Ruling & Sealing Flow**: Lead Auditor can sign `confirmed_fraud` (mandatory note) or `cleared` on-chain via `/api/blockchain/lock`.

### 4. Road SLA Tracker (`RoadRepairs.tsx`)
- **Amrut Yojana Restorations**: Side-by-side before/after photo comparisons.
- **SLA Countdown**: Real-time days remaining vs. SLA breach indicators.
- **Citizen Complaint Filing**: Public submission with 10-char validation, client & server 409 duplication handling with `localStorage` persistence (`auditchain_reported_repairs`).
- **Dynamic Status**: Automatic flipping to `breached` when complaints cross threshold (> 3).

### 5. Public Transparency Portal (`PublicTransparency.tsx`)
- **Compliance Report Cards**: Grade calculation (F, D-, C+, B) based on verified fraud violations and claims.
- **Inquiry Timeline**: 2026 chronological investigation milestones.
- **Live Sealed Ledger Chronology**: Real-time querying of smart contract event records with verified transaction hashes.

### 6. Web3 Monospace Console (`Web3Console.tsx`)
- Fixed collapsible bottom terminal streaming cryptographic events, transaction hashes, and EVM status updates in real time.

---

## 🎨 Design System
- **Editorial Print Aesthetic**: Bespoke typography and contrast rules tailored for municipal audit reports.
- **Theme Support**: Seamless light and dark mode switching with DOM synchronization.
- **Zero Placeholder Images**: Fully populated with authentic GIS coordinates and municipal evidence exhibits.
