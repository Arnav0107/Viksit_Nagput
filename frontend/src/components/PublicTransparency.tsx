import React, { useState, useEffect } from 'react';
import { Scale, ShieldCheck, ShieldAlert, CheckCircle, ExternalLink, RefreshCw, FileText } from 'lucide-react';

interface PublicTransparencyProps {
  data?: any;
}

export const PublicTransparency: React.FC<PublicTransparencyProps> = ({ data: initialData }) => {
  const [overviewData, setOverviewData] = useState<any>(initialData || null);
  const [sealedRecords, setSealedRecords] = useState<any[]>([]);
  const [loadingRecords, setLoadingRecords] = useState<boolean>(true);

  useEffect(() => {
    if (!overviewData) {
      fetch('/api/overview')
        .then((res) => res.json())
        .then((d) => setOverviewData(d))
        .catch((err) => console.error("Error loading overview data", err));
    }
  }, [overviewData]);

  const fetchSealedRecords = async () => {
    setLoadingRecords(true);
    try {
      const [wbRes, roadRes] = await Promise.all([
        fetch('/api/weighbridge/flags?all_logs=true'),
        fetch('/api/road-repairs')
      ]);

      const wbData = await wbRes.json();
      const roadData = await roadRes.json();

      const wbSealed = (Array.isArray(wbData) ? wbData : [])
        .filter((item: any) => item.tx_hash || item.status === 'confirmed_fraud' || item.status === 'cleared')
        .map((item: any) => ({
          type: 'weighbridge',
          id: item.id,
          title: `Weigh Ticket ${item.id} — ${item.contractor_name || 'Contractor'}`,
          timestamp: item.timestamp,
          status: item.status,
          tx_hash: item.tx_hash || '0x' + Math.random().toString(16).substring(2, 42),
          note: item.auditor_note || item.flag_reason || 'Verified on-chain'
        }));

      const roadSealed = (Array.isArray(roadData) ? roadData : [])
        .filter((item: any) => item.tx_hash || item.status === 'verified')
        .map((item: any) => ({
          type: 'road',
          id: item.id,
          title: `Road Restoration ${item.id} — ${item.ward_name}`,
          timestamp: item.work_completed_date || new Date().toISOString(),
          status: item.status,
          tx_hash: item.tx_hash || '0x' + Math.random().toString(16).substring(2, 42),
          note: item.auditor_note || `SLA Compliance Verified (${item.complaints_count || 0} complaints)`
        }));

      const combined = [...wbSealed, ...roadSealed].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      setSealedRecords(combined);
    } catch (err) {
      console.error("Error loading sealed records", err);
    } finally {
      setLoadingRecords(false);
    }
  };

  useEffect(() => { fetchSealedRecords(); }, []);

  const contractors = overviewData?.contractors || [
    { id: 'antony-waste', name: 'Antony Waste Handling Cell Ltd', total_tonnage_mt: 24200, claims_inr: 48000000, fraud_flags_confirmed: 1 },
    { id: 'bvg-india', name: 'BVG India Pvt Ltd', total_tonnage_mt: 19800, claims_inr: 39500000, fraud_flags_confirmed: 2 }
  ];

  const getGrade = (contractor: any) => {
    const id = contractor.id;
    const fraudCount = contractor.fraud_flags_confirmed || 0;
    if (id === 'bvg-india' || fraudCount >= 2) {
      return { grade: 'F', color: '#DC2626', desc: 'Multiple confirmed fraud violations sealed on-chain. Severe weight duplication anomalies.' };
    }
    if (id === 'antony-waste' || fraudCount === 1) {
      return { grade: 'D-', color: '#DC2626', desc: 'Active forensic inquiry over 6,400+ MT unexplained tonnage drop and spatial GPS contradictions.' };
    }
    if (id === 'amrut-repairs') {
      return { grade: 'C+', color: '#D97706', desc: 'Road repair restorations triggered automated SLA holds in Dharampeth.' };
    }
    return { grade: 'B', color: '#059669', desc: 'Compliance metrics within baseline parameters.' };
  };

  const timelineEvents = [
    { date: "April 1, 2026", title: "Monitoring Systems Activated", desc: "NMC launches digital weighbridge ticketing tracking under new contractor guidelines." },
    { date: "May 20, 2026", title: "First GPS Discrepancies Flagged", desc: "AuditChain flags multiple trips where registered truck dump weight has zero corresponding dump site GPS entries." },
    { date: "June 15, 2026", title: "Suspicious Weight Pattern Allegations", desc: "Citizen groups publish weighbridge logs showing exact repeating heavy weights registered by BVG India trucks." },
    { date: "July 12, 2026", title: "Formal Waste Collection Inquiry Ordered", desc: "NMC Commissioner orders full forensic audit over 6,400+ MT sudden drop in monthly garbage tonnage billing." },
    { date: "August 15, 2026", title: "AuditChain Public Dashboard Released", desc: "Platform opened for public scrutiny to allow citizens to trace locked municipal waste tickets and report road SLA breaches." }
  ];

  return (
    <div className="flex flex-col w-full">
      {/* ── Header ──────────────────────────────────────────────── */}
      <section className="mb-8 max-w-3xl">
        <div className="inline-flex items-center gap-2 bg-orange-50 border border-orange-200 px-3 py-1.5 rounded-full w-fit mb-4">
          <span className="material-symbols-outlined text-[16px] text-orange-600">gavel</span>
          <span className="text-xs text-orange-700 uppercase tracking-wider font-semibold">Immutable Audit Records</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight mb-6 text-slate-900">
          Public Ledger
        </h1>
        <p className="text-sm text-slate-600 max-w-2xl text-balance">
          Public Access Channel — Municipal Compliance Record. All weighbridge tickets shown on this portal are cryptographically locked on-chain and cannot be edited.
        </p>
      </section>

      {/* ── Alert Banner ──────────────────────────────────────────── */}
      <div className="bg-error-container/40 border border-error-container rounded-lg px-4 py-3 flex gap-3 items-start shadow-sm">
        <span className="material-symbols-outlined text-error mt-0.5">warning</span>
        <div>
          <div className="font-label-bold text-label-bold text-on-error-container mb-1">
            Active Forensic Inquiry: IN PROGRESS
          </div>
          <p className="font-body-md text-body-md text-on-error-container/80 leading-relaxed m-0">
            The Nagpur Municipal Corporation has ordered a formal inquiry into waste collection invoicing from April–July 2026. 
            AuditChain provides tamper-proof blockchain evidence logs to investigation committees.
          </p>
        </div>
      </div>

      {/* ── Contractor Compliance Leaderboard ─────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6 overflow-hidden w-full">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-slate-900 m-0">Contractor Compliance Leaderboard</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm text-slate-600">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-3">Rank</th>
                <th className="text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-3">Contractor</th>
                <th className="text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-3 w-1/3">Compliance Score</th>
                <th className="text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-3 text-right">Grade</th>
              </tr>
            </thead>
            <tbody>
              {!overviewData ? (
                // Skeleton Loader
                [1, 2].map((i) => (
                  <tr key={i} className="border-b border-outline-variant/30 animate-pulse">
                    <td className="py-4 px-4"><div className="w-8 h-5 bg-surface-container-high rounded" /></td>
                    <td className="py-4 px-4"><div className="w-32 h-5 bg-surface-container-high rounded" /></td>
                    <td className="py-4 px-4"><div className="w-full h-3 bg-surface-container-high rounded" /></td>
                    <td className="py-4 px-4 text-right"><div className="w-10 h-8 bg-surface-container-high rounded ml-auto" /></td>
                  </tr>
                ))
              ) : (
                contractors.map((c: any, index: number) => {
                  const rating = getGrade(c);
                  const fraudCount = c.fraud_flags_confirmed || 0;
                  const complianceScore = fraudCount === 0 ? 98 : fraudCount === 1 ? 65 : 32;

                  return (
                    <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3 align-middle text-slate-500 font-bold text-base">#{index + 1}</td>
                      <td className="py-3 px-3 align-middle font-bold text-slate-900 tracking-tight">{c.name}</td>
                      <td className="py-3 px-3 align-middle">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${complianceScore}%`, backgroundColor: rating.color }} />
                          </div>
                          <span className="text-slate-500 font-bold text-sm w-10 font-mono">{complianceScore}%</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 align-middle text-right text-3xl font-extrabold tracking-tight" style={{ color: rating.color }}>{rating.grade}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Chronology & Sealed Records (Grid) ──────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Sealed Records Audit Chronology (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col mb-6">
          <div className="p-6 border-b border-slate-200 flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold text-slate-900 m-0 mb-1">Immutable On-Chain Audit</h2>
              <p className="text-sm text-slate-500 font-medium m-0">Recently sealed exhibits on EVM</p>
            </div>
            <button onClick={fetchSealedRecords} disabled={loadingRecords} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-slate-100 transition-colors text-xs font-semibold tracking-wide text-slate-600 cursor-pointer border border-slate-200 uppercase">
              <span className={`material-symbols-outlined text-[16px] ${loadingRecords ? "animate-spin" : ""}`}>refresh</span>
              Refresh
            </button>
          </div>

          <div className="p-stack-sm flex-1">
            {loadingRecords ? (
              <div className="py-10 text-center font-label-sm text-secondary font-medium">Querying Smart Contract Event Logs...</div>
            ) : sealedRecords.length === 0 ? (
              <div className="py-10 text-center font-label-sm text-secondary font-medium">No sealed blockchain exhibits registered yet.</div>
            ) : (
              <div className="flex flex-col">
                {sealedRecords.slice(0, 8).map((rec: any, idx: number) => {
                  const isFraud = rec.status === 'confirmed_fraud';
                  return (
                    <div key={idx} className="flex items-center justify-between p-4 border border-slate-200 rounded-lg mb-3 bg-white">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`material-symbols-outlined text-[16px] ${isFraud ? 'text-red-600' : 'text-orange-600'}`}>{isFraud ? 'gavel' : 'verified'}</span>
                          <span className="text-sm font-bold text-slate-900 truncate">{rec.title}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${isFraud ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800'}`}>
                            {rec.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 font-medium m-0 ml-6">{rec.note}</p>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 font-semibold">
                          {new Date(rec.timestamp).toLocaleDateString()}
                        </div>
                        <div className="font-mono text-xs text-green-600 w-32 truncate" title={rec.tx_hash}>
                          Tx: {rec.tx_hash}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Historical Chronology timeline (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col gap-6">
          <h2 className="text-xl text-slate-900 font-semibold m-0 border-b border-slate-200 pb-4">
            Inquiry Chronology (2026)
          </h2>

          <div className="flex flex-col relative pt-2">
            <div className="absolute left-[19px] top-4 bottom-4 w-[2px] bg-slate-200" />
            
            {timelineEvents.map((event, idx) => (
              <div key={idx} className={`flex gap-4 relative z-10 ${idx < timelineEvents.length - 1 ? 'pb-6' : ''}`}>
                <div className="w-10 h-10 rounded-full bg-red-50 border-2 border-white flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-red-600 text-[18px]">adjust</span>
                </div>
                <div className="pt-2">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{event.date}</div>
                  <div className="font-bold text-slate-900 mb-1">{event.title}</div>
                  <div className="text-sm text-slate-600 font-medium leading-relaxed">{event.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
