import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Building, AlertTriangle, ArrowRight, TrendingUp } from 'lucide-react';

interface Contractor {
  id: string;
  name: string;
  type: string;
  total_claims_inr: number;
  fraud_flags_confirmed?: number;
}

interface ContractorDetailProps {
  contractors: Contractor[];
  onNavigate: (view: string, targetId?: string) => void;
}

export const ContractorDetail: React.FC<ContractorDetailProps> = ({ contractors, onNavigate }) => {
  const [selectedId, setSelectedId] = useState<string>('antony-waste');
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);

  useEffect(() => {
    const fetchContractorData = async () => {
      setLoading(true);
      try {
        const historyRes = await fetch(`/api/contractors/${selectedId}/tonnage`);
        const historyData = await historyRes.json();
        setHistory(historyData);

        const logsRes = await fetch(`/api/weighbridge/logs?contractor=${selectedId}&limit=10`);
        const logsData = await logsRes.json();
        setRecentLogs(logsData.logs || []);
      } catch (err) {
        console.error("Error loading contractor data", err);
      } finally {
        setLoading(false);
      }
    };
    fetchContractorData();
  }, [selectedId]);

  const activeContractor = contractors.find(c => c.id === selectedId) || contractors[0];
  const benchmark = selectedId === 'antony-waste' ? 740 : 610;

  const CustomDot = (props: any) => {
    const { cx, cy, payload } = props;
    if (payload.flagged) {
      return (
        <circle cx={cx} cy={cy} r={5} fill="#DC2626" stroke="#fff" strokeWidth={1.5} className="animate-pulse" />
      );
    }
    return null;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Page Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
        <div>
          <h1 className="t-h1">Contractor Performance Audit</h1>
          <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginTop: 4 }}>
            Municipal Billing & Benchmark Compliance
          </p>
        </div>
        
        {/* Tab switcher */}
        <div style={{ display: 'flex', gap: 4, background: '#F3F4F6', padding: 4, borderRadius: 8, border: '1px solid var(--color-border)' }}>
          {contractors.filter(c => c.type === 'waste').map(c => {
            const isSelected = selectedId === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: isSelected ? 600 : 500,
                  color: isSelected ? 'var(--color-text-base)' : 'var(--color-text-muted)',
                  background: isSelected ? 'var(--color-surface)' : 'transparent',
                  border: 'none',
                  boxShadow: isSelected ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                {c.name.split(' ')[0]} {c.name.split(' ')[1]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Metrics Row */}
      {activeContractor && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          <div className="metric-card">
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div className="metric-icon" style={{ background: '#F3F4F6' }}>
                <Building size={20} style={{ color: 'var(--color-text-muted)' }} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div className="metric-label">Corporate Entity</div>
                <div className="t-h3" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {activeContractor.name}
                </div>
              </div>
            </div>
          </div>
          
          <div className="metric-card">
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div className="metric-icon" style={{ background: '#DBEAFE' }}>
                <TrendingUp size={20} style={{ color: '#1E40AF' }} />
              </div>
              <div>
                <div className="metric-label">Claimed Billings</div>
                <div className="metric-value" style={{ fontSize: 24 }}>
                  ₹{(activeContractor.total_claims_inr / 10000000).toFixed(2)} Cr
                </div>
              </div>
            </div>
          </div>

          <div className="metric-card">
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div className="metric-icon" style={{ background: '#F3F4F6' }}>
                <TrendingUp size={20} style={{ color: 'var(--color-text-muted)' }} />
              </div>
              <div>
                <div className="metric-label">Target Benchmark</div>
                <div className="metric-value" style={{ fontSize: 24 }}>
                  {benchmark} <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-muted)' }}>MT/day</span>
                </div>
              </div>
            </div>
          </div>

          <div className="metric-card">
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div className="metric-icon" style={{ background: (activeContractor.fraud_flags_confirmed || 0) > 0 ? '#FEE2E2' : '#D1FAE5' }}>
                <AlertTriangle size={20} style={{ color: (activeContractor.fraud_flags_confirmed || 0) > 0 ? '#DC2626' : '#059669' }} />
              </div>
              <div>
                <div className="metric-label">Confirmed Violations</div>
                <div className="metric-value" style={{ fontSize: 24, color: (activeContractor.fraud_flags_confirmed || 0) > 0 ? '#DC2626' : '#059669' }}>
                  {activeContractor.fraud_flags_confirmed || 0}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="card" style={{ padding: '24px' }}>
        <div style={{ marginBottom: 20 }}>
          <h2 className="t-h2" style={{ marginBottom: 4 }}>Daily Tonnage Audit (Q2–Q3 2026)</h2>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: 0 }}>
            Red indicator dots represent anomalous days flagged by geographical trip verification.
          </p>
        </div>

        {loading ? (
          <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Loading tonnage series...</span>
          </div>
        ) : (
          <div style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="historyGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-accent)" stopOpacity={0.12}/>
                    <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB"/>
                <XAxis dataKey="date" stroke="#9CA3AF" tickLine={false} style={{ fontSize: 12, fontFamily: 'Inter, sans-serif' }} />
                <YAxis stroke="#9CA3AF" tickLine={false} style={{ fontSize: 12, fontFamily: 'Inter, sans-serif' }} tickFormatter={(val) => `${val} MT`} />
                <Tooltip 
                  contentStyle={{ 
                    background: 'var(--color-surface)', 
                    border: '1px solid var(--color-border)',
                    borderRadius: 6,
                    fontSize: 12,
                    fontFamily: 'Inter, sans-serif',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }} 
                />
                <ReferenceLine y={benchmark} stroke="#6B7280" strokeDasharray="4 4" label={{ value: 'Target', position: 'top', fill: '#6B7280', fontSize: 11 }} />
                <Area 
                  type="monotone" 
                  dataKey="tonnage_mt" 
                  stroke="var(--color-accent)" 
                  strokeWidth={2} 
                  fillOpacity={1} 
                  fill="url(#historyGrad)" 
                  name="Daily Weight (MT)"
                  dot={<CustomDot />}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Data Table */}
      <div className="card">
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--color-border)' }}>
          <h2 className="t-h2" style={{ marginBottom: 4 }}>Recent Weighbridge Filings</h2>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: 0 }}>Latest 10 logs secured on the ledger.</p>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Ticket ID</th>
                <th>Truck ID</th>
                <th>Filing Time</th>
                <th>Weight Registered</th>
                <th>Ledger Status</th>
                <th>Merkle Hash</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {recentLogs.map((log) => {
                const isFlagged = log.status === 'flagged';
                const isReview = log.status === 'under_review';
                return (
                  <tr key={log.id}>
                    <td style={{ fontWeight: 500 }}>{log.id}</td>
                    <td>{log.truck_id}</td>
                    <td style={{ color: 'var(--color-text-muted)' }}>{new Date(log.timestamp).toLocaleString()}</td>
                    <td>{log.weight_kg.toLocaleString()} kg</td>
                    <td>
                      {isFlagged && <span className="badge badge-err">GPS Contradiction</span>}
                      {isReview && <span className="badge badge-warn">ML Outlier</span>}
                      {!isFlagged && !isReview && <span className="badge badge-ok">Secured</span>}
                    </td>
                    <td className="t-mono t-small">
                      {log.tx_hash ? `${log.tx_hash.slice(0, 10)}...${log.tx_hash.slice(-8)}` : 'Pending'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button 
                        onClick={() => onNavigate("flags", log.id)}
                        className="btn-ghost"
                        style={{ padding: '4px 10px', fontSize: 12 }}
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
