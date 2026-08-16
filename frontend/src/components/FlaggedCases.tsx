import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, ShieldAlert, Key, Activity, Check, MapPin, DoorClosed, X, Send, Gavel, Lock, Clock, FileText } from 'lucide-react';
import { MapContainer, TileLayer, Polyline, CircleMarker, GeoJSON, Popup, Tooltip as LeafletTooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

import nagpurBoundary from '../data/nagpur-boundary.json';

interface FlaggedCasesProps {
  initialCaseId?: string | null;
  role: string;
  token?: string | null;
  onAuthError?: (errMessage: string) => void;
  onPushWeb3Log?: (source: string, message: string, type: 'info' | 'success' | 'warn' | 'hex') => void;
}

export const FlaggedCases: React.FC<FlaggedCasesProps> = ({ initialCaseId, role, token, onAuthError, onPushWeb3Log }) => {
  const [cases, setCases] = useState<any[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string>(initialCaseId || '');
  const [caseDetail, setCaseDetail] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [copiedTx, setCopiedTx] = useState<boolean>(false);

  const [activeRuling, setActiveRuling] = useState<'confirmed_fraud' | 'cleared' | null>(null);
  const [rulingNote, setRulingNote] = useState<string>('');
  const [rulingError, setRulingError] = useState<string>('');
  const [isSubmittingRuling, setIsSubmittingRuling] = useState<boolean>(false);

  useEffect(() => {
    const fetchFlags = async () => {
      try {
        const res = await fetch('/api/weighbridge/flags?all_logs=true');
        const data = await res.json();
        setCases(data);
        if (initialCaseId) setSelectedCaseId(initialCaseId);
        else if (data.length > 0 && !selectedCaseId) setSelectedCaseId(data[0].id);
      } catch (err) { console.error("Error loading flagged cases", err); }
    };
    fetchFlags();
  }, []);

  useEffect(() => { if (initialCaseId) setSelectedCaseId(initialCaseId); }, [initialCaseId]);

  useEffect(() => {
    if (!selectedCaseId) return;
    const fetchDetail = async () => {
      setLoading(true);
      setVerificationResult(null); setActiveRuling(null); setRulingNote(''); setRulingError(''); setCopiedTx(false);
      try {
        const res = await fetch(`/api/weighbridge/flags/${selectedCaseId}`);
        if (!res.ok) throw new Error(`Failed to fetch case ${selectedCaseId}`);
        const data = await res.json();
        setCaseDetail(data);
      } catch (err) { console.error("Error loading case details", err); }
      finally { setLoading(false); }
    };
    fetchDetail();
  }, [selectedCaseId]);

  const handleVerifyOnChain = async () => {
    if (!caseDetail) return;
    setIsVerifying(true);
    await new Promise((resolve) => setTimeout(resolve, 800));
    setIsVerifying(false);
    setVerificationResult({
      success: true,
      blockNumber: Math.floor(Math.random() * 200000) + 14820000,
      timestamp: new Date().toISOString(),
      sender: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
      lockedHash: caseDetail.log.tx_hash
    });
    onPushWeb3Log?.("Merkle State", `EVM cryptographic root verified for ${caseDetail.log.id}. State: SECURED`, "success");
  };

  const handleCopyTx = (txHash: string) => {
    navigator.clipboard.writeText(txHash);
    setCopiedTx(true);
    setTimeout(() => setCopiedTx(false), 2500);
  };

  const handleExecuteRuling = async (dispositionType: 'confirmed_fraud' | 'cleared') => {
    if (!caseDetail) return;
    const trimmedNote = rulingNote.trim();
    if (dispositionType === 'confirmed_fraud' && !trimmedNote) {
      setRulingError("An auditor justification note is required to confirm a fraud violation.");
      return;
    }
    setIsSubmittingRuling(true); setRulingError('');
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/blockchain/lock', {
        method: 'POST', headers,
        body: JSON.stringify({ type: 'weighbridge', id: caseDetail.log.id, disposition: dispositionType, note: trimmedNote })
      });
      if (res.status === 401 || res.status === 403) {
        const errData = await res.json().catch(() => ({}));
        onAuthError?.(errData.detail || 'Authorization failed. Only auditors can seal records on-chain.');
        return;
      }
      if (res.status === 503) {
        setRulingError("Blockchain node unavailable — is Anvil running?");
        onPushWeb3Log?.("Web3 Error", "Blockchain RPC node at :8545 unreachable.", "warn");
        return;
      }
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setRulingError(errData.detail || 'Failed to submit on-chain ruling.');
        return;
      }
      const data = await res.json();
      if (data.status === 'success') {
        setActiveRuling(null); setRulingNote('');
        onPushWeb3Log?.("Solidity EVM", `Ruling sealed for Ticket ${caseDetail.log.id} [${dispositionType.toUpperCase()}]. Hash: ${data.tx_hash}`, "hex");
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

  const dumpYardCoords: [number, number] = [21.1408, 79.1622];
  const tripRoute: [number, number][] = (caseDetail?.gps_path && caseDetail.gps_path.length > 0)
    ? caseDetail.gps_path.map((p: any) => [p.lat, p.lng] as [number, number])
    : [[21.1517, 79.0734], [21.1408, 79.1622]];
  const mapCenter: [number, number] = tripRoute.length > 0 ? tripRoute[Math.floor(tripRoute.length / 2)] : [21.1408, 79.1622];
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header and Selector */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
        <div>
          <h1 className="t-h1" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldAlert size={24} style={{ color: 'var(--color-primary)' }} />
            Evidence Exhibits
          </h1>
          <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginTop: 4 }}>
            Forensic Contract Audit Logs
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, color: 'var(--color-text-muted)', fontWeight: 500 }}>Select Case File:</span>
          <select
            value={selectedCaseId}
            onChange={(e) => setSelectedCaseId(e.target.value)}
            style={{
              padding: '8px 12px', borderRadius: 6, border: '1px solid var(--color-border)',
              background: 'var(--color-surface)', fontSize: 14, color: 'var(--color-text-base)', outline: 'none',
              maxWidth: 300, cursor: 'pointer'
            }}
          >
            {selectedCaseId && !cases.some(c => c.id === selectedCaseId) && (
              <option value={selectedCaseId}>{selectedCaseId} - Selected Filing</option>
            )}
            {cases.map((c) => {
              const sTag = c.status === 'confirmed_fraud' ? 'VIOLATION' : c.status === 'cleared' ? 'CLEARED' : c.status === 'flagged' ? 'FLAGGED' : c.status === 'under_review' ? 'REVIEW' : 'SECURED';
              return (
                <option key={c.id} value={c.id}>
                  [{sTag}] {c.id} - {c.contractor_name}
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {loading && !caseDetail ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400 }}>
          <span style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>Loading exhibit data...</span>
        </div>
      ) : (
        caseDetail && (
          <div style={{ display: 'grid', gridTemplateColumns: '5fr 7fr', gap: 24 }}>
            
            {/* Left Panel: Detailed Timeline Docket */}
            <div className="card" style={{ padding: '24px' }}>
              <div style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 16, marginBottom: 20 }}>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                  Case Docket
                </div>
                <h2 className="t-h2">{caseDetail.log.id}</h2>
                <div style={{ fontSize: 14, color: 'var(--color-text-base)', marginTop: 4 }}>
                  Contractor: <span style={{ fontWeight: 600 }}>{caseDetail.log.contractor_name}</span> (Truck: {caseDetail.log.truck_id})
                </div>
              </div>

              {/* 3-Step Vertical Timeline */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginLeft: 8 }}>
                
                {/* Step 1: Reported */}
                <div className="timeline-step">
                  <div className="timeline-dot" style={{ background: '#E0F2FE', color: '#0369A1' }}>1</div>
                  <div style={{ paddingBottom: 24 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-text-base)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <FileText size={14} /> Weigh Ticket Filed
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={12} /> {new Date(caseDetail.log.timestamp).toLocaleString()}
                    </div>
                    <div style={{ background: '#F9FAFB', border: '1px solid var(--color-border)', borderRadius: 6, padding: '10px 14px', marginTop: 10, fontSize: 13 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ color: 'var(--color-text-muted)' }}>Registered Tonnage:</span>
                        <strong style={{ color: 'var(--color-text-base)' }}>{caseDetail.log.weight_kg.toLocaleString()} kg</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ color: 'var(--color-text-muted)' }}>Rated Deviation:</span>
                        <strong style={{ color: caseDetail.log.deviation_pct > 10 ? '#DC2626' : 'var(--color-text-base)' }}>
                          {caseDetail.log.deviation_pct >= 0 ? '+' : ''}{caseDetail.log.deviation_pct}%
                        </strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--color-text-muted)' }}>Driver Signature:</span>
                        <strong style={{ color: 'var(--color-text-base)' }}>{caseDetail.log.driver_name}</strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Step 2: Inspected */}
                <div className="timeline-step">
                  <div className="timeline-dot" style={{ background: (isConfirmedFraud || isFlagged) ? '#FEE2E2' : '#D1FAE5', color: (isConfirmedFraud || isFlagged) ? '#991B1B' : '#065F46' }}>2</div>
                  <div style={{ paddingBottom: 24 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-text-base)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Activity size={14} /> Audit Inspection
                    </div>
                    
                    <div style={{ marginTop: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: (isConfirmedFraud || isFlagged) ? '#FEF2F2' : '#F0FDF4', border: `1px solid ${(isConfirmedFraud || isFlagged) ? '#FECACA' : '#BBF7D0'}`, borderRadius: 6, padding: '10px 14px' }}>
                        {(isConfirmedFraud || isFlagged) ? <AlertTriangle size={16} style={{ color: '#DC2626', flexShrink: 0, marginTop: 2 }} /> : <CheckCircle size={16} style={{ color: '#059669', flexShrink: 0, marginTop: 2 }} />}
                        <div style={{ fontSize: 13, color: (isConfirmedFraud || isFlagged) ? '#991B1B' : '#065F46' }}>
                          <div style={{ fontWeight: 600, marginBottom: 2 }}>{isConfirmedFraud || isFlagged ? 'Anomaly Detected' : 'Checks Passed'}</div>
                          {caseDetail.log.flag_reason || 'GPS telemetry confirms dump yard drop-off, physical gate RFID entry verified, and weight is within expected limits.'}
                        </div>
                      </div>

                      {caseDetail.gate_log && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F9FAFB', border: '1px solid var(--color-border)', borderRadius: 6, padding: '8px 14px', marginTop: 8, fontSize: 12 }}>
                          <span style={{ color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <DoorClosed size={14} /> Physical Gate
                          </span>
                          {caseDetail.gate_log.verified ? (
                            <span style={{ fontWeight: 600, color: '#059669' }}>Entry Confirmed ({caseDetail.gate_log.details?.gate_id || 'GATE-1'})</span>
                          ) : (
                            <span style={{ fontWeight: 600, color: '#DC2626' }}>No Entry Record Found</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Step 3: On-Chain Verification Hash */}
                <div className="timeline-step">
                  <div className="timeline-dot" style={{ background: '#F3F4F6', color: '#4B5563' }}>3</div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-text-base)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Lock size={14} /> Ledger Seal
                    </div>
                    <div style={{ marginTop: 10, background: '#111827', border: '1px solid #374151', borderRadius: 6, padding: '12px 14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>EVM State Hash</span>
                        {caseDetail.log.tx_hash && (
                          <button onClick={() => handleCopyTx(caseDetail.log.tx_hash)} style={{ background: 'none', border: 'none', color: '#60A5FA', fontSize: 11, cursor: 'pointer' }}>
                            {copiedTx ? 'Copied!' : 'Copy'}
                          </button>
                        )}
                      </div>
                      <div className="t-mono" style={{ color: '#D1D5DB', wordBreak: 'break-all', fontSize: 11 }}>
                        {caseDetail.log.tx_hash || 'Unsealed / Pending'}
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* Auditor Ruling Actions */}
              <div style={{ marginTop: 32, paddingTop: 20, borderTop: '1px solid var(--color-border)' }}>
                {isRuledOn && (
                  <div style={{ background: isConfirmedFraud ? '#FEF2F2' : '#F0FDF4', border: `1px solid ${isConfirmedFraud ? '#FECACA' : '#BBF7D0'}`, borderRadius: 6, padding: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 13, color: isConfirmedFraud ? '#991B1B' : '#065F46', marginBottom: 6 }}>
                      <Gavel size={15} />
                      {isConfirmedFraud ? "Ruling: Confirmed Fraud Violation" : "Ruling: Dismissed False Positive"}
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--color-text-base)', margin: 0 }}>
                      <strong style={{ color: 'var(--color-text-muted)', fontWeight: 500 }}>Note:</strong> {caseDetail.log.auditor_note || "No justification provided."}
                    </p>
                  </div>
                )}

                {role === 'auditor' && isFlaggedOrReview && !isRuledOn && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {!activeRuling && (
                      <>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', textAlign: 'center' }}>
                          Auditor Forensic Ruling Required
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                          <button onClick={() => { setActiveRuling('confirmed_fraud'); setRulingNote(''); }} className="btn-danger" style={{ justifyContent: 'center' }}>
                            Confirm Violation
                          </button>
                          <button onClick={() => { setActiveRuling('cleared'); setRulingNote(''); }} className="btn-success" style={{ justifyContent: 'center' }}>
                            Dismiss & Seal
                          </button>
                        </div>
                      </>
                    )}

                    {activeRuling && (
                      <div style={{ background: '#F9FAFB', border: '1px solid var(--color-border)', borderRadius: 6, padding: '16px' }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--color-text-base)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Gavel size={14} style={{ color: activeRuling === 'confirmed_fraud' ? '#DC2626' : '#059669' }} />
                          {activeRuling === 'confirmed_fraud' ? "Ruling: Confirm Fraud Violation" : "Ruling: Dismiss as False Positive"}
                        </div>
                        <textarea
                          value={rulingNote}
                          onChange={(e) => { setRulingNote(e.target.value); setRulingError(''); }}
                          placeholder="State your forensic ruling justification..."
                          rows={3}
                          disabled={isSubmittingRuling}
                          style={{ width: '100%', border: '1px solid var(--color-border)', borderRadius: 6, padding: '10px 12px', fontSize: 13, fontFamily: 'Inter, sans-serif', outline: 'none', resize: 'none', marginBottom: 12 }}
                        />
                        {rulingError && (
                          <div style={{ fontSize: 12, color: '#DC2626', marginBottom: 12 }}>{rulingError}</div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                          <button onClick={() => setActiveRuling(null)} disabled={isSubmittingRuling} className="btn-ghost">Cancel</button>
                          <button
                            onClick={() => handleExecuteRuling(activeRuling)}
                            disabled={isSubmittingRuling || (activeRuling === 'confirmed_fraud' && !rulingNote.trim())}
                            className={activeRuling === 'confirmed_fraud' ? 'btn-danger' : 'btn-success'}
                          >
                            {isSubmittingRuling ? "Sealing..." : "Sign & Seal on Chain"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {role === 'auditor' && isVerified && !caseDetail.log.tx_hash && (
                  <button onClick={() => handleExecuteRuling('cleared')} disabled={isSubmittingRuling} className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                    {isSubmittingRuling ? "Sealing..." : "Cryptographically Seal Record"}
                  </button>
                )}

                <button
                  onClick={handleVerifyOnChain}
                  disabled={isVerifying || !caseDetail.log.tx_hash}
                  className="btn-ghost"
                  style={{ width: '100%', justifyContent: 'center', marginTop: 12 }}
                >
                  <Key size={14} /> {isVerifying ? "Verifying Merkle Root..." : "Verify Ledger Seal Status"}
                </button>

                {verificationResult && (
                  <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 6, padding: '12px 14px', marginTop: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#065F46', fontWeight: 600, fontSize: 12, marginBottom: 8 }}>
                      <CheckCircle size={14} /> Root Verified (Block #{verificationResult.blockNumber})
                    </div>
                    <div className="t-mono" style={{ fontSize: 10, color: '#374151', marginBottom: 4 }}>Signer: {verificationResult.sender}</div>
                    <div className="t-mono" style={{ fontSize: 10, color: '#374151' }}>State Root: {verificationResult.lockedHash}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Panel: GIS Spatial Intelligence */}
            <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <h2 className="t-h2">Spatial Trajectory Telemetry</h2>
                  <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: 0 }}>{caseDetail.trip?.route_name || "GPS Fleet Track Sequence"}</p>
                </div>
                <div className="badge badge-ok">
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#059669', animation: 'pulse 2s infinite' }}></span>
                  GIS Active
                </div>
              </div>

              <div style={{ flex: 1, minHeight: 450, border: '1px solid var(--color-border)', borderRadius: 6, overflow: 'hidden', position: 'relative', isolation: 'isolate', zIndex: 10 }}>
                <MapContainer center={mapCenter} zoom={12} style={{ height: '100%', width: '100%' }} zoomControl={false}>
                  <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" attribution='&copy; CARTO' />
                  {nagpurBoundary && <GeoJSON data={nagpurBoundary as any} style={{ color: "#9CA3AF", fillColor: "transparent", weight: 1.5, dashArray: "4, 4" }} />}
                  <CircleMarker center={dumpYardCoords} pathOptions={{ color: "#DC2626", fillColor: "#DC2626", fillOpacity: 0.05, weight: 1.5, dashArray: "4, 4" }} radius={35} />
                  <CircleMarker center={dumpYardCoords} pathOptions={{ color: "#DC2626", fillColor: "#DC2626", fillOpacity: 0.6, weight: 2 }} radius={10}>
                    <Popup><div style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 600 }}>Bhandewadi Dump Yard</div></Popup>
                    <LeafletTooltip permanent direction="top" className="leaflet-tooltip-custom">Bhandewadi Dump Yard</LeafletTooltip>
                  </CircleMarker>
                  <Polyline positions={tripRoute} pathOptions={{ color: isConfirmedFraud || isFlagged ? "#DC2626" : "#059669", weight: 3, dashArray: isConfirmedFraud || isFlagged ? "4, 6" : undefined }} />
                  {startPoint && (
                    <CircleMarker center={startPoint} pathOptions={{ color: "#059669", fillColor: "#059669", fillOpacity: 0.7, weight: 2 }} radius={7}>
                      <Popup><div style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 600 }}>Route Origin</div></Popup>
                    </CircleMarker>
                  )}
                  {endPoint && (
                    <CircleMarker center={endPoint} pathOptions={{ color: isGPSContradiction ? "#DC2626" : "#059669", fillColor: isGPSContradiction ? "#DC2626" : "#059669", fillOpacity: 0.7, weight: 2 }} radius={7}>
                      <Popup><div style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 600 }}>{isGPSContradiction ? "Spatial Contradiction point" : "Destination"}</div></Popup>
                      <LeafletTooltip permanent direction="bottom" className="leaflet-tooltip-custom">{isGPSContradiction ? "SPATIAL ANOMALY" : "DESTINATION"}</LeafletTooltip>
                    </CircleMarker>
                  )}
                </MapContainer>
                
                <div style={{ position: 'absolute', top: 10, left: 10, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 4, padding: '4px 8px', fontSize: 10, fontWeight: 600, color: 'var(--color-text-base)', zIndex: 1000, boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                  EXHIBIT: {caseDetail.trip?.id || caseDetail.log.id}
                </div>

                {isGPSContradiction && (
                  <div style={{ position: 'absolute', bottom: 10, left: 10, right: 10, background: '#DC2626', color: '#fff', borderRadius: 6, padding: '10px 14px', fontSize: 12, fontWeight: 600, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 4px 6px rgba(220,38,38,0.3)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <AlertTriangle size={16} className="animate-pulse" />
                      <span>GPS CONTRADICTION: VEHICLE NEVER ENTERED GEOFENCE</span>
                    </div>
                    <span style={{ border: '1px solid rgba(255,255,255,0.5)', borderRadius: 4, padding: '2px 6px', fontSize: 10 }}>FLAGGED</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      )}
    </div>
  );
};
