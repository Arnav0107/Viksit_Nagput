import React, { useState, useEffect } from 'react';
import { CheckCircle, Clock, MapPin, MessageSquare, Key, AlertTriangle, Send, X, ShieldCheck, FileSpreadsheet, Info } from 'lucide-react';

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

export const RoadRepairs: React.FC<RoadRepairsProps> = ({ role, token, onAuthError, onPushWeb3Log }) => {
  const [repairs, setRepairs] = useState<RoadRepair[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [sealErrors, setSealErrors] = useState<{ [repairId: string]: string }>({});

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
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch (e) {}
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div>
        <h1 className="t-h1" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FileSpreadsheet size={24} style={{ color: 'var(--color-primary)' }} />
          Road-Repair SLA Tracker
        </h1>
        <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginTop: 4 }}>
          Amrut Yojana Restoration Compliance
        </p>
      </div>

      {/* Policy Notice */}
      <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8, padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <Info size={18} style={{ color: '#1E40AF', flexShrink: 0, marginTop: 1 }} />
        <div>
          <div style={{ fontWeight: 600, fontSize: 13, color: '#1E3A8A', marginBottom: 4 }}>Audit Policy</div>
          <p style={{ fontSize: 13, color: '#1E40AF', lineHeight: 1.6, margin: 0 }}>
            Contractors are required to restore excavated pipeline roads to a level asphalt grade. 
            AuditChain enforces a 30-day citizen complaint SLA window. If &gt;3 complaints are filed, 
            contract funds are automatically held, and an audit breach is registered on-chain.
          </p>
        </div>
      </div>

      {/* Grid of SLA repair cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {repairs.map((repair) => {
          const daysLeft = calculateDaysLeft(repair.sla_expiry_date);
          const isBreached = repair.status === 'breached';
          const isVerified = repair.status === 'verified';
          const isFormOpen = activeComplaintId === repair.id;
          const currentError = complaintErrors[repair.id];
          const currentSuccess = complaintSuccesses[repair.id];
          const hasAlreadyReported = reportedIds.includes(repair.id);

          return (
            <div key={repair.id} className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ padding: '20px 24px', flex: 1 }}>
                
                {/* Card Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600, letterSpacing: '0.05em', marginBottom: 4, textTransform: 'uppercase' }}>
                      Ref: {repair.id}
                    </div>
                    <h3 className="t-h2" style={{ margin: 0 }}>{repair.ward_name}</h3>
                  </div>
                  <div>
                    {isBreached && <span className="badge badge-err">SLA Breach</span>}
                    {isVerified && <span className="badge badge-ok"><CheckCircle size={12} /> Audit Cleared</span>}
                    {!isBreached && !isVerified && <span className="badge badge-warn">Inspection Open</span>}
                  </div>
                </div>

                {/* Info Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                  <div>
                    <div className="t-small" style={{ fontWeight: 600, marginBottom: 4 }}>Contractor</div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{repair.contractor_name}</div>
                  </div>
                  <div>
                    <div className="t-small" style={{ fontWeight: 600, marginBottom: 4 }}>Location</div>
                    <div style={{ fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <MapPin size={13} style={{ color: 'var(--color-text-muted)' }} />
                      {repair.location_gps}
                    </div>
                  </div>
                  <div>
                    <div className="t-small" style={{ fontWeight: 600, marginBottom: 4 }}>Window</div>
                    {isVerified ? (
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#059669' }}>Closed</span>
                    ) : daysLeft > 0 ? (
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#D97706', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={13} /> {daysLeft} days left
                      </span>
                    ) : (
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#DC2626' }}>Closed</span>
                    )}
                  </div>
                  <div>
                    <div className="t-small" style={{ fontWeight: 600, marginBottom: 4 }}>Complaints</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: isBreached ? '#DC2626' : 'var(--color-text-base)' }}>
                      {repair.complaints_count} filed
                    </div>
                  </div>
                </div>

                {/* Photos */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <div className="t-small" style={{ fontWeight: 600, marginBottom: 6 }}>Excavation</div>
                    <div style={{ height: 140, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--color-border)', background: '#F3F4F6' }}>
                      <img src={repair.before_photo_url} alt="Before" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  </div>
                  <div>
                    <div className="t-small" style={{ fontWeight: 600, marginBottom: 6 }}>Restoration</div>
                    <div style={{ height: 140, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--color-border)', background: '#F3F4F6' }}>
                      <img src={repair.after_photo_url} alt="After" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  </div>
                </div>

              </div>

              {/* Action Area */}
              <div style={{ background: '#F9FAFB', borderTop: '1px solid var(--color-border)', padding: '16px 24px' }}>
                {repair.tx_hash && (
                  <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 6, padding: '10px 12px', marginBottom: 12 }}>
                    <div style={{ fontSize: 11, color: '#065F46', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>On-Chain Seal Recorded</div>
                    <div className="t-mono" style={{ fontSize: 11, color: '#374151', wordBreak: 'break-all' }}>{repair.tx_hash}</div>
                  </div>
                )}

                {currentSuccess && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#D1FAE5', color: '#065F46', padding: '10px 14px', borderRadius: 6, fontSize: 13, fontWeight: 500, marginBottom: 12 }}>
                    <CheckCircle size={15} /> {currentSuccess}
                  </div>
                )}

                {currentError && !isFormOpen && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#FEE2E2', color: '#991B1B', padding: '10px 14px', borderRadius: 6, fontSize: 13, fontWeight: 500, marginBottom: 12 }}>
                    <AlertTriangle size={15} /> {currentError}
                  </div>
                )}

                {isFormOpen ? (
                  <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 8, padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-base)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <MessageSquare size={14} /> Describe Issue
                      </label>
                      <span style={{ fontSize: 11, fontWeight: 500, color: complaintText.trim().length >= 10 ? '#059669' : 'var(--color-text-muted)' }}>
                        {complaintText.trim().length}/10 min
                      </span>
                    </div>
                    <textarea
                      value={complaintText}
                      onChange={(e) => setComplaintText(e.target.value)}
                      placeholder="Describe the defect in detail (e.g. trench left unrepaired, hazardous rubble)..."
                      rows={3}
                      disabled={actioningId === repair.id}
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: 13, fontFamily: 'Inter, sans-serif', resize: 'none', outline: 'none', marginBottom: 12 }}
                      autoFocus
                    />
                    {currentError && <div style={{ fontSize: 12, color: '#DC2626', marginBottom: 12 }}>{currentError}</div>}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                      <button onClick={() => handleCancelComplaint(repair.id)} disabled={actioningId === repair.id} className="btn-ghost">Cancel</button>
                      <button onClick={() => handleFileComplaint(repair.id)} disabled={actioningId === repair.id || complaintText.trim().length < 10} className="btn-primary">
                        <Send size={14} /> {actioningId === repair.id ? "Submitting..." : "Submit Complaint"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 12 }}>
                    {!isRestrictedRole && (
                      hasAlreadyReported ? (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#F3F4F6', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)', borderRadius: 6, padding: '8px 16px', fontSize: 13, fontWeight: 500 }}>
                          <ShieldCheck size={14} /> Already Reported
                        </div>
                      ) : (
                        <button
                          onClick={() => handleOpenComplaintForm(repair.id)}
                          disabled={actioningId === repair.id || isVerified}
                          className="btn-primary"
                          style={{ flex: 1, justifyContent: 'center' }}
                        >
                          <MessageSquare size={14} /> Submit Complaint
                        </button>
                      )
                    )}

                    {role === 'auditor' && !isVerified && (
                      <button
                        onClick={() => handleSealRecord(repair.id)}
                        disabled={actioningId === repair.id}
                        className="btn-success"
                        style={{ flex: 1, justifyContent: 'center' }}
                      >
                        <Key size={14} /> {actioningId === repair.id ? "Signing..." : "Release Funds & Seal EVM"}
                      </button>
                    )}
                  </div>
                )}
                
                {sealErrors[repair.id] && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#FEE2E2', color: '#991B1B', padding: '10px 14px', borderRadius: 6, fontSize: 13, fontWeight: 500, marginTop: 12 }}>
                    <AlertTriangle size={15} /> {sealErrors[repair.id]}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
