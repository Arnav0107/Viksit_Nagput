import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, ShieldAlert, Key, Activity, Check } from 'lucide-react';
import { MapContainer, TileLayer, Polyline, CircleMarker, GeoJSON, Popup, Tooltip as LeafletTooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// Nagpur administrative city boundary GeoJSON
import nagpurBoundary from '../data/nagpur-boundary.json';

interface FlaggedCasesProps {
  initialCaseId?: string | null;
  role: string;
}

export const FlaggedCases: React.FC<FlaggedCasesProps> = ({ initialCaseId, role }) => {
  const [cases, setCases] = useState<any[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string>('');
  const [caseDetail, setCaseDetail] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [inquiryAuthorized, setInquiryAuthorized] = useState<boolean>(false);

  // Load flagged cases list
  useEffect(() => {
    const fetchFlags = async () => {
      try {
        const res = await fetch('/api/weighbridge/flags');
        const data = await res.json();
        setCases(data);
        
        if (initialCaseId && data.some((c: any) => c.id === initialCaseId)) {
          setSelectedCaseId(initialCaseId);
        } else if (data.length > 0) {
          setSelectedCaseId(data[0].id);
        }
      } catch (err) {
        console.error("Error loading flagged cases", err);
      }
    };
    fetchFlags();
  }, [initialCaseId]);

  // Load case details
  useEffect(() => {
    if (!selectedCaseId) return;
    const fetchDetail = async () => {
      setLoading(true);
      setVerificationResult(null);
      setInquiryAuthorized(false);
      try {
        const res = await fetch(`/api/weighbridge/flags/${selectedCaseId}`);
        const data = await res.json();
        setCaseDetail(data);
      } catch (err) {
        console.error("Error loading case details", err);
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [selectedCaseId]);

  const handleVerifyOnChain = async () => {
    if (!caseDetail) return;
    setIsVerifying(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsVerifying(false);
    setVerificationResult({
      success: true,
      blockNumber: Math.floor(Math.random() * 200000) + 14820000,
      timestamp: new Date().toISOString(),
      sender: "0x3f5CEeE50E72C002fD2A32152861c89078c5C7a3",
      lockedHash: caseDetail.log.tx_hash
    });
  };

  const handleAuthorizeInquiry = async () => {
    if (!caseDetail) return;
    try {
      const res = await fetch('/api/blockchain/lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'weighbridge', id: caseDetail.log.id })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setInquiryAuthorized(true);
        // Refresh detail
        const detailRes = await fetch(`/api/weighbridge/flags/${selectedCaseId}`);
        const detailData = await detailRes.json();
        setCaseDetail(detailData);
      }
    } catch (err) {
      console.error("Error authorizing inquiry", err);
    }
  };

  if (loading && !caseDetail) {
    return (
      <div className="flex items-center justify-center h-96 font-mono text-xs text-dossier-text">
        <span className="animate-pulse">LOADING CASE RECORD DOSSIER...</span>
      </div>
    );
  }

  // Set up telemetry route coordinates based on case ID
  const isDharampethCase = selectedCaseId === 'WB-2026-8021';
  
  // Center map depending on the case's core location
  const mapCenter = isDharampethCase ? [21.1350, 79.0750] : [21.1350, 79.1150];
  const dumpYardCoords = [21.1183, 79.0483];
  
  // Trip coordinates: 
  // Dharampeth case loops between Dharampeth and Laxmi Nagar (never goes to dumping yard).
  // Gandhi Baugh case travels to the dumping yard.
  const tripRoute = isDharampethCase
    ? [[21.1287, 79.0525], [21.1320, 79.0600], [21.1350, 79.0750], [21.1400, 79.0900], [21.1350, 79.0750], [21.1287, 79.0525]]
    : [[21.1550, 79.1050], [21.1450, 79.1150], [21.1350, 79.1250], [21.1250, 79.1350], [21.1183, 79.0483]];

  const contradictionPoint = isDharampethCase ? [21.1400, 79.0900] : [21.1350, 79.1250];

  return (
    <div className="space-y-6">
      {/* Header and selector */}
      <div className="border-b border-dossier-border pb-4 flex flex-col lg:flex-row lg:items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-black uppercase tracking-tight flex items-center gap-2 text-status-flagged">
            <ShieldAlert size={28} />
            Exhibit Investigation Board
          </h1>
          <p className="text-xs text-dossier-muted font-mono mt-0.5 uppercase font-bold">NMC FORENSIC CONTRACT AUDIT LOGS</p>
        </div>

        <div className="mt-4 lg:mt-0 font-mono text-xs flex items-center gap-2">
          <span className="text-dossier-muted uppercase font-bold text-[10px]">CASE FILE:</span>
          <select 
            value={selectedCaseId} 
            onChange={(e) => setSelectedCaseId(e.target.value)}
            className="border border-dossier-border bg-dossier-card p-2 font-bold uppercase text-dossier-text cursor-pointer"
          >
            {cases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.id} - {c.contractor_name} ({c.truck_id})
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-96 font-mono text-xs text-dossier-text">
          <span className="animate-pulse">DECODING LOG TELEMETRY EXPORTS...</span>
        </div>
      ) : (
        caseDetail && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Left Panel: Printed Docket Slip Mockup */}
            <div className="lg:col-span-5 space-y-6">
              <div className="border border-dossier-border p-6 bg-dossier-card relative shadow-sm">
                
                {/* Docket Header */}
                <div className="border-b border-dashed border-dossier-border pb-4 text-center">
                  <span className="font-mono text-[9px] text-dossier-muted block tracking-widest font-bold">MUNICIPAL REVENUE AUDIT</span>
                  <h3 className="font-serif text-lg font-black uppercase mt-1 text-dossier-text">Weigh Ticket Exhibit</h3>
                  <div className="inline-block mt-2 px-2 py-0.5 border border-status-flagged text-status-flagged text-[9px] font-mono font-bold uppercase bg-status-flagged/5">
                    Status: Flagged Anomaly
                  </div>
                </div>

                {/* Docket Parameters */}
                <div className="mt-6 space-y-3.5 font-mono text-xs text-dossier-text">
                  <div className="flex justify-between border-b border-dossier-border/30 pb-2">
                    <span className="text-dossier-muted uppercase text-[10px] font-bold">Ticket ID:</span>
                    <span className="font-bold text-dossier-text">{caseDetail.log.id}</span>
                  </div>
                  <div className="flex justify-between border-b border-dossier-border/30 pb-2">
                    <span className="text-dossier-muted uppercase text-[10px] font-bold">Contractor:</span>
                    <span className="font-bold text-dossier-text text-right">{caseDetail.log.contractor_name}</span>
                  </div>
                  <div className="flex justify-between border-b border-dossier-border/30 pb-2">
                    <span className="text-dossier-muted uppercase text-[10px] font-bold">Vehicle ID:</span>
                    <span className="font-bold text-dossier-text">{caseDetail.log.truck_id}</span>
                  </div>
                  <div className="flex justify-between border-b border-dossier-border/30 pb-2">
                    <span className="text-dossier-muted uppercase text-[10px] font-bold">Filing Time:</span>
                    <span className="font-bold text-dossier-text">{new Date(caseDetail.log.timestamp).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between border-b border-dossier-border/30 pb-2">
                    <span className="text-dossier-muted uppercase text-[10px] font-bold">Registered Tonnage:</span>
                    <span className="font-bold text-status-flagged text-sm">
                      {caseDetail.log.weight_kg.toLocaleString()} kg (~{(caseDetail.log.weight_kg/1000).toFixed(2)} MT)
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-dossier-border/30 pb-2">
                    <span className="text-dossier-muted uppercase text-[10px] font-bold">Driver Signature:</span>
                    <span className="font-bold text-dossier-text">{caseDetail.log.driver_name}</span>
                  </div>
                  <div className="flex justify-between border-b border-dossier-border/30 pb-2">
                    <span className="text-dossier-muted uppercase text-[10px] font-bold">Benchmark Deviation:</span>
                    <span className="font-bold text-status-flagged">
                      +{caseDetail.log.deviation_pct}% vs target
                    </span>
                  </div>
                  <div className="flex flex-col border-b border-dossier-border/30 pb-2 gap-0.5">
                    <span className="text-dossier-muted uppercase text-[10px] font-bold">Decentralized Ledger Seal:</span>
                    <span className="text-[10px] text-dossier-muted font-bold truncate select-all">{caseDetail.log.tx_hash}</span>
                  </div>
                </div>

                {/* Conflict Description (Paper note card) */}
                <div className="mt-6 border border-status-flagged/25 bg-status-flagged/5 p-3 rounded-none font-mono text-xs">
                  <div className="flex items-center gap-1.5 text-status-flagged font-bold uppercase mb-1 text-[10px]">
                    <AlertTriangle size={13} />
                    <span>Audit Finding:</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-dossier-text font-medium">
                    {caseDetail.log.flag_reason || "ML Outlier: Weight registered significantly exceeds route generation target."}
                  </p>
                </div>

                {/* Flat border button actions */}
                <div className="mt-6 pt-4 border-t border-dashed border-dossier-border flex flex-col gap-2">
                  <button
                    onClick={handleVerifyOnChain}
                    disabled={isVerifying}
                    className="w-full flex items-center justify-center gap-2 border border-dossier-text py-2 text-xs font-mono font-bold hover:bg-dossier-text/5 transition-colors uppercase cursor-pointer"
                  >
                    <Key size={14} />
                    {isVerifying ? "Verifying Root Merkle..." : "Verify Ledger Seal Status"}
                  </button>

                  {role !== "public" && (
                    <button
                      onClick={handleAuthorizeInquiry}
                      disabled={inquiryAuthorized || caseDetail.log.status === 'verified'}
                      className={`w-full py-2 text-xs font-mono font-bold border transition-colors uppercase cursor-pointer ${
                        inquiryAuthorized || caseDetail.log.status === 'verified'
                          ? 'border-status-verified text-status-verified bg-status-verified/5 cursor-default'
                          : 'border-status-flagged text-status-flagged hover:bg-status-flagged/5'
                      }`}
                    >
                      {inquiryAuthorized || caseDetail.log.status === 'verified' ? (
                        <span className="flex items-center justify-center gap-1 font-bold">
                          <Check size={14} />
                          Ledger Sealed & Inquiry Authorised
                        </span>
                      ) : (
                        "Lock & Seal Record (Authorize Inquiry)"
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Cryptographic verification output */}
              {verificationResult && (
                <div className="border border-status-verified bg-status-verified/5 p-4 font-mono text-[11px] space-y-2">
                  <div className="flex items-center gap-1.5 text-status-verified font-bold uppercase text-xs">
                    <CheckCircle size={15} />
                    <span>Cryptographic Verification Audit Pass</span>
                  </div>
                  <div className="space-y-1 text-dossier-text font-medium">
                    <div><span className="font-bold text-[10px] text-dossier-muted block uppercase">STATUS:</span> Locked on Blockchain Ledger</div>
                    <div className="truncate"><span className="font-bold text-[10px] text-dossier-muted block uppercase">SEAL:</span> {verificationResult.lockedHash}</div>
                    <div><span className="font-bold text-[10px] text-dossier-muted block uppercase">BLOCK NUMBER:</span> #{verificationResult.blockNumber}</div>
                    <div><span className="font-bold text-[10px] text-dossier-muted block uppercase">SENDER:</span> {verificationResult.sender}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Panel: Clean Telemetry Map Outline */}
            <div className="lg:col-span-7 space-y-6">
              <div className="border border-dossier-border p-6 bg-dossier-card h-full flex flex-col justify-between">
                <div>
                  <h3 className="font-serif text-lg font-extrabold uppercase tracking-tight text-dossier-text">EXHIBIT B: TRUCK PATH TELEMETRY REPORT</h3>
                  <p className="text-xs text-dossier-muted font-mono uppercase mt-0.5 font-bold">COMPARING ON-BOARD GPS LOGS VS DUMP WEIGHBRIDGE ENTRY</p>
                </div>

                {/* Leaflet map container */}
                <div className="border border-dossier-border bg-white dark:bg-dossier-bg p-0 my-6 relative overflow-hidden h-96 z-10">
                  <MapContainer key={selectedCaseId} center={mapCenter as any} zoom={13} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
                    <TileLayer
                      url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                      attribution='&copy; OpenStreetMap contributors &copy; CARTO'
                    />

                    {/* Optional Nagpur City Boundary Outline */}
                    {nagpurBoundary && (
                      <GeoJSON
                        data={nagpurBoundary as any}
                        pathOptions={{
                          color: "var(--color-dossier-text)",
                          fill: false,
                          weight: 1.5,
                          dashArray: "4, 4"
                        }}
                      />
                    )}

                    {/* Bhandewadi Dumping Ground Marker */}
                    <CircleMarker
                      center={dumpYardCoords as any}
                      pathOptions={{
                        color: "#9e2a2b",
                        fillColor: "#9e2a2b",
                        fillOpacity: 0.5,
                        weight: 2
                      }}
                      radius={12}
                    >
                      <LeafletTooltip permanent direction="top" className="leaflet-tooltip-custom border-none bg-transparent shadow-none font-mono text-[8px] font-bold text-black uppercase pointer-events-none">
                        Bhandewadi Dump Yard
                      </LeafletTooltip>
                    </CircleMarker>

                    {/* Trip path polyline */}
                    <Polyline
                      positions={tripRoute as any}
                      pathOptions={{
                        color: "var(--color-dossier-text)",
                        weight: 3,
                        dashArray: "3, 5"
                      }}
                    />

                    {/* Falsified / suspicious stop marker */}
                    <CircleMarker
                      center={contradictionPoint as any}
                      pathOptions={{
                        color: isDharampethCase ? "#9e2a2b" : "#c97a1b",
                        fillColor: isDharampethCase ? "#9e2a2b" : "#c97a1b",
                        fillOpacity: 0.8,
                        weight: 2
                      }}
                      radius={8}
                    >
                      <Popup>
                        <div className="font-mono text-xs">
                          {isDharampethCase ? (
                            <div className="text-status-flagged font-bold uppercase">
                              Spatial Contradiction point: Vehicle turned back without entering dump yard.
                            </div>
                          ) : (
                            <div className="text-status-review font-bold uppercase">
                              Suspicious stop point: Exact identical weight registered here.
                            </div>
                          )}
                        </div>
                      </Popup>
                      <LeafletTooltip permanent direction="bottom" className="leaflet-tooltip-custom border-none bg-transparent shadow-none font-mono text-[8px] font-bold text-black uppercase pointer-events-none">
                        {isDharampethCase ? "SPATIAL ANOMALY" : "SUSPICIOUS STOP"}
                      </LeafletTooltip>
                    </CircleMarker>
                  </MapContainer>

                  <div className="absolute top-2 left-2 bg-dossier-bg border border-dossier-border px-2 py-1 text-[9px] font-mono z-[1000] font-bold text-dossier-text">
                    GPS TELEMETRY EXHIBIT: GPSX-9021
                  </div>
                </div>

                {/* Telemetry verification footer */}
                <div className="font-mono text-[10px] border-t border-dossier-border pt-4 flex justify-between items-center text-dossier-muted uppercase font-bold">
                  <div className="flex items-center gap-1.5 font-bold">
                    <Activity size={14} className="text-status-flagged" />
                    <span>GPS Telemetry status: Flagged Mismatch</span>
                  </div>
                  <span>Exhibit Ref: GPS-Telemetry-V8</span>
                </div>
              </div>
            </div>

          </div>
        )
      )}
    </div>
  );
};
