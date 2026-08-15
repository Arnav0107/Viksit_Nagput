import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

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
        <circle cx={cx} cy={cy} r={5} fill="var(--color-status-flagged)" stroke="#fff" strokeWidth={1.5} className="animate-pulse" />
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="border-b border-dossier-border pb-4 flex flex-col md:flex-row justify-between items-start md:items-center">
        <div>
          <h1 className="font-serif text-3xl font-black uppercase tracking-tight text-dossier-text">Contractor Performance Audit</h1>
          <p className="text-xs text-dossier-muted font-mono mt-0.5 uppercase font-bold">EXHIBIT B: MUNICIPAL BILLING & BENCHMARK COMPLIANCE</p>
        </div>
        
        {/* Contractor Switcher Tabs */}
        <div className="flex gap-1 mt-4 md:mt-0 font-mono text-xs border border-dossier-border p-1 bg-dossier-bg">
          {contractors.filter(c => c.type === 'waste').map(c => (
            <button
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              className={`px-3 py-1.5 uppercase font-bold transition-colors cursor-pointer ${
                selectedId === c.id 
                  ? 'bg-dossier-text text-dossier-bg' 
                  : 'hover:bg-dossier-text/5 text-dossier-text'
              }`}
            >
              {c.id === 'antony-waste' ? 'Antony Waste' : 'BVG India'}
            </button>
          ))}
        </div>
      </div>

      {/* Contractor Metrics Cards Grid */}
      {activeContractor && (
        <div className="grid grid-cols-1 md:grid-cols-4 border border-dossier-border divide-y md:divide-y-0 md:divide-x divide-dossier-border bg-dossier-card">
          <div className="p-4 flex flex-col justify-between h-24">
            <span className="font-mono text-[10px] uppercase text-dossier-muted tracking-wider font-bold">Corporate Entity</span>
            <h2 className="font-serif text-base font-extrabold text-dossier-text uppercase truncate">
              {activeContractor.name}
            </h2>
          </div>
          
          <div className="p-4 flex flex-col justify-between h-24">
            <span className="font-mono text-[10px] uppercase text-dossier-muted tracking-wider font-bold">Claimed Billings (2026)</span>
            <h2 className="font-mono text-lg font-black text-dossier-text">
              ₹{(activeContractor.total_claims_inr / 10000000).toFixed(2)} Cr
            </h2>
          </div>

          <div className="p-4 flex flex-col justify-between h-24">
            <span className="font-mono text-[10px] uppercase text-dossier-muted tracking-wider font-bold">Daily Target Benchmark</span>
            <h2 className="font-mono text-lg font-black text-dossier-text">
              {benchmark} MT / day
            </h2>
          </div>

          <div className="p-4 flex flex-col justify-between h-24">
            <span className="font-mono text-[10px] uppercase text-dossier-muted tracking-wider font-bold">Confirmed Violations</span>
            <h2 className={`font-mono text-lg font-black ${(activeContractor.fraud_flags_confirmed || 0) > 0 ? 'text-status-flagged' : 'text-status-verified'}`}>
              {activeContractor.fraud_flags_confirmed || 0} Cases Ruled
            </h2>
          </div>
        </div>
      )}

      {/* Time-Series Chart */}
      <div className="border border-dossier-border p-6 bg-dossier-card">
        <div>
          <h3 className="font-serif text-lg font-extrabold uppercase tracking-tight text-dossier-text">Daily Tonnage Audit (Q2–Q3 2026)</h3>
          <p className="text-[10px] text-dossier-muted font-mono uppercase mt-0.5 font-bold">
            RED INDICATOR DOTS REPRESENT ANOMALOUS DAYS FLAGGED BY GEOGRAPHICAL TRIP VERIFICATION
          </p>
        </div>

        {loading ? (
          <div className="h-72 flex items-center justify-center font-mono text-xs text-dossier-muted font-bold">
            <span className="animate-pulse">RECONSTRUCTING TONNAGE SERIES LOGS...</span>
          </div>
        ) : (
          <div className="h-72 mt-6">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="historyGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-status-verified)" stopOpacity={0.12}/>
                    <stop offset="95%" stopColor="var(--color-status-verified)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(42,42,42,0.08)"/>
                <XAxis dataKey="date" stroke="rgba(42,42,42,0.5)" tickLine={false} style={{ fontSize: '9px', fontFamily: 'monospace', fontWeight: 'bold' }} />
                <YAxis stroke="rgba(42,42,42,0.5)" tickLine={false} style={{ fontSize: '9px', fontFamily: 'monospace', fontWeight: 'bold' }} tickFormatter={(val) => `${val} MT`} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'var(--dossier-card)', 
                    borderColor: 'var(--dossier-border)',
                    color: 'var(--dossier-text)',
                    fontFamily: 'monospace',
                    fontSize: '11px',
                    borderRadius: '0px',
                    boxShadow: 'none'
                  }} 
                />
                <ReferenceLine y={benchmark} stroke="#8c8b7f" strokeDasharray="4 4" label={{ value: 'Generation Target', position: 'top', fill: '#8c8b7f', fontSize: 9, fontFamily: 'monospace', fontWeight: 'bold' }} />
                <Area 
                  type="monotone" 
                  dataKey="tonnage_mt" 
                  stroke="var(--color-status-verified)" 
                  strokeWidth={1.5} 
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

      {/* Tables of recent logs */}
      <div className="border border-dossier-border p-6 bg-dossier-card">
        <div className="pb-3 border-b border-dossier-border mb-4">
          <h3 className="font-serif text-lg font-extrabold uppercase tracking-tight text-dossier-text">Recent Weighbridge Filings</h3>
          <p className="text-[10px] text-dossier-muted font-mono uppercase mt-0.5 font-bold">LOCKED REGISTRY LEDGER (LATEST 10 FILINGS)</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-[11px] border-collapse text-dossier-text">
            <thead>
              <tr className="border-b border-dossier-border text-dossier-muted uppercase text-[9px] font-bold">
                <th className="py-2 px-3">Ticket ID</th>
                <th className="py-2">Truck ID</th>
                <th className="py-2">Filing Time</th>
                <th className="py-2">Weight Registered</th>
                <th className="py-2">Ledger Status</th>
                <th className="py-2">Merkle Hash</th>
                <th className="py-2 text-right pr-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dossier-border/30">
              {recentLogs.map((log) => {
                const isFlagged = log.status === 'flagged';
                const isReview = log.status === 'under_review';
                return (
                  <tr key={log.id} className="hover:bg-black/[0.01]">
                    <td className="py-2.5 px-3 font-bold">{log.id}</td>
                    <td className="font-bold">{log.truck_id}</td>
                    <td className="text-dossier-muted font-bold">{new Date(log.timestamp).toLocaleString()}</td>
                    <td className="font-bold">{log.weight_kg.toLocaleString()} kg</td>
                    <td>
                      {isFlagged && (
                        <span className="text-status-flagged font-bold uppercase text-[9px]">
                          [GPS CONTRADICTION]
                        </span>
                      )}
                      {isReview && (
                        <span className="text-status-review font-bold uppercase text-[9px]">
                          [ML OUTLIER]
                        </span>
                      )}
                      {!isFlagged && !isReview && (
                        <span className="text-status-verified font-bold uppercase text-[9px]">
                          [SECURED]
                        </span>
                      )}
                    </td>
                    <td className="text-dossier-muted text-[10px] select-all font-bold">
                      {log.tx_hash ? `${log.tx_hash.slice(0, 10)}...${log.tx_hash.slice(-8)}` : 'N/A'}
                    </td>
                    <td className="py-2.5 text-right pr-3">
                      <button 
                        onClick={() => onNavigate("flags", log.id)}
                        className="text-status-verified font-bold uppercase text-[9px] hover:underline cursor-pointer"
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
