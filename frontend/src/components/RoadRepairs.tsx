import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle, Clock, MapPin, MessageSquare, Key, AlertTriangle, Send, X, ShieldCheck, FileSpreadsheet, Info } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

interface RoadRepair {
  id: string;
  contractor_id: string;
  contractor_name: string;
  ward_name: string;
  location_gps: string;
  before_photo_url: string;
  after_photo_url: string;
  work_completed_date: string;
  sla_expiry_date: string;
  status: string;
  complaints_count: number;
  tx_hash: string;
}

interface RoadRepairsProps {
  role: string;
  token?: string | null;
  onAuthError?: (errMessage: string) => void;
  onPushWeb3Log?: (source: string, message: string, type: 'info' | 'success' | 'warn' | 'hex') => void;
}

const STORAGE_KEY = 'auditchain_reported_repairs';

const BeforeAfterSlider: React.FC<{ before: string; after: string; label: string }> = ({ before, after, label }) => {
  const [sliderPos, setSliderPos] = useState(50);
  return (
    <div className="relative w-full h-[300px] md:h-[480px] bg-surface-container overflow-hidden isolate select-none">
      <img src={after} alt="After" className="absolute inset-0 w-full h-full object-cover pointer-events-none" />
      <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none" style={{ width: `${sliderPos}%` }}>
        <img src={before} alt="Before" className="absolute inset-0 w-full h-full object-cover max-w-none pointer-events-none" style={{ width: '100vw', maxWidth: '100%' }} />
      </div>
      <div className="absolute top-0 bottom-0 w-1 bg-surface-container-lowest pointer-events-none shadow-ambient" style={{ left: `calc(${sliderPos}% - 2px)` }}>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-surface-container-lowest rounded-full shadow-md flex items-center justify-center pointer-events-auto">
          <span className="material-symbols-outlined text-[16px] text-secondary">code</span>
        </div>
      </div>
      <input type="range" min="0" max="100" value={sliderPos} onChange={e => setSliderPos(Number(e.target.value))} className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-20" />
      <div className="absolute top-4 left-4 bg-surface-container-lowest/80 backdrop-blur px-3 py-1.5 rounded-full text-label-sm font-semibold tracking-wide text-on-surface shadow-sm z-10 pointer-events-none uppercase">Before</div>
      <div className="absolute top-4 right-4 bg-surface-container-lowest/80 backdrop-blur px-3 py-1.5 rounded-full text-label-sm font-semibold tracking-wide text-on-surface shadow-sm z-10 pointer-events-none uppercase">After</div>
      <div className="absolute bottom-4 left-4 bg-surface-container-lowest/90 backdrop-blur px-3 py-1.5 rounded text-xs font-mono font-medium text-on-surface-variant shadow-sm z-10 pointer-events-none flex items-center gap-1.5">
        <span className="material-symbols-outlined text-[16px]">location_on</span>
        {label}
      </div>
    </div>
  );
};

export const RoadRepairs: React.FC<RoadRepairsProps> = ({ role, token, onAuthError, onPushWeb3Log }) => {
  const [repairs, setRepairs] = useState<RoadRepair[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [sealErrors, setSealErrors] = useState<{ [repairId: string]: string }>({});
  const [activeQrRepairId, setActiveQrRepairId] = useState<string | null>(null);

  const [reportedIds, setReportedIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [activeComplaintId, setActiveComplaintId] = useState<string | null>(null);
  const [complaintText, setComplaintText] = useState<string>('');
  const [complaintErrors, setComplaintErrors] = useState<{ [repairId: string]: string }>({});
  const [complaintSuccesses, setComplaintSuccesses] = useState<{ [repairId: string]: string }>({});

  const isRestrictedRole = role === 'officer' || role === 'auditor';

  const fetchRepairs = async () => {
    try {
      const res = await fetch('/api/road-repairs');
      const data = await res.json();
      setRepairs(data);
    } catch (err) {
      console.error("Error fetching road repairs", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRepairs(); }, []);

  const markAsReported = (repairId: string) => {
    setReportedIds((prev) => {
      if (prev.includes(repairId)) return prev;
      const next = [...prev, repairId];
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch (e) { }
      return next;
    });
  };

  const handleOpenComplaintForm = (repairId: string) => {
    setActiveComplaintId(repairId);
    setComplaintText('');
    setComplaintErrors((prev) => ({ ...prev, [repairId]: '' }));
    setComplaintSuccesses((prev) => ({ ...prev, [repairId]: '' }));
  };

  const handleCancelComplaint = (repairId: string) => {
    setActiveComplaintId(null);
    setComplaintText('');
    setComplaintErrors((prev) => ({ ...prev, [repairId]: '' }));
  };

  const handleFileComplaint = async (repairId: string) => {
    const trimmed = complaintText.trim();
    if (trimmed.length < 10) {
      setComplaintErrors((prev) => ({ ...prev, [repairId]: "Complaint description must be at least 10 characters long." }));
      return;
    }
    setActioningId(repairId);
    setComplaintErrors((prev) => ({ ...prev, [repairId]: '' }));
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`/api/road-repairs/${repairId}/complaint`, {
        method: 'POST', headers, body: JSON.stringify({ description: trimmed })
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 409) {
        markAsReported(repairId);
        setActiveComplaintId(null);
        setComplaintErrors((prev) => ({ ...prev, [repairId]: "You've already submitted a report for this case." }));
        return;
      }
      if (res.status === 403) {
        setComplaintErrors((prev) => ({ ...prev, [repairId]: data.detail || "Internal officer and auditor accounts are prohibited from filing complaints." }));
        return;
      }
      if (res.status === 400) {
        setComplaintErrors((prev) => ({ ...prev, [repairId]: data.detail || "Complaint description must be at least 10 characters." }));
        return;
      }
      if (!res.ok) {
        setComplaintErrors((prev) => ({ ...prev, [repairId]: data.detail || "Failed to submit complaint. Please try again." }));
        return;
      }

      if (data.status === 'success') {
        markAsReported(repairId);
        setComplaintSuccesses((prev) => ({ ...prev, [repairId]: "Complaint registered successfully! Telemetry updated." }));
        setActiveComplaintId(null);
        setComplaintText('');
        onPushWeb3Log?.("Citizen Registry", `Complaint recorded on ${repairId}. Total: ${data.complaints_count} reports. SLA Status: ${data.repair_status?.toUpperCase()}`, data.repair_status === 'breached' ? 'warn' : 'info');
        fetchRepairs();
        setTimeout(() => {
          setComplaintSuccesses((prev) => {
            const next = { ...prev };
            delete next[repairId];
            return next;
          });
        }, 6000);
      }
    } catch (err) {
      setComplaintErrors((prev) => ({ ...prev, [repairId]: "Network error occurred while submitting complaint." }));
    } finally {
      setActioningId(null);
    }
  };

  const handleSealRecord = async (repairId: string) => {
    setActioningId(repairId);
    setSealErrors((prev) => ({ ...prev, [repairId]: '' }));
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/blockchain/lock', {
        method: 'POST', headers, body: JSON.stringify({ type: 'road', id: repairId, disposition: 'cleared' })
      });

      if (res.status === 401 || res.status === 403) {
        const errData = await res.json().catch(() => ({}));
        onAuthError?.(errData.detail || 'Authorization failed (401/403). Only auditors can seal records on-chain.');
        return;
      }
      if (res.status === 503) {
        const errData = await res.json().catch(() => ({}));
        setSealErrors((prev) => ({ ...prev, [repairId]: errData.detail || "Blockchain node unavailable — is Anvil running?" }));
        onPushWeb3Log?.("Web3 Error", "Blockchain RPC node at :8545 unreachable.", "warn");
        return;
      }
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setSealErrors((prev) => ({ ...prev, [repairId]: errData.detail || "Failed to seal record on blockchain." }));
        return;
      }

      const data = await res.json();
      if (data.status === 'success') {
        onPushWeb3Log?.("Solidity EVM", `Road Repair ${repairId} locked on-chain. Sealed Tx: ${data.tx_hash}`, "hex");
        fetchRepairs();
      }
    } catch (err) {
      setSealErrors((prev) => ({ ...prev, [repairId]: "Network error broadcasting transaction to blockchain." }));
    } finally {
      setActioningId(null);
    }
  };

  const calculateDaysLeft = (expiryStr: string) => {
    const expiry = new Date(expiryStr);
    const today = new Date();
    const diffDays = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400 }}>
        <span style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>Loading road restoration records...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-stack-lg w-full">
      {/* ── Header ──────────────────────────────────────────────── */}
      <section className="flex flex-col gap-stack-sm max-w-3xl">
        <div className="inline-flex items-center gap-2 bg-primary-container/5 border border-primary/20 px-3 py-1.5 rounded-full w-fit">
          <span className="material-symbols-outlined text-[16px] text-primary">policy</span>
          <span className="font-label-sm text-label-sm text-primary uppercase tracking-wider">Citizen SLA Enforcement</span>
        </div>
        <h2 className="font-display-lg-mobile md:font-display-lg text-display-lg-mobile md:text-display-lg text-on-surface text-balance tracking-tight">
          Road SLA Tracker
        </h2>
        <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl text-balance">
          Contractors are required to restore excavated pipeline roads to a level asphalt grade. TrashTrail enforces a 30-day citizen complaint SLA window. If &gt;3 complaints are filed, contract funds are automatically held, and an audit breach is registered on-chain.
        </p>
      </section>

      {/* ── Grid of SLA repair cards ────────────────────────────── */}
      <div className="flex flex-col gap-12">
        {repairs.map((repair) => {
          const daysLeft = calculateDaysLeft(repair.sla_expiry_date);
          const isBreached = repair.status === 'breached';
          const isVerified = repair.status === 'verified';
          const isFormOpen = activeComplaintId === repair.id;
          const currentError = complaintErrors[repair.id];
          const currentSuccess = complaintSuccesses[repair.id];
          const hasAlreadyReported = reportedIds.includes(repair.id);

          return (
            <div key={repair.id} className="grid grid-cols-1 xl:grid-cols-12 gap-gutter">

              {/* Left Column (Slider) */}
              <section className="xl:col-span-8 bg-surface-container-lowest rounded-xl shadow-ambient p-stack-sm border border-outline-variant/30 flex flex-col gap-stack-sm hover:-translate-y-[2px] transition-transform duration-300">
                <div className="flex justify-between items-center px-2">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-on-surface-variant">construction</span>
                    <h3 className="font-headline-md text-headline-md text-on-surface font-bold tracking-tight m-0">{repair.ward_name}</h3>
                  </div>
                  {isBreached && <span className="bg-error-container text-on-error-container px-3 py-1 rounded-full text-label-sm font-semibold tracking-wide uppercase">SLA Breach</span>}
                  {isVerified && <span className="bg-tertiary-fixed text-on-tertiary-fixed px-3 py-1 rounded-full text-label-sm font-semibold tracking-wide flex items-center gap-1 uppercase"><span className="material-symbols-outlined text-[14px]">verified</span> Audit Cleared</span>}
                  {!isBreached && !isVerified && <span className="bg-primary-fixed text-on-primary-fixed px-3 py-1 rounded-full text-label-sm font-semibold tracking-wide uppercase">Inspection Open</span>}
                </div>
                <div className="flex-1 rounded-lg overflow-hidden border border-outline-variant/20">
                  <BeforeAfterSlider before={repair.before_photo_url} after={repair.after_photo_url} label={repair.location_gps} />
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-3 gap-4 pt-2 pb-2 px-2">
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold text-secondary uppercase tracking-wide">Contractor</span>
                    <span className="font-label-bold text-on-surface font-semibold">{repair.contractor_name}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold text-secondary uppercase tracking-wide">Window</span>
                    {isVerified ? (
                      <span className="font-label-bold font-bold text-[#059669]">Closed</span>
                    ) : daysLeft > 0 ? (
                      <span className="font-label-bold font-bold text-[#D97706] flex items-center gap-1">
                        <span className="material-symbols-outlined text-[16px]">schedule</span> {daysLeft} days left
                      </span>
                    ) : (
                      <span className="font-label-bold font-bold text-[#DC2626]">Closed</span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold text-secondary uppercase tracking-wide">Complaints</span>
                    <span className={`font-label-bold font-bold ${isBreached ? 'text-error' : 'text-on-surface'}`}>{repair.complaints_count} filed</span>
                  </div>
                </div>
              </section>

              {/* Right Column (Timeline & Actions) */}
              <section className="xl:col-span-4 bg-surface-container-lowest rounded-xl shadow-ambient p-stack-md flex flex-col gap-stack-md border border-outline-variant/30 hover:-translate-y-[2px] transition-transform duration-300">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-label-bold text-label-bold text-on-surface-variant uppercase tracking-wide font-semibold m-0">SLA Timeline</h4>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-secondary font-mono font-medium">Ref: {repair.id}</span>
                    <button
                      type="button"
                      onClick={() => setActiveQrRepairId(activeQrRepairId === repair.id ? null : repair.id)}
                      className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:text-primary/80 bg-primary-container/30 hover:bg-primary-container/50 border border-primary/20 px-2 py-0.5 rounded cursor-pointer transition-colors"
                      title="Show QR Code for Public Reporting"
                    >
                      <span className="material-symbols-outlined text-[14px]">qr_code_2</span>
                      {activeQrRepairId === repair.id ? "Hide QR" : "Show QR"}
                    </button>
                  </div>
                </div>

                {activeQrRepairId === repair.id && (
                  <div className="bg-surface-container-high border border-outline-variant/40 rounded-lg p-3 mb-2 flex flex-col items-center gap-2">
                    <div className="bg-white p-2 rounded border border-slate-200 shadow-sm">
                      <QRCodeSVG
                        value={`${window.location.origin}/complaint/${repair.id}`}
                        size={120}
                        level="M"
                      />
                    </div>
                    <span className="text-[11px] text-secondary font-mono text-center break-all">
                      {window.location.origin}/complaint/{repair.id}
                    </span>
                    <span className="text-[10px] text-on-surface-variant text-center font-medium">
                      Scan to report an issue for {repair.ward_name} (#{repair.id})
                    </span>
                  </div>
                )}

                <div className="flex-1">
                  <div className="flex flex-col gap-4 relative">
                    <div className="timeline-line" />

                    <div className="timeline-item flex gap-4 relative z-10">
                      <div className="w-10 h-10 rounded-full bg-surface-container-high border-2 border-surface-container-lowest flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-on-surface-variant text-[18px]">build</span>
                      </div>
                      <div className="pt-2">
                        <div className="font-label-bold text-on-surface font-semibold">Work Completed</div>
                        <div className="text-[12px] text-secondary font-medium">{new Date(repair.work_completed_date).toLocaleDateString()}</div>
                      </div>
                    </div>

                    <div className="timeline-item flex gap-4 relative z-10">
                      <div className="w-10 h-10 rounded-full bg-primary-container/20 border-2 border-surface-container-lowest flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-primary text-[18px]">visibility</span>
                      </div>
                      <div className="pt-2">
                        <div className="font-label-bold text-on-surface font-semibold">Inspection Window</div>
                        <div className="text-[12px] text-secondary font-medium">30-day citizen audit</div>
                      </div>
                    </div>

                    <div className="timeline-item flex gap-4 relative z-10">
                      <div className={`w-10 h-10 rounded-full border-2 border-surface-container-lowest flex items-center justify-center shrink-0 ${isBreached ? 'bg-error-container' : isVerified ? 'bg-tertiary-fixed' : 'bg-surface-container-high'}`}>
                        <span className={`material-symbols-outlined text-[18px] ${isBreached ? 'text-on-error-container' : isVerified ? 'text-on-tertiary-fixed' : 'text-on-surface-variant'}`}>{isBreached ? 'gavel' : isVerified ? 'verified' : 'pending'}</span>
                      </div>
                      <div className="pt-2">
                        <div className={`font-label-bold font-semibold ${isBreached ? 'text-error' : 'text-on-surface'}`}>{isBreached ? 'Breach Registered' : 'SLA Expiry'}</div>
                        <div className="text-[12px] text-secondary font-medium">{new Date(repair.sla_expiry_date).toLocaleDateString()}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {repair.tx_hash && (
                  <div className="bg-tertiary-fixed/40 border border-tertiary-fixed rounded p-3 mb-2">
                    <div className="text-[11px] text-on-tertiary-fixed font-bold mb-1 uppercase tracking-wider flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">link</span> On-Chain Seal Recorded
                    </div>
                    <div className="font-mono text-xs text-on-surface-variant break-all">{repair.tx_hash}</div>
                  </div>
                )}

                {currentSuccess && (
                  <div className="flex items-center gap-2 bg-tertiary-fixed text-on-tertiary-fixed p-3 rounded text-[13px] font-medium mb-2">
                    <span className="material-symbols-outlined text-[18px]">check_circle</span> {currentSuccess}
                  </div>
                )}

                {currentError && !isFormOpen && (
                  <div className="flex items-center gap-2 bg-error-container text-on-error-container p-3 rounded text-[13px] font-medium mb-2">
                    <span className="material-symbols-outlined text-[18px]">warning</span> {currentError}
                  </div>
                )}

                <div className="mt-auto">
                  {isFormOpen ? (
                    <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-4 shadow-sm">
                      <div className="flex justify-between items-center mb-3">
                        <label className="text-[13px] font-bold text-on-surface flex items-center gap-2">
                          <span className="material-symbols-outlined text-[16px]">comment</span> Describe Issue
                        </label>
                        <span className={`text-[11px] font-medium ${complaintText.trim().length >= 10 ? 'text-[#059669]' : 'text-secondary'}`}>
                          {complaintText.trim().length}/10 min
                        </span>
                      </div>
                      <textarea
                        value={complaintText}
                        onChange={(e) => setComplaintText(e.target.value)}
                        placeholder="Describe the defect in detail (e.g. trench left unrepaired, hazardous rubble)..."
                        rows={3}
                        disabled={actioningId === repair.id}
                        className="w-full p-3 border border-outline-variant rounded font-body-md text-[13px] resize-none outline-none mb-3 focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                        autoFocus
                      />
                      {currentError && <div className="text-[12px] text-error mb-3">{currentError}</div>}
                      <div className="flex justify-end gap-3">
                        <button onClick={() => handleCancelComplaint(repair.id)} disabled={actioningId === repair.id} className="text-secondary hover:text-on-surface font-label-bold text-[13px] px-3 transition-colors">Cancel</button>
                        <button onClick={() => handleFileComplaint(repair.id)} disabled={actioningId === repair.id || complaintText.trim().length < 10} className="bg-primary text-on-primary font-label-bold px-4 py-2 rounded flex items-center gap-2 disabled:opacity-50 transition-transform active:scale-95">
                          <span className="material-symbols-outlined text-[16px]">send</span> {actioningId === repair.id ? "Submitting..." : "Submit Complaint"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-3">
                      {!isRestrictedRole && (
                        hasAlreadyReported ? (
                          <div className="flex-1 flex items-center justify-center gap-2 bg-surface-container-high text-secondary border border-outline-variant rounded-lg py-3 text-[13px] font-bold">
                            <span className="material-symbols-outlined text-[18px]">verified_user</span> Already Reported
                          </div>
                        ) : (
                          <button
                            onClick={() => handleOpenComplaintForm(repair.id)}
                            disabled={actioningId === repair.id || isVerified}
                            className="flex-1 bg-primary text-on-primary font-label-bold py-3 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 transition-transform hover:-translate-y-[2px] active:scale-95 shadow-sm"
                          >
                            <span className="material-symbols-outlined text-[18px]">add_comment</span> Submit Complaint
                          </button>
                        )
                      )}

                      {role === 'auditor' && !isVerified && (
                        <button
                          onClick={() => handleSealRecord(repair.id)}
                          disabled={actioningId === repair.id}
                          className="flex-1 bg-tertiary text-on-tertiary font-label-bold py-3 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 transition-transform hover:-translate-y-[2px] active:scale-95 shadow-sm"
                        >
                          <span className="material-symbols-outlined text-[18px]">key</span> {actioningId === repair.id ? "Signing..." : "Release Funds & Seal EVM"}
                        </button>
                      )}
                    </div>
                  )}

                  {sealErrors[repair.id] && (
                    <div className="flex items-center gap-2 bg-error-container text-on-error-container p-3 rounded-lg text-[13px] font-medium mt-3">
                      <span className="material-symbols-outlined text-[18px]">warning</span> {sealErrors[repair.id]}
                    </div>
                  )}
                </div>
              </section>
            </div>
          );
        })}
      </div>
    </div>
  );
};
