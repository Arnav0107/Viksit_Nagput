import React, { useState, useEffect } from 'react';
import { CheckCircle, Clock, MapPin, MessageSquare, Key } from 'lucide-react';

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
}

export const RoadRepairs: React.FC<RoadRepairsProps> = ({ role }) => {
  const [repairs, setRepairs] = useState<RoadRepair[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actioningId, setActioningId] = useState<string | null>(null);

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

  const handleFileComplaint = async (repairId: string) => {
    setActioningId(repairId);
    try {
      const res = await fetch(`/api/road-repairs/${repairId}/complaint`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.status === 'success') {
        fetchRepairs();
      }
    } catch (err) {
      console.error("Error filing complaint", err);
    } finally {
      setActioningId(null);
    }
  };

  const handleSealRecord = async (repairId: string) => {
    setActioningId(repairId);
    try {
      const res = await fetch('/api/blockchain/lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'road', id: repairId })
      });
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

              {/* On-chain seal detail and buttons */}
              <div className="border-t border-dashed border-dossier-border pt-4 space-y-4">
                {repair.tx_hash && (
                  <div className="font-mono text-[9px] text-dossier-text flex flex-col gap-0.5 bg-dossier-bg p-2 border border-dossier-border">
                    <div className="flex items-center gap-1 text-status-verified font-bold uppercase">
                      <CheckCircle size={10} />
                      <span>ON-CHAIN SLA SEAL RECORDED:</span>
                    </div>
                    <span className="truncate select-all text-dossier-muted font-bold">{repair.tx_hash}</span>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => handleFileComplaint(repair.id)}
                    disabled={actioningId === repair.id || isVerified}
                    className="flex-1 flex items-center justify-center gap-1.5 border border-status-flagged text-status-flagged py-2 text-xs font-mono font-bold hover:bg-status-flagged/5 transition-colors uppercase disabled:opacity-50 cursor-pointer"
                  >
                    <MessageSquare size={13} />
                    {actioningId === repair.id ? "Sealing GPS..." : "Submit Complaint"}
                  </button>

                  {role !== 'public' && !isVerified && (
                    <button
                      onClick={() => handleSealRecord(repair.id)}
                      disabled={actioningId === repair.id}
                      className="flex-1 flex items-center justify-center gap-1.5 border border-status-verified text-status-verified py-2 text-xs font-mono font-bold hover:bg-status-verified/5 transition-colors uppercase disabled:opacity-50 cursor-pointer"
                    >
                      <Key size={13} />
                      {actioningId === repair.id ? "Signing..." : "Release Funds / Seal"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
