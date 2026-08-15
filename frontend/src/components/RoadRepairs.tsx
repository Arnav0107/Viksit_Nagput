import React, { useState, useEffect } from 'react';
import { CheckCircle, Clock, MapPin, MessageSquare, Key, AlertTriangle, Send, X, ShieldCheck } from 'lucide-react';

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
}

const STORAGE_KEY = 'auditchain_reported_repairs';

export const RoadRepairs: React.FC<RoadRepairsProps> = ({ role, token, onAuthError }) => {
  const [repairs, setRepairs] = useState<RoadRepair[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actioningId, setActioningId] = useState<string | null>(null);

  // Track reported repairs across sessions / reloads
  const [reportedIds, setReportedIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Active inline complaint submission state
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

  useEffect(() => {
    fetchRepairs();
  }, []);

  const markAsReported = (repairId: string) => {
    setReportedIds((prev) => {
      if (prev.includes(repairId)) return prev;
      const next = [...prev, repairId];
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch (e) {
        console.error("Failed to save reported ID to localStorage", e);
      }
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
      setComplaintErrors((prev) => ({
        ...prev,
        [repairId]: "Complaint description must be at least 10 characters long."
      }));
      return;
    }

    setActioningId(repairId);
    setComplaintErrors((prev) => ({ ...prev, [repairId]: '' }));
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(`/api/road-repairs/${repairId}/complaint`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ description: trimmed })
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 409) {
        markAsReported(repairId);
        setActiveComplaintId(null);
        setComplaintErrors((prev) => ({
          ...prev,
          [repairId]: "You've already submitted a report for this case."
        }));
        return;
      }

      if (res.status === 403) {
        setComplaintErrors((prev) => ({
          ...prev,
          [repairId]: data.detail || "Internal officer and auditor accounts are prohibited from filing complaints."
        }));
        return;
      }

      if (res.status === 400) {
        setComplaintErrors((prev) => ({
          ...prev,
          [repairId]: data.detail || "Complaint description must be at least 10 characters."
        }));
        return;
      }

      if (!res.ok) {
        setComplaintErrors((prev) => ({
          ...prev,
          [repairId]: data.detail || "Failed to submit complaint. Please try again."
        }));
        return;
      }

      if (data.status === 'success') {
        markAsReported(repairId);
        setComplaintSuccesses((prev) => ({
          ...prev,
          [repairId]: "Complaint registered successfully! Telemetry updated."
        }));
        setActiveComplaintId(null);
        setComplaintText('');
        fetchRepairs();

        // Clear success message after 6 seconds
        setTimeout(() => {
          setComplaintSuccesses((prev) => {
            const next = { ...prev };
            delete next[repairId];
            return next;
          });
        }, 6000);
      }
    } catch (err) {
      console.error("Error filing complaint", err);
      setComplaintErrors((prev) => ({
        ...prev,
        [repairId]: "Network error occurred while submitting complaint."
      }));
    } finally {
      setActioningId(null);
    }
  };

  const handleSealRecord = async (repairId: string) => {
    setActioningId(repairId);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/blockchain/lock', {
        method: 'POST',
        headers,
        body: JSON.stringify({ type: 'road', id: repairId })
      });

      if (res.status === 401 || res.status === 403) {
        const errData = await res.json().catch(() => ({}));
        onAuthError?.(errData.detail || 'Authorization failed (401/403). Only auditors can seal records on-chain.');
        return;
      }

      const data = await res.json();
      if (data.status === 'success') {
        fetchRepairs();
      }
    } catch (err) {
      console.error("Error sealing repair record", err);
    } finally {
      setActioningId(null);
    }
  };

  const calculateDaysLeft = (expiryStr: string) => {
    const expiry = new Date(expiryStr);
    const today = new Date();
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 font-mono text-xs text-dossier-text">
        <span className="animate-pulse">PARSING ROAD RESTORATION RECORDS...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-dossier-border pb-4">
        <h1 className="font-serif text-3xl font-black uppercase tracking-tight text-dossier-text">Road-Repair SLA Tracker</h1>
        <p className="text-xs text-dossier-muted font-mono mt-0.5 uppercase font-bold">EXHIBIT C: AMRUT YOJANA ROAD RESTORATION COMPLIANCE</p>
      </div>

      <div className="bg-status-review/5 border border-status-review/25 p-4 font-mono text-xs text-dossier-text">
        <span className="text-status-review font-bold uppercase block mb-1">Audit Policy Checklist:</span>
        <p className="leading-relaxed font-sans text-xs text-dossier-text mt-1.5 font-medium">
          Amrut Yojana road-repair contractors are required to restore excavated pipeline roads to a level asphalt grade. 
          AuditChain enforces a 30-day citizen complaint SLA window. 
          If more than 3 complaints are validated by GPS tags, contract funds are automatically held, and an audit breach is registered on-chain.
        </p>
      </div>

      {/* Grid of SLA repair cards */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {repairs.map((repair) => {
          const daysLeft = calculateDaysLeft(repair.sla_expiry_date);
          const isBreached = repair.status === 'breached';
          const isVerified = repair.status === 'verified';
          const isFormOpen = activeComplaintId === repair.id;
          const currentError = complaintErrors[repair.id];
          const currentSuccess = complaintSuccesses[repair.id];
          const hasAlreadyReported = reportedIds.includes(repair.id);
          
          return (
            <div 
              key={repair.id} 
              className={`border p-6 bg-dossier-card transition-all flex flex-col justify-between rounded-none ${
                isBreached 
                  ? 'border-status-flagged bg-status-flagged/5' 
                  : isVerified 
                    ? 'border-status-verified bg-status-verified/5' 
                    : 'border-dossier-border'
              }`}
            >
              <div>
                {/* Zone and status header */}
                <div className="flex justify-between items-start pb-3 border-b border-dossier-border mb-4">
                  <div>
                    <span className="font-mono text-[9px] text-dossier-muted block uppercase font-bold">Contract Ref: {repair.id}</span>
                    <h3 className="font-serif text-lg font-black uppercase text-dossier-text mt-0.5">{repair.ward_name}</h3>
                  </div>
                  
                  <div>
                    {isBreached && (
                      <span className="font-mono text-[9px] font-bold border border-status-flagged text-status-flagged px-2 py-0.5 uppercase bg-status-flagged/10">
                        SLA BREACHED
                      </span>
                    )}
                    {isVerified && (
                      <span className="font-mono text-[9px] font-bold border border-status-verified text-status-verified px-2 py-0.5 uppercase bg-status-verified/10">
                        AUDIT APPROVED
                      </span>
                    )}
                    {!isBreached && !isVerified && (
                      <span className="font-mono text-[9px] font-bold border border-status-review text-status-review px-2 py-0.5 uppercase bg-status-review/10 animate-pulse">
                        SLA INSPECTION OPEN
                      </span>
                    )}
                  </div>
                </div>

                {/* Telemetry info parameters */}
                <div className="grid grid-cols-2 gap-4 font-mono text-[10px] text-dossier-text mb-6">
                  <div>
                    <span className="text-dossier-muted block uppercase text-[9px] font-bold">Contractor:</span>
                    <span className="font-bold text-dossier-text">{repair.contractor_name}</span>
                  </div>
                  <div>
                    <span className="text-dossier-muted block uppercase text-[9px] font-bold">GIS Location:</span>
                    <span className="font-bold text-dossier-text flex items-center gap-1">
                      <MapPin size={10} className="text-status-review" />
                      {repair.location_gps}
                    </span>
                  </div>
                  <div>
                    <span className="text-dossier-muted block uppercase text-[9px] font-bold">Inspection Window:</span>
                    {isVerified ? (
                      <span className="font-bold text-status-verified uppercase text-[9px]">Audit Cleared</span>
                    ) : daysLeft > 0 ? (
                      <span className="font-bold text-status-review flex items-center gap-1 text-[9px]">
                        <Clock size={10} />
                        {daysLeft} days remaining
                      </span>
                    ) : (
                      <span className="font-bold text-status-flagged uppercase text-[9px]">Inspection Closed</span>
                    )}
                  </div>
                  <div>
                    <span className="text-dossier-muted block uppercase text-[9px] font-bold">Citizen Submissions:</span>
                    <span className={`font-bold ${isBreached ? 'text-status-flagged text-xs' : 'text-dossier-text'}`}>
                      {repair.complaints_count} Reports Filed
                    </span>
                  </div>
                </div>

                {/* Before/After Photo exhibits */}
                <div className="grid grid-cols-2 gap-4 my-6">
                  <div className="space-y-1.5">
                    <span className="font-mono text-[9px] text-dossier-muted block uppercase font-bold">EXHIBIT C-1 (EXCAVATION):</span>
                    <div className="border border-dossier-border h-36 bg-dossier-bg overflow-hidden relative rounded-none">
                      <img 
                        src={repair.before_photo_url} 
                        alt="Excavated road trench" 
                        className="w-full h-full object-cover grayscale contrast-125 hover:grayscale-0 transition-all duration-150" 
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <span className="font-mono text-[9px] text-dossier-muted block uppercase font-bold">EXHIBIT C-2 (RESTORATION):</span>
                    <div className="border border-dossier-border h-36 bg-dossier-bg overflow-hidden relative rounded-none">
                      <img 
                        src={repair.after_photo_url} 
                        alt="Restored asphalt patch" 
                        className="w-full h-full object-cover grayscale contrast-110 hover:grayscale-0 transition-all duration-150" 
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* On-chain seal detail, feedback notifications and action buttons */}
              <div className="border-t border-dashed border-dossier-border pt-4 space-y-3">
                {repair.tx_hash && (
                  <div className="font-mono text-[9px] text-dossier-text flex flex-col gap-0.5 bg-dossier-bg p-2 border border-dossier-border">
                    <div className="flex items-center gap-1 text-status-verified font-bold uppercase">
                      <CheckCircle size={10} />
                      <span>ON-CHAIN SLA SEAL RECORDED:</span>
                    </div>
                    <span className="truncate select-all text-dossier-muted font-bold">{repair.tx_hash}</span>
                  </div>
                )}

                {/* Success Notification */}
                {currentSuccess && (
                  <div className="font-mono text-[10px] font-bold text-status-verified bg-status-verified/10 border border-status-verified/30 p-2 flex items-center gap-1.5 animate-fadeIn">
                    <CheckCircle size={12} className="shrink-0" />
                    <span>{currentSuccess}</span>
                  </div>
                )}

                {/* Standalone Error Notification (when form is not open) */}
                {currentError && !isFormOpen && (
                  <div className="font-mono text-[10px] font-bold text-status-flagged bg-status-flagged/10 border border-status-flagged/30 p-2 flex items-center gap-1.5 animate-fadeIn">
                    <AlertTriangle size={12} className="shrink-0" />
                    <span>{currentError}</span>
                  </div>
                )}

                {/* Inline Complaint Input Form */}
                {isFormOpen && (
                  <div className="border border-status-flagged/40 bg-status-flagged/5 p-3 space-y-2.5">
                    <div className="flex justify-between items-center">
                      <label className="font-mono text-[10px] font-bold uppercase text-status-flagged flex items-center gap-1">
                        <MessageSquare size={11} />
                        <span>Describe the issue you observed:</span>
                      </label>
                      <span className={`font-mono text-[9px] font-bold ${complaintText.trim().length >= 10 ? 'text-status-verified' : 'text-dossier-muted'}`}>
                        {complaintText.trim().length}/10 min chars
                      </span>
                    </div>

                    <textarea
                      value={complaintText}
                      onChange={(e) => setComplaintText(e.target.value)}
                      placeholder="Describe the defect in detail (e.g. trench left unrepaired, substandard asphalt grade, hazardous rubble/debris)..."
                      rows={3}
                      className="w-full bg-dossier-bg border border-dossier-border p-2 font-mono text-xs text-dossier-text placeholder:text-dossier-muted focus:border-status-flagged focus:outline-none resize-none"
                      disabled={actioningId === repair.id}
                      autoFocus
                    />

                    {currentError && (
                      <div className="font-mono text-[10px] font-bold text-status-flagged bg-status-flagged/10 border border-status-flagged/30 p-1.5 flex items-center gap-1">
                        <AlertTriangle size={11} className="shrink-0" />
                        <span>{currentError}</span>
                      </div>
                    )}

                    <div className="flex gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => handleCancelComplaint(repair.id)}
                        disabled={actioningId === repair.id}
                        className="px-3 py-1.5 border border-dossier-border text-dossier-muted font-mono text-[10px] font-bold uppercase hover:bg-dossier-text/5 cursor-pointer disabled:opacity-50 flex items-center gap-1"
                      >
                        <X size={11} />
                        <span>Cancel</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleFileComplaint(repair.id)}
                        disabled={actioningId === repair.id || complaintText.trim().length < 10}
                        className="px-3.5 py-1.5 border border-status-flagged bg-status-flagged text-white font-mono text-[10px] font-bold uppercase hover:bg-status-flagged/90 cursor-pointer disabled:opacity-50 flex items-center gap-1"
                      >
                        <Send size={11} />
                        <span>{actioningId === repair.id ? "Submitting..." : "Submit Complaint"}</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Primary Action Buttons */}
                {!isFormOpen && (
                  <div className="flex gap-3">
                    {/* Citizen Complaint button: Hidden entirely for officer/auditor roles */}
                    {!isRestrictedRole && (
                      <>
                        {hasAlreadyReported ? (
                          <div className="flex-1 flex items-center justify-center gap-1.5 border border-status-verified/30 bg-status-verified/10 text-status-verified py-2 text-xs font-mono font-bold uppercase select-none cursor-not-allowed">
                            <ShieldCheck size={13} className="text-status-verified" />
                            <span>You already reported this case</span>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleOpenComplaintForm(repair.id)}
                            disabled={actioningId === repair.id || isVerified}
                            className="flex-1 flex items-center justify-center gap-1.5 border border-status-flagged text-status-flagged py-2 text-xs font-mono font-bold hover:bg-status-flagged/5 transition-colors uppercase disabled:opacity-50 cursor-pointer"
                          >
                            <MessageSquare size={13} />
                            <span>Submit Complaint</span>
                          </button>
                        )}
                      </>
                    )}

                    {/* Lead Auditor Seal button: restricted strictly to auditor role */}
                    {role === 'auditor' && !isVerified && (
                      <button
                        onClick={() => handleSealRecord(repair.id)}
                        disabled={actioningId === repair.id}
                        className="flex-1 flex items-center justify-center gap-1.5 border border-status-verified text-status-verified py-2 text-xs font-mono font-bold hover:bg-status-verified/5 transition-colors uppercase disabled:opacity-50 cursor-pointer"
                      >
                        <Key size={13} />
                        <span>{actioningId === repair.id ? "Signing..." : "Release Funds / Seal"}</span>
                      </button>
                    )}
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
