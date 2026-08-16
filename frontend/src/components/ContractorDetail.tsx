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
        <circle cx={cx} cy={cy} r={5} fill="#E11D48" stroke="#fff" strokeWidth={2} className="animate-pulse drop-shadow-[0_0_6px_rgba(225,29,72,0.6)]" />
      );
    }
    return null;
  };

  return (
    <div className="flex flex-col w-full text-slate-900">
      {/* Page Header */}
      <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-1">Contractor Performance Audit</h1>
          <p className="text-sm text-slate-500 font-medium m-0">
            Municipal Billing & Benchmark Compliance
          </p>
        </div>
        
        {/* Tab switcher */}
        <div className="inline-flex bg-slate-100 p-1 rounded-xl border border-slate-200">
          {contractors.filter(c => c.type === 'waste').map(c => {
            const isSelected = selectedId === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all cursor-pointer ${isSelected ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
              >
                {c.name.split(' ')[0]} {c.name.split(' ')[1]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Metrics Row */}
      {activeContractor && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white/95 backdrop-blur-sm border border-slate-200/80 rounded-xl p-5 shadow-sm flex flex-col justify-between">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-slate-100">
                <Building size={20} className="text-slate-500" />
              </div>
              <div className="min-w-0">
                <div className="text-xs text-slate-500 uppercase tracking-wide font-semibold mb-1">Corporate Entity</div>
                <div className="text-2xl font-bold text-slate-900 truncate">
                  {activeContractor.name}
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-white/95 backdrop-blur-sm border border-slate-200/80 rounded-xl p-5 shadow-sm flex flex-col justify-between">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-blue-50">
                <TrendingUp size={20} className="text-blue-600" />
              </div>
              <div>
                <div className="text-xs text-slate-500 uppercase tracking-wide font-semibold mb-1">Claimed Billings</div>
                <div className="text-2xl font-bold text-slate-900">
                  ₹{(activeContractor.total_claims_inr / 10000000).toFixed(2)} Cr
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white/95 backdrop-blur-sm border border-slate-200/80 rounded-xl p-5 shadow-sm flex flex-col justify-between">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-slate-100">
                <TrendingUp size={20} className="text-slate-500" />
              </div>
              <div>
                <div className="text-xs text-slate-500 uppercase tracking-wide font-semibold mb-1">Target Benchmark</div>
                <div className="text-2xl font-bold text-slate-900">
                  {benchmark} <span className="text-sm font-semibold text-slate-500">MT/day</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white/95 backdrop-blur-sm border border-slate-200/80 rounded-xl p-5 shadow-sm flex flex-col justify-between">
            <div className="flex items-start gap-4">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${(activeContractor.fraud_flags_confirmed || 0) > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                <AlertTriangle size={20} className={(activeContractor.fraud_flags_confirmed || 0) > 0 ? 'text-red-600' : 'text-green-600'} />
              </div>
              <div>
                <div className="text-xs text-slate-500 uppercase tracking-wide font-semibold mb-1">Confirmed Violations</div>
                <div className={`text-2xl font-bold flex items-center gap-2 ${(activeContractor.fraud_flags_confirmed || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {activeContractor.fraud_flags_confirmed || 0}
                  {(activeContractor.fraud_flags_confirmed || 0) === 0 && (
                    <span className="bg-green-100 text-green-800 border border-green-200 px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider">Clear</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="bg-white/95 backdrop-blur-sm border border-slate-200/80 rounded-xl p-6 shadow-sm mb-6">
        <div className="mb-5">
          <h2 className="text-xl font-bold tracking-tight text-slate-900 mb-1">Daily Tonnage Audit (Q2–Q3 2026)</h2>
          <p className="text-sm text-slate-500 font-medium m-0">
            Red indicator dots represent anomalous days flagged by geographical trip verification.
          </p>
        </div>

        {loading ? (
          <div className="h-[280px] flex items-center justify-center">
            <span className="text-sm text-slate-500">Loading tonnage series...</span>
          </div>
        ) : (
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorTonnage" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0"/>
                <XAxis dataKey="date" stroke="#94A3B8" tickLine={false} style={{ fontSize: 12, fontFamily: 'var(--font-sans)' }} />
                <YAxis stroke="#94A3B8" tickLine={false} style={{ fontSize: 12, fontFamily: 'var(--font-sans)' }} tickFormatter={(val) => `${val} MT`} />
                <Tooltip 
                  contentStyle={{ 
                    background: '#ffffff', 
                    border: '1px solid #E2E8F0',
                    borderRadius: '8px',
                    fontSize: 12,
                    fontFamily: 'var(--font-sans)',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }} 
                />
                <ReferenceLine y={benchmark} stroke="#64748B" strokeDasharray="4 4" label={{ value: 'Target', position: 'top', fill: '#64748B', fontSize: 11, fontFamily: 'var(--font-sans)' }} />
                <Area 
                  type="monotone" 
                  dataKey="tonnage_mt" 
                  stroke="#3B82F6" 
                  strokeWidth={2} 
                  fillOpacity={1} 
                  fill="url(#colorTonnage)" 
                  name="Daily Weight (MT)"
                  dot={<CustomDot />}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Data Table */}
      <div className="bg-white/95 backdrop-blur-sm border border-slate-200/80 rounded-xl shadow-sm overflow-hidden mb-6">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-xl font-bold tracking-tight text-slate-900 mb-1">Recent Weighbridge Filings</h2>
          <p className="text-sm text-slate-500 font-medium m-0">Latest 10 logs secured on the ledger.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50/80 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Ticket ID</th>
                <th className="px-6 py-4">Truck ID</th>
                <th className="px-6 py-4">Filing Time</th>
                <th className="px-6 py-4">Weight Registered</th>
                <th className="px-6 py-4">Ledger Status</th>
                <th className="px-6 py-4">Merkle Hash</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {recentLogs.map((log) => {
                const isFlagged = log.status === 'flagged';
                const isReview = log.status === 'under_review';
                return (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-mono font-semibold text-xs text-slate-900">{log.id}</td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-600">{log.truck_id}</td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-500">{new Date(log.timestamp).toLocaleString()}</td>
                    <td className="px-6 py-4 font-mono font-medium text-slate-900">{log.weight_kg.toLocaleString()} kg</td>
                    <td className="px-6 py-4">
                      {isFlagged && <span className="bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-0.5 rounded-full text-xs font-semibold">GPS CONTRADICTION</span>}
                      {isReview && <span className="bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-0.5 rounded-full text-xs font-semibold">ML OUTLIER</span>}
                      {!isFlagged && !isReview && <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full text-xs font-semibold">SECURED</span>}
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        {log.tx_hash ? `${log.tx_hash.slice(0, 10)}...${log.tx_hash.slice(-8)}` : 'Pending'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => onNavigate("flags", log.id)}
                        className="text-xs font-medium text-orange-600 hover:text-orange-700 hover:bg-orange-50 px-3 py-1.5 rounded-lg border border-orange-200 transition-colors cursor-pointer"
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
