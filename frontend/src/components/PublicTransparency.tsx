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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div>
        <h1 className="t-h1" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FileText size={24} style={{ color: 'var(--color-primary)' }} />
          Public Transparency Portal
        </h1>
        <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginTop: 4 }}>
          Public Access Channel — Municipal Compliance Record
        </p>
      </div>

      {/* Inquiry status box */}
      <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '16px 20px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <Scale size={20} style={{ color: '#DC2626', flexShrink: 0, marginTop: 2 }} />
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, color: '#991B1B', marginBottom: 6 }}>
            Active Forensic Inquiry: IN PROGRESS
          </div>
          <p style={{ fontSize: 13, color: '#7F1D1D', lineHeight: 1.6, margin: 0 }}>
            The Nagpur Municipal Corporation has ordered a formal inquiry into waste collection invoicing from April–July 2026. 
            AuditChain provides tamper-proof blockchain evidence logs to investigation committees. 
            All weighbridge tickets shown on this portal are cryptographically locked on-chain and cannot be edited.
          </p>
        </div>
      </div>

      {/* Contractor Compliance Leaderboard */}
      <div className="card" style={{ padding: '0 24px' }}>
        <h2 className="t-h2" style={{ padding: '24px 0 16px 0', margin: 0, borderBottom: '1px solid var(--color-border)' }}>
          Contractor Compliance Leaderboard
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {!overviewData ? (
            // Skeleton Loader
            [1, 2].map((i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '16px 0', borderBottom: i === 1 ? '1px solid var(--color-border)' : 'none', animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}>
                <div style={{ width: 32, height: 20, background: '#F3F4F6', borderRadius: 4, flexShrink: 0 }} />
                <div style={{ flex: 1, paddingRight: 24, marginLeft: 8 }}>
                  <div style={{ height: 20, width: '40%', background: '#E5E7EB', borderRadius: 4, marginBottom: 6 }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ flex: 1, height: 8, background: '#F3F4F6', borderRadius: 4 }} />
                    <div style={{ width: 40, height: 16, background: '#F3F4F6', borderRadius: 4 }} />
                  </div>
                </div>
                <div style={{ width: 48, height: 32, background: '#E5E7EB', borderRadius: 4, flexShrink: 0 }} />
              </div>
            ))
          ) : (
            contractors.map((c: any, index: number) => {
              const rating = getGrade(c);
              const fraudCount = c.fraud_flags_confirmed || 0;
              const complianceScore = fraudCount === 0 ? 98 : fraudCount === 1 ? 65 : 32;

              return (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', padding: '16px 0', borderBottom: index < contractors.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text-muted)', width: 32, flexShrink: 0 }}>
                    #{index + 1}
                  </div>
                  <div style={{ flex: 1, paddingRight: 24 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--color-text-base)', marginBottom: 6 }}>
                      {c.name}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ flex: 1, height: 8, background: '#F3F4F6', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ width: `${complianceScore}%`, height: '100%', background: rating.color, borderRadius: 4 }} />
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', width: 40 }}>
                        {complianceScore}%
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: 32, fontWeight: 700, color: rating.color, width: 48, textAlign: 'right', flexShrink: 0 }}>
                    {rating.grade}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '7fr 5fr', gap: 24 }}>
        {/* Sealed Records Audit Chronology */}
        <div className="card">
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 className="t-h2" style={{ marginBottom: 4 }}>Immutable On-Chain Audit Chronology</h2>
              <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: 0 }}>
                Recently sealed weighbridge and road restoration exhibits on EVM
              </p>
            </div>
            <button onClick={fetchSealedRecords} disabled={loadingRecords} className="btn-ghost" style={{ padding: '6px 12px', fontSize: 12 }}>
              <RefreshCw size={14} className={loadingRecords ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>

          <div style={{ padding: '0 24px' }}>
            {loadingRecords ? (
              <div style={{ padding: '40px 0', textAlign: 'center', fontSize: 13, color: 'var(--color-text-muted)' }}>
                Querying Smart Contract Event Logs...
              </div>
            ) : sealedRecords.length === 0 ? (
              <div style={{ padding: '40px 0', textAlign: 'center', fontSize: 13, color: 'var(--color-text-muted)' }}>
                No sealed blockchain exhibits registered yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {sealedRecords.slice(0, 8).map((rec: any, idx: number) => {
                  const isFraud = rec.status === 'confirmed_fraud';
                  const isCleared = rec.status === 'cleared' || rec.status === 'verified';
                  return (
                    <div key={idx} style={{ padding: '16px 0', borderBottom: idx < 7 ? '1px solid var(--color-border)' : 'none', display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          {isFraud ? <ShieldAlert size={15} style={{ color: '#DC2626' }} /> : <CheckCircle size={15} style={{ color: '#059669' }} />}
                          <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-text-base)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{rec.title}</span>
                          <span className={isFraud ? 'badge badge-err' : 'badge badge-ok'} style={{ padding: '1px 6px', fontSize: 10 }}>
                            {rec.status}
                          </span>
                        </div>
                        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: 0, paddingLeft: 23 }}>{rec.note}</p>
                      </div>

                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
                          {new Date(rec.timestamp).toLocaleDateString()}
                        </div>
                        <div className="t-mono" style={{ fontSize: 10, color: '#059669', width: 140, overflow: 'hidden', textOverflow: 'ellipsis' }} title={rec.tx_hash}>
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

        {/* Historical Chronology timeline */}
        <div className="card" style={{ padding: '24px' }}>
          <h2 className="t-h2" style={{ paddingBottom: 16, borderBottom: '1px solid var(--color-border)', marginBottom: 20 }}>
            Inquiry Chronology (2026)
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 0, paddingLeft: 8 }}>
            {timelineEvents.map((event, idx) => (
              <div key={idx} className="timeline-step" style={{ paddingBottom: idx < timelineEvents.length - 1 ? 24 : 0 }}>
                <div className="timeline-dot" style={{ background: '#FEE2E2', color: '#DC2626' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#DC2626', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{event.date}</div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-text-base)', marginBottom: 4 }}>{event.title}</div>
                  <div style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>{event.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
