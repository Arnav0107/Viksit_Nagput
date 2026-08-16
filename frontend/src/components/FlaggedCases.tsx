import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, ShieldAlert, Key, Activity, Check, MapPin, ShieldCheck, DoorClosed, X, Send, Gavel } from 'lucide-react';
import { MapContainer, TileLayer, Polyline, CircleMarker, GeoJSON, Popup, Tooltip as LeafletTooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// Nagpur administrative city boundary GeoJSON
import nagpurBoundary from '../data/nagpur-boundary.json';

interface FlaggedCasesProps {
  initialCaseId?: string | null;
  role: string;
  token?: string | null;
  onAuthError?: (errMessage: string) => void;
}

export const FlaggedCases: React.FC<FlaggedCasesProps> = ({ initialCaseId, role, token, onAuthError }) => {
  const [cases, setCases] = useState<any[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string>(initialCaseId || '');
  const [caseDetail, setCaseDetail] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [verificationResult, setVerificationResult] = useState<any>(null);

  // Auditor Ruling flow state
  const [activeRuling, setActiveRuling] = useState<'confirmed_fraud' | 'cleared' | null>(null);
  const [rulingNote, setRulingNote] = useState<string>('');
  const [rulingError, setRulingError] = useState<string>('');
  const [isSubmittingRuling, setIsSubmittingRuling] = useState<boolean>(false);

  // Load complete weighbridge cases list on mount
  useEffect(() => {
    const fetchFlags = async () => {
      try {
        const res = await fetch('/api/weighbridge/flags?all_logs=true');
        const data = await res.json();
        setCases(data);
        
        if (initialCaseId) {
          setSelectedCaseId(initialCaseId);
        } else if (data.length > 0 && !selectedCaseId) {
          setSelectedCaseId(data[0].id);
        }
      } catch (err) {
        console.error("Error loading flagged cases", err);
      }
    };
    fetchFlags();
  }, []);

  // Update selectedCaseId whenever parent passes a new initialCaseId
  useEffect(() => {
    if (initialCaseId) {
      setSelectedCaseId(initialCaseId);
    }
  }, [initialCaseId]);

  // Load specific case details whenever selectedCaseId changes
  useEffect(() => {
    if (!selectedCaseId) return;
    const fetchDetail = async () => {
      setLoading(true);
      setVerificationResult(null);
      setActiveRuling(null);
      setRulingNote('');
      setRulingError('');
      try {
        const res = await fetch(`/api/weighbridge/flags/${selectedCaseId}`);
        if (!res.ok) {
          throw new Error(`Failed to fetch case ${selectedCaseId}`);
        }
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
    if (!caseDetail || !caseDetail.log.tx_hash) return;
    setIsVerifying(true);
    try {
      const res = await fetch(`/api/blockchain/verify/${caseDetail.log.tx_hash}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to query the blockchain node.");
      }
      const data = await res.json();
      setVerificationResult(data);
    } catch (err: any) {
      console.error(err);
      setVerificationResult({
        success: false,
        blockNumber: 0,
        sender: "UNVERIFIED",
        lockedHash: caseDetail.log.tx_hash,
        integrity_match: false,
        mismatches: [err.message || "Failed to query the blockchain node."]
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleExecuteRuling = async (dispositionType: 'confirmed_fraud' | 'cleared') => {
    if (!caseDetail) return;
    const trimmedNote = rulingNote.trim();

    if (dispositionType === 'confirmed_fraud' && !trimmedNote) {
      setRulingError("An auditor justification note is required to confirm a fraud violation.");
      return;
    }

    setIsSubmittingRuling(true);
    setRulingError('');

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/blockchain/lock', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          type: 'weighbridge',
          id: caseDetail.log.id,
          disposition: dispositionType,
          note: trimmedNote
        })
      });

      if (res.status === 401 || res.status === 403) {
        const errData = await res.json().catch(() => ({}));
        onAuthError?.(errData.detail || 'Authorization failed. Only auditors can seal records on-chain.');
        return;
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setRulingError(errData.detail || 'Failed to submit on-chain ruling.');
        return;
      }

      const data = await res.json();
      if (data.status === 'success') {
        setActiveRuling(null);
        setRulingNote('');
        // Refresh case details and cases list
        const detailRes = await fetch(`/api/weighbridge/flags/${selectedCaseId}`);
        const detailData = await detailRes.json();
        setCaseDetail(detailData);

        const listRes = await fetch('/api/weighbridge/flags?all_logs=true');
        const listData = await listRes.json();
        setCases(listData);
      }
    } catch (err: any) {
      console.error("Error executing ruling", err);
      setRulingError(err.message || "Failed to broadcast transaction to blockchain.");
    } finally {
      setIsSubmittingRuling(false);
    }
  };

  // Derive coordinates from the actual case GPS telemetry
  const dumpYardCoords: [number, number] = [21.1408, 79.1622]; // Bhandewadi MSW facility
  
  const tripRoute: [number, number][] = (caseDetail?.gps_path && caseDetail.gps_path.length > 0)
    ? caseDetail.gps_path.map((p: any) => [p.lat, p.lng] as [number, number])
    : [[21.1517, 79.0734], [21.1408, 79.1622]];

  const mapCenter: [number, number] = tripRoute.length > 0
    ? tripRoute[Math.floor(tripRoute.length / 2)]
    : [21.1408, 79.1622];

  const startPoint = tripRoute.length > 0 ? tripRoute[0] : null;
  const endPoint = tripRoute.length > 0 ? tripRoute[tripRoute.length - 1] : null;

  const statusStr = caseDetail?.log?.status || '';
  const isConfirmedFraud = statusStr === 'confirmed_fraud';
  const isCleared = statusStr === 'cleared';
  const isFlagged = statusStr === 'flagged';
  const isUnderReview = statusStr === 'under_review';
  const isVerified = statusStr === 'verified';
  const isRuledOn = isConfirmedFraud || isCleared;
  const isFlaggedOrReview = isFlagged || isUnderReview;
  const isGPSContradiction = caseDetail?.trip && !caseDetail.trip.passed_dumping_ground;

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
            className="border border-dossier-border bg-dossier-card p-2 font-bold uppercase text-dossier-text cursor-pointer max-w-xs truncate"
          >
            {selectedCaseId && !cases.some(c => c.id === selectedCaseId) && (
              <option value={selectedCaseId}>
                {selectedCaseId} - Selected Filing
              </option>
            )}
            {cases.map((c) => {
              const statusTag = c.status === 'confirmed_fraud' 
                ? 'VIOLATION' 
                : c.status === 'cleared'
                  ? 'CLEARED'
                  : c.status === 'flagged' 
                    ? 'FLAGGED' 
                    : c.status === 'under_review' 
                      ? 'REVIEW' 
                      : 'SECURED';
              return (
                <option key={c.id} value={c.id}>
                  [{statusTag}] {c.id} - {c.contractor_name} ({c.truck_id})
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {loading && !caseDetail ? (
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
                  <div className={`inline-block mt-2 px-2 py-0.5 border text-[9px] font-mono font-bold uppercase ${
                    isConfirmedFraud || isFlagged
                      ? 'border-status-flagged text-status-flagged bg-status-flagged/5'
                      : isUnderReview
                        ? 'border-status-review text-status-review bg-status-review/5'
                        : 'border-status-verified text-status-verified bg-status-verified/5'
                  }`}>
                    Status: {
                      isConfirmedFraud
                        ? 'Confirmed Fraud Violation (Sealed)'
                        : isCleared
                          ? 'False Positive Cleared (Sealed)'
                          : isFlagged
                            ? 'Flagged Anomaly'
                            : isUnderReview
                              ? 'ML Outlier Under Review'
                              : 'Verified & Secured'
                    }
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
                    <span className={`font-bold text-sm ${isConfirmedFraud || isFlagged ? 'text-status-flagged' : isUnderReview ? 'text-status-review' : 'text-status-verified'}`}>
                      {caseDetail.log.weight_kg.toLocaleString()} kg (~{(caseDetail.log.weight_kg/1000).toFixed(2)} MT)
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-dossier-border/30 pb-2">
                    <span className="text-dossier-muted uppercase text-[10px] font-bold">Driver Signature:</span>
                    <span className="font-bold text-dossier-text">{caseDetail.log.driver_name}</span>
                  </div>
                  <div className="flex justify-between border-b border-dossier-border/30 pb-2">
                    <span className="text-dossier-muted uppercase text-[10px] font-bold">Rated Capacity Deviation:</span>
                    <span className={`font-bold ${caseDetail.log.deviation_pct > 10 ? 'text-status-flagged' : 'text-dossier-text'}`}>
                      {caseDetail.log.deviation_pct >= 0 ? '+' : ''}{caseDetail.log.deviation_pct}% vs rated
                    </span>
                  </div>
                  <div className="flex flex-col border-b border-dossier-border/30 pb-2 gap-0.5">
                    <span className="text-dossier-muted uppercase text-[10px] font-bold">Decentralized Ledger Seal:</span>
                    <span className="text-[10px] text-dossier-muted font-bold truncate select-all">{caseDetail.log.tx_hash || 'Unsealed / Pending'}</span>
                  </div>
                </div>

                {/* Conflict Description / Audit Finding */}
                <div className={`mt-6 border p-3 rounded-none font-mono text-xs ${
                  isConfirmedFraud || isFlagged
                    ? 'border-status-flagged/25 bg-status-flagged/5'
                    : isUnderReview
                      ? 'border-status-review/25 bg-status-review/5'
                      : 'border-status-verified/25 bg-status-verified/5'
                }`}>
                  <div className={`flex items-center gap-1.5 font-bold uppercase mb-1 text-[10px] ${
                    isConfirmedFraud || isFlagged ? 'text-status-flagged' : isUnderReview ? 'text-status-review' : 'text-status-verified'
                  }`}>
                    {isConfirmedFraud || isFlagged ? <AlertTriangle size={13} /> : isUnderReview ? <Activity size={13} /> : <CheckCircle size={13} />}
                    <span>Audit Finding & Ruling:</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-dossier-text font-medium break-words">
                    {caseDetail.log.flag_reason || "Audit Check Passed: GPS telemetry confirms Bhandewadi dump yard drop-off, physical gate RFID entry verified, and weight is within expected contractor tolerance limits."}
                  </p>
                </div>

                {/* Independent Gate Verification Evidence */}
                {caseDetail.gate_log && (
                  <div className={`mt-3 border p-2.5 rounded-none font-mono text-[10px] flex items-center justify-between ${
                    caseDetail.gate_log.verified
                      ? 'border-status-verified/30 bg-status-verified/5 text-status-verified'
                      : 'border-status-flagged/30 bg-status-flagged/5 text-status-flagged'
                  }`}>
                    <div className="flex items-center gap-1.5 font-bold">
                      {caseDetail.gate_log.verified ? <DoorClosed size={12} /> : <AlertTriangle size={12} />}
                      <span>PHYSICAL GATE BOOM-BARRIER:</span>
                    </div>
                    <span className="font-bold">
                      {caseDetail.gate_log.verified
                        ? `ENTRY CONFIRMED (${caseDetail.gate_log.details?.gate_id || 'GATE-1'})`
                        : 'NO ENTRY RECORD FOUND'}
                    </span>
                  </div>
                )}

                {/* ========================================================================= */}
                {/* AUDITOR RULING & ON-CHAIN ACTIONS */}
                {/* ========================================================================= */}
                <div className="mt-6 pt-4 border-t border-dashed border-dossier-border space-y-3">
                  
                  {/* Verify status button (read-only EVM check) */}
                  <button
                    onClick={handleVerifyOnChain}
                    disabled={isVerifying || !caseDetail.log.tx_hash}
                    className="w-full flex items-center justify-center gap-2 border border-dossier-text py-2 text-xs font-mono font-bold hover:bg-dossier-text/5 transition-colors uppercase cursor-pointer disabled:opacity-50"
                  >
                    <Key size={14} />
                    {isVerifying ? "Verifying Root Merkle..." : "Verify Ledger Seal Status"}
                  </button>

                  {/* 1. CASE ALREADY RULED UPON (READ-ONLY DISPLAY) */}
                  {isRuledOn && (
                    <div className={`p-3 border font-mono text-xs space-y-1.5 ${
                      isConfirmedFraud 
                        ? 'border-status-flagged bg-status-flagged/10 text-status-flagged' 
                        : 'border-status-verified bg-status-verified/10 text-status-verified'
                    }`}>
                      <div className="flex items-center gap-1.5 font-bold uppercase text-[11px]">
                        <Gavel size={14} />
                        <span>
                          {isConfirmedFraud ? "RULING: CONFIRMED FRAUD VIOLATION" : "RULING: DISMISSED AS FALSE POSITIVE"}
                        </span>
                      </div>
                      <p className="text-[10px] text-dossier-text font-medium">
                        <strong className="text-dossier-muted uppercase">Auditor Note:</strong> {caseDetail.log.auditor_note || "No justification provided."}
                      </p>
                      <p className="text-[9px] text-dossier-muted truncate font-bold">
                        EVM Seal Tx: {caseDetail.log.tx_hash}
                      </p>
                    </div>
                  )}

                  {/* 2. FLAGGED OR UNDER REVIEW CASE - AUDITOR RULING ACTIONS */}
                  {role === 'auditor' && isFlaggedOrReview && !isRuledOn && (
                    <div className="space-y-2">
                      {/* If no ruling active, show the two action buttons */}
                      {!activeRuling && (
                        <div className="space-y-2">
                          <span className="font-mono text-[10px] text-dossier-muted block uppercase font-bold text-center">
                            Lead Auditor Forensic Ruling Required:
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <button
                              onClick={() => { setActiveRuling('confirmed_fraud'); setRulingNote(''); setRulingError(''); }}
                              className="w-full flex items-center justify-center gap-1.5 py-2 px-2 text-[10px] font-mono font-bold border border-status-flagged text-status-flagged bg-status-flagged/5 hover:bg-status-flagged/15 transition-colors uppercase cursor-pointer"
                            >
                              <ShieldAlert size={13} />
                              <span>Confirm Violation & Seal</span>
                            </button>

                            <button
                              onClick={() => { setActiveRuling('cleared'); setRulingNote(''); setRulingError(''); }}
                              className="w-full flex items-center justify-center gap-1.5 py-2 px-2 text-[10px] font-mono font-bold border border-status-verified text-status-verified bg-status-verified/5 hover:bg-status-verified/15 transition-colors uppercase cursor-pointer"
                            >
                              <CheckCircle size={13} />
                              <span>Dismiss as False Positive & Seal</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Active Ruling Input Dialog */}
                      {activeRuling && (
                        <div className={`border p-3 space-y-2.5 font-mono text-xs ${
                          activeRuling === 'confirmed_fraud' 
                            ? 'border-status-flagged bg-status-flagged/5' 
                            : 'border-status-verified bg-status-verified/5'
                        }`}>
                          <div className="flex justify-between items-center">
                            <span className={`font-bold uppercase text-[10px] flex items-center gap-1 ${
                              activeRuling === 'confirmed_fraud' ? 'text-status-flagged' : 'text-status-verified'
                            }`}>
                              <Gavel size={12} />
                              <span>
                                {activeRuling === 'confirmed_fraud'
                                  ? "Ruling: Confirm Fraud Violation"
                                  : "Ruling: Dismiss as False Positive"}
                              </span>
                            </span>
                            <span className="text-[9px] text-dossier-muted font-bold">
                              {activeRuling === 'confirmed_fraud' ? "Required" : "Optional"}
                            </span>
                          </div>

                          <textarea
                            value={rulingNote}
                            onChange={(e) => { setRulingNote(e.target.value); setRulingError(''); }}
                            placeholder={
                              activeRuling === 'confirmed_fraud'
                                ? "State your forensic ruling justification (e.g. GPS route contradiction verified against checkpoint CCTV; billing penalty imposed)..."
                                : "State clearance explanation (e.g. valid route deviation due to road work; manual log verified)..."
                            }
                            rows={3}
                            className="w-full bg-dossier-bg border border-dossier-border p-2 font-mono text-xs text-dossier-text placeholder:text-dossier-muted focus:outline-none resize-none"
                            autoFocus
                            disabled={isSubmittingRuling}
                          />

                          {rulingError && (
                            <div className="font-mono text-[10px] font-bold text-status-flagged bg-status-flagged/10 border border-status-flagged/30 p-1.5 flex items-center gap-1">
                              <AlertTriangle size={11} className="shrink-0" />
                              <span>{rulingError}</span>
                            </div>
                          )}

                          <div className="flex gap-2 justify-end">
                            <button
                              type="button"
                              onClick={() => { setActiveRuling(null); setRulingNote(''); setRulingError(''); }}
                              disabled={isSubmittingRuling}
                              className="px-3 py-1.5 border border-dossier-border text-dossier-muted font-mono text-[10px] font-bold uppercase hover:bg-dossier-text/5 cursor-pointer disabled:opacity-50 flex items-center gap-1"
                            >
                              <X size={11} />
                              <span>Cancel</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleExecuteRuling(activeRuling)}
                              disabled={isSubmittingRuling || (activeRuling === 'confirmed_fraud' && !rulingNote.trim())}
                              className={`px-3.5 py-1.5 font-mono text-[10px] font-bold uppercase text-white cursor-pointer disabled:opacity-50 flex items-center gap-1 ${
                                activeRuling === 'confirmed_fraud' 
                                  ? 'bg-status-flagged hover:bg-status-flagged/90 border border-status-flagged' 
                                  : 'bg-status-verified hover:bg-status-verified/90 border border-status-verified'
                              }`}
                            >
                              <Send size={11} />
                              <span>{isSubmittingRuling ? "Broadcasting to EVM..." : "Sign & Seal on Chain"}</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 3. CLEAN RECORD (STATUS === 'VERIFIED') - SINGLE GENERIC SEAL BUTTON */}
                  {role === 'auditor' && isVerified && !caseDetail.log.tx_hash && (
                    <button
                      onClick={() => handleExecuteRuling('cleared')}
                      disabled={isSubmittingRuling}
                      className="w-full py-2 text-xs font-mono font-bold border border-status-verified text-status-verified hover:bg-status-verified/5 transition-colors uppercase cursor-pointer"
                    >
                      {isSubmittingRuling ? "Sealing on EVM..." : "Cryptographically Seal & Lock Record on EVM"}
                    </button>
                  )}
                </div>

                {/* Verification result snippet */}
                {verificationResult && (
                  <div className="mt-4 p-3 bg-dossier-bg border border-dossier-border font-mono text-[10px] space-y-1">
                    <div className="flex items-center gap-1 text-status-verified font-bold uppercase">
                      <CheckCircle size={12} />
                      <span>Ledger Root Verified Against Block #{verificationResult.blockNumber}</span>
                    </div>
                    <p className="text-dossier-muted truncate font-bold">Contract Signer: {verificationResult.sender}</p>
                    <p className="text-dossier-muted truncate font-bold">State Root: {verificationResult.lockedHash}</p>
                    {verificationResult.integrity_match !== undefined && (
                      <div className={`mt-2 p-1.5 border font-bold uppercase rounded ${verificationResult.integrity_match ? 'bg-status-verified/10 text-status-verified border-status-verified/30' : 'bg-status-flagged/10 text-status-flagged border-status-flagged/30'}`}>
                        Integrity check: {verificationResult.integrity_match ? 'PASSED (Cryptographic Seal Match)' : 'FAILED (Local DB Divergence Detected!)'}
                      </div>
                    )}
                    {verificationResult.mismatches && verificationResult.mismatches.length > 0 && (
                      <div className="mt-1 text-status-flagged font-bold">
                        Mismatches:
                        <ul className="list-disc pl-3 mt-0.5 space-y-0.5 normal-case font-normal text-dossier-muted">
                          {verificationResult.mismatches.map((m: string, idx: number) => (
                            <li key={idx}>{m}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right Panel: GIS Spatial Intelligence Evidence */}
            <div className="lg:col-span-7 space-y-6">
              <div className="border border-dossier-border p-6 bg-dossier-card">
                
                {/* GIS Card Header */}
                <div className="border-b border-dossier-border pb-3 flex justify-between items-center">
                  <div>
                    <h3 className="font-serif text-lg font-black uppercase text-dossier-text">Spatial Trajectory Telemetry</h3>
                    <p className="text-[10px] text-dossier-muted font-mono uppercase mt-0.5 font-bold">
                      {caseDetail.trip?.route_name || "GPS Fleet Track Sequence"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 font-mono text-[9px] font-bold">
                    <span className="w-2 h-2 rounded-full bg-status-verified animate-ping"></span>
                    <span className="text-status-verified uppercase font-bold">GIS Active</span>
                  </div>
                </div>

                {/* Map Viewer */}
                <div className="h-[450px] w-full my-6 border border-dossier-border relative">
                  <MapContainer 
                    key={selectedCaseId}
                    center={mapCenter} 
                    zoom={12} 
                    style={{ height: '100%', width: '100%' }}
                    zoomControl={false}
                  >
                    <TileLayer
                      url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                      attribution='&copy; <a href="https://carto.com/">CARTO</a>'
                    />

                    {/* Nagpur city boundary outline */}
                    {nagpurBoundary && (
                      <GeoJSON 
                        data={nagpurBoundary as any} 
                        style={{
                          color: "#8c8b7f",
                          fillColor: "transparent",
                          weight: 1.5,
                          dashArray: "4, 4"
                        }}
                      />
                    )}

                    {/* Bhandewadi Dumping Ground Marker */}
                    <CircleMarker
                      center={dumpYardCoords}
                      pathOptions={{
                        color: "#9e2a2b",
                        fillColor: "#9e2a2b",
                        fillOpacity: 0.6,
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
                      positions={tripRoute}
                      pathOptions={{
                        color: isConfirmedFraud || isFlagged ? "#9e2a2b" : "#2d6a4f",
                        weight: 3,
                        dashArray: isConfirmedFraud || isFlagged ? "3, 5" : undefined
                      }}
                    />

                    {/* Start point marker */}
                    {startPoint && (
                      <CircleMarker
                        center={startPoint}
                        pathOptions={{ color: "#2d6a4f", fillColor: "#2d6a4f", fillOpacity: 0.8, weight: 2 }}
                        radius={6}
                      >
                        <Popup>
                          <div className="font-mono text-xs font-bold">Route Origin</div>
                        </Popup>
                      </CircleMarker>
                    )}

                    {/* End point marker */}
                    {endPoint && (
                      <CircleMarker
                        center={endPoint}
                        pathOptions={{
                          color: isGPSContradiction ? "#9e2a2b" : "#2d6a4f",
                          fillColor: isGPSContradiction ? "#9e2a2b" : "#2d6a4f",
                          fillOpacity: 0.8,
                          weight: 2
                        }}
                        radius={7}
                      >
                        <Popup>
                          <div className="font-mono text-xs font-bold">
                            {isGPSContradiction
                              ? "Spatial Contradiction point: Vehicle turned back without entering dump yard."
                              : "Trip Terminal Point"}
                          </div>
                        </Popup>
                        <LeafletTooltip permanent direction="bottom" className="leaflet-tooltip-custom border-none bg-transparent shadow-none font-mono text-[8px] font-bold text-black uppercase pointer-events-none">
                          {isGPSContradiction ? "SPATIAL ANOMALY" : "DESTINATION"}
                        </LeafletTooltip>
                      </CircleMarker>
                    )}
                  </MapContainer>

                  <div className="absolute top-2 left-2 bg-dossier-bg border border-dossier-border px-2 py-1 text-[9px] font-mono z-[1000] font-bold text-dossier-text">
                    GPS TELEMETRY EXHIBIT: {caseDetail.trip?.id || caseDetail.log.id}
                  </div>
                </div>

                {/* Telemetry verification footer */}
                <div className="font-mono text-[10px] border-t border-dossier-border pt-4 flex justify-between items-center text-dossier-muted uppercase font-bold">
                  <div className="flex items-center gap-1.5 font-bold">
                    <Activity size={14} className={isConfirmedFraud || isFlagged ? "text-status-flagged" : "text-status-verified"} />
                    <span>GPS Telemetry status: {isConfirmedFraud || isFlagged ? "Flagged Telemetry" : "Verified Route"}</span>
                  </div>
                  <span>Exhibit Ref: {caseDetail.trip?.id || caseDetail.log.id}</span>
                </div>
              </div>
            </div>

          </div>
        )
      )}
    </div>
  );
};
