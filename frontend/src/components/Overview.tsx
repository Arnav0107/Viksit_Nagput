import React, { useState } from 'react';
import { AlertTriangle, Database, TrendingDown, ArrowRight, Building, ShieldAlert, Scale, Info } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { MapContainer, TileLayer, CircleMarker, GeoJSON, Popup, Tooltip as LeafletTooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import nagpurBoundary from '../data/nagpur-boundary.json';

interface OverviewProps {
  data: any;
  loading: boolean;
  onNavigate: (view: string, targetId?: string) => void;
  premiumVibe?: boolean;
  garbageSummary?: any;
}

const SystemStatusDossier = () => (
  <div className="bg-white/95 backdrop-blur-sm border border-slate-200/80 rounded-xl p-5 shadow-sm text-slate-900 flex flex-col gap-3">
    <h4 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1 m-0">System Status</h4>
    <div className="flex justify-between items-center border-b border-slate-100 pb-2">
      <span className="text-xs text-slate-500 font-medium">RPC Latency</span>
      <span className="text-xs font-mono text-emerald-600 font-bold">12ms</span>
    </div>
    <div className="flex justify-between items-center border-b border-slate-100 pb-2">
      <span className="text-xs text-slate-500 font-medium">Last Block</span>
      <span className="text-xs font-mono text-slate-700">#19482719</span>
    </div>
    <div className="flex justify-between items-center border-b border-slate-100 pb-2">
      <span className="text-xs text-slate-500 font-medium">Active Tonnage</span>
      <span className="text-xs font-mono text-slate-700">12,450 MT</span>
    </div>
    <div className="flex justify-between items-center">
      <span className="text-xs text-slate-500 font-medium">SLA Compliance</span>
      <span className="text-xs font-bold text-slate-700 tabular-nums">94.2%</span>
    </div>
  </div>
);

export const Overview: React.FC<OverviewProps> = ({ data, loading, onNavigate, premiumVibe, garbageSummary }) => {
  const [selectedZone, setSelectedZone] = useState<string | null>(null);

  const zonesData = [
    { name: "Dhantoli", coords: [21.1299, 79.0798] },
    { name: "Dharampeth", coords: [21.1426, 79.0559] },
    { name: "Hanuman Nagar", coords: [21.1189, 79.1039] },
    { name: "Nehru Nagar", coords: [21.1150, 79.1180] },
    { name: "Gandhi Baugh", coords: [21.1550, 79.1050] },
    { name: "Sataranjipura", coords: [21.1620, 79.1120] },
    { name: "Lakadganj", coords: [21.1520, 79.1320] },
    { name: "Ashi Nagar", coords: [21.1780, 79.1200] },
    { name: "Mangalwari", coords: [21.1710, 79.0720] },
    { name: "Laxmi Nagar", coords: [21.1255, 79.0680] },
  ];

  if (loading || !data) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}>
        <div>
          <div style={{ height: 30, width: 250, background: '#E5E7EB', borderRadius: 6, marginBottom: 8 }} />
          <div style={{ height: 16, width: 350, background: '#F3F4F6', borderRadius: 4 }} />
        </div>
        <div style={{ height: 68, width: '100%', background: '#F3F4F6', borderRadius: 8 }} />
        <div className="grid-cols-responsive-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="metric-card" style={{ height: 86, background: '#F9FAFB' }}>
              <div style={{ display: 'flex', gap: 14 }}>
                <div style={{ width: 40, height: 40, borderRadius: 8, background: '#E5E7EB' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ height: 14, width: '60%', background: '#E5E7EB', borderRadius: 4, marginBottom: 8 }} />
                  <div style={{ height: 28, width: '40%', background: '#D1D5DB', borderRadius: 4 }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const { summary, ward_anomalies = {}, monthly_tonnage_history = [], contractors = [] } = data;

  const metricCards = [
    {
      label: 'Locked Weighs',
      value: summary.total_weighs,
      icon: Scale,
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
    },
    {
      label: 'GPS Violations',
      value: summary.flagged_weighs,
      icon: ShieldAlert,
      iconBg: 'bg-rose-50',
      iconColor: 'text-rose-600',
    },
    {
      label: 'ML Under Review',
      value: summary.under_review_weighs,
      icon: AlertTriangle,
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
    },
    {
      label: 'SLA Breaches',
      value: `${summary.breached_repairs}/${summary.total_repairs}`,
      icon: TrendingDown,
      iconBg: 'bg-rose-50',
      iconColor: 'text-rose-600',
    },
    ...(garbageSummary ? [{
      label: 'Open Garbage Hotspots',
      value: garbageSummary.open_count ?? 0,
      icon: Info,
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
    }] : []),
  ];

  const getContractorGrade = (c: any) => {
    const fraudCount = c.fraud_flags_confirmed || 0;
    if (c.id === 'bvg-india' || fraudCount >= 2) return { grade: 'F', score: 32, icon: 'sentiment_dissatisfied', color: 'text-error' };
    if (c.id === 'antony-waste' || fraudCount === 1) return { grade: 'D-', score: 65, icon: 'sentiment_neutral', color: 'text-on-surface' };
    return { grade: 'B', score: 85, icon: 'sentiment_satisfied', color: 'text-primary' };
  };

  return (
    <div className="flex flex-col gap-6 w-full text-slate-900">

      {/* ── Hero Section ──────────────────────────────────────────── */}
      <section className="mb-10 relative">
        {premiumVibe && (
          <div className="absolute inset-0 z-0 pointer-events-none opacity-40">
            <div className="absolute -top-10 -right-10 w-60 h-60 bg-blue-300 rounded-full blur-[100px]" />
            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-orange-200 rounded-full blur-[80px]" />
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start relative z-10">
          <div className="md:col-span-8">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 border border-blue-200/60 mb-4">
              <span className="material-symbols-outlined text-[16px] text-blue-600">lock</span>
              <span className="text-[11px] font-bold tracking-widest text-blue-700 uppercase">Verified Public Data</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 mt-3 mb-2">
              See How Your City is Doing
            </h1>
            <p className="text-sm text-slate-500 leading-relaxed max-w-2xl font-normal text-balance">
              Radically transparent, real-time metrics on municipal performance. We believe public data should be accessible, organized, and easy to understand.<span className="text-xs font-mono font-medium text-slate-400 ml-1">(Ref: NMC-2026-V8)</span>
            </p>
          </div>
          <div className="md:col-span-4">
            <SystemStatusDossier />
          </div>
        </div>
      </section>

      {/* ── Alert Banner ──────────────────────────────────────────── */}
      <div className="bg-rose-50 border border-rose-200 rounded-lg px-4 py-3 flex gap-3 items-start shadow-sm mb-6">
        <span className="material-symbols-outlined text-rose-600 mt-0.5">warning</span>
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-rose-700">
            Forensic Notice: Tonnage Billing Anomalies Detected
          </div>
          <p className="text-xs text-rose-900/90 leading-normal mt-0.5 m-0">
            Unexplained 6,400+ MT drop in waste collection billings (April–July 2026). Haulers Antony Waste and BVG India
            face allegations of inflated billings. All records are tamper-proof and locked on-chain.
          </p>
        </div>
      </div>

      {/* ── 4 Hero Metric Cards ───────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {metricCards.map(card => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-white/95 backdrop-blur-sm border border-slate-200/80 rounded-xl p-5 shadow-sm flex items-center gap-4">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${card.iconBg} ${card.iconColor}`}>
                <Icon size={20} />
              </div>
              <div className="flex flex-col min-w-0">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">{card.label}</div>
                <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 tabular-nums leading-none">{card.value}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Map + Scorecards (8/4 split) ──────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

        {/* Map Panel (8 cols) */}
        <section className="md:col-span-8 bg-white/95 backdrop-blur-sm rounded-xl shadow-sm p-6 flex flex-col gap-4 border border-slate-200/80">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-lg font-bold tracking-tight text-slate-900 m-0">Ward Performance Map</h2>
            <button className="text-primary text-sm font-semibold flex items-center gap-1 hover:opacity-80 transition-opacity bg-transparent border-none cursor-pointer">
              View Details <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          </div>

          <div className="relative w-full h-[400px] rounded-lg overflow-hidden bg-white flex items-center justify-center border-2 border-slate-300 shadow-inner isolate z-10">
            <MapContainer center={[21.1458, 79.0882]} zoom={12} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                attribution='&copy; OpenStreetMap contributors &copy; CARTO'
              />
              {nagpurBoundary && (
                <GeoJSON
                  data={nagpurBoundary as any}
                  pathOptions={{ color: '#9CA3AF', fill: false, weight: 1.5, dashArray: '4,4' }}
                />
              )}
              {zonesData.map(zone => {
                const auditData = ward_anomalies[zone.name] || { anomalies: 0, severity: 'low', details: 'Normal compliance parameters.' };
                let color = '#059669';
                if (auditData.severity === 'high') color = '#DC2626';
                else if (auditData.severity === 'medium') color = '#D97706';
                const radius = 15 + auditData.anomalies * 8;
                const isSelected = selectedZone === zone.name;
                return (
                  <CircleMarker
                    key={zone.name}
                    center={zone.coords as any}
                    pathOptions={{ color, fillColor: color, fillOpacity: isSelected ? 0.55 : 0.22, weight: isSelected ? 3 : 1.5 }}
                    radius={radius}
                    eventHandlers={{ click: () => setSelectedZone(zone.name) }}
                  >
                    <Popup>
                      <div className="font-sans text-xs">
                        <strong>{zone.name}</strong>
                        <div style={{ marginTop: 4, color: '#6B7280' }}>Severity: {auditData.severity}</div>
                        <div style={{ color: '#374151' }}>{auditData.anomalies} anomalies</div>
                        <div style={{ marginTop: 6, color: '#6B7280', fontSize: 11 }}>{auditData.details}</div>
                      </div>
                    </Popup>
                    <LeafletTooltip direction="top" offset={[0, -10]} opacity={1}>
                      <div className="font-sans text-center p-1">
                        <div className="font-semibold text-xs text-slate-900 mb-1">{zone.name}</div>
                        <span className={`badge ${auditData.severity === 'high' ? 'badge-err' : auditData.severity === 'medium' ? 'badge-warn' : 'badge-ok'} text-[10px] font-semibold tracking-wide uppercase`}>
                          {auditData.severity} Severity
                        </span>
                      </div>
                    </LeafletTooltip>
                  </CircleMarker>
                );
              })}
            </MapContainer>

            {/* Legend inside map container */}
            <div className="absolute bottom-2 right-2 bg-white/90 backdrop-blur border border-slate-200 rounded p-2 text-xs flex flex-col gap-1 z-[1000]">
              {[['#DC2626', 'Flagged'], ['#D97706', 'Under Review'], ['#059669', 'Verified']].map(([c, l]) => (
                <div key={l} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c }} />
                  <span className="text-slate-600 font-medium">{l}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-2 text-xs font-mono text-slate-500">
            Bhandewadi dump yard: 21.1408°N 79.1622°E · Zone centers are approximate
          </div>
        </section>

        {/* Right Column: Scorecards & Zone Detail (4 cols) */}
        <section className="md:col-span-4 flex flex-col gap-6">

          {/* Zone Detail Panel */}
          <div className="bg-white/95 backdrop-blur-sm border border-slate-200/80 rounded-xl p-6 shadow-sm text-slate-900 flex flex-col gap-4 hover:-translate-y-[2px] transition-transform duration-300">
            <h4 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2 m-0">ZONE INVESTIGATION</h4>

            {selectedZone ? (
              <div className="flex-1 flex flex-col">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-xl text-slate-900 font-bold tracking-tight">{selectedZone}</span>
                  {(() => {
                    const sev = ward_anomalies[selectedZone]?.severity || 'low';
                    const cls = sev === 'high' ? 'bg-red-100 text-red-800' : sev === 'medium' ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800';
                    return <span className={`px-2.5 py-1 rounded text-[10px] font-semibold tracking-wide uppercase ${cls}`}>{sev} severity</span>;
                  })()}
                </div>

                <div className="flex flex-col gap-3">
                  <div>
                    <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">ANOMALIES</div>
                    <div className="text-sm text-slate-900 font-bold">{ward_anomalies[selectedZone]?.anomalies || 0} reports</div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">AUDIT NARRATIVE</div>
                    <p className="text-[13px] text-slate-600 font-medium leading-relaxed m-0">
                      {ward_anomalies[selectedZone]?.details || 'Normal operating parameters.'}
                    </p>
                  </div>
                </div>

                {(ward_anomalies[selectedZone]?.anomalies || 0) > 0 && (
                  <button
                    onClick={() => {
                      if (selectedZone === 'Dharampeth') onNavigate('flags', 'WB-2026-8021');
                      else if (selectedZone === 'Gandhi Baugh') onNavigate('flags', 'WB-2026-9100');
                      else onNavigate('flags');
                    }}
                    className="mt-4 w-full bg-error-container text-on-error-container font-semibold text-label-bold py-2 rounded flex justify-center items-center gap-2 hover:opacity-90 tracking-wide uppercase"
                  >
                    <span>View Evidence</span>
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center text-secondary py-4">
                <span className="material-symbols-outlined text-[32px] opacity-50">map</span>
                <p className="text-label-sm font-medium m-0">Select a zone on the map to view its details.</p>
              </div>
            )}
          </div>

          {/* Contractor Scorecards */}
          {contractors.map((c: any) => {
            const { grade, score, icon, color } = getContractorGrade(c);
            const actualColor = color === 'text-error' ? 'text-red-600' : color === 'text-primary' ? 'text-blue-600' : 'text-slate-900';
            return (
              <div key={c.id} onClick={() => onNavigate('contractors')} className="bg-white/95 backdrop-blur-sm border border-slate-200/80 rounded-xl p-6 shadow-sm text-slate-900 flex flex-col gap-4 hover:-translate-y-[2px] transition-transform duration-300 cursor-pointer">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 m-0">CONTRACTOR AUDIT</p>
                    <h4 className="text-sm text-slate-900 font-bold tracking-tight mt-1 m-0">{c.name}</h4>
                  </div>
                  <span className={`material-symbols-outlined ${actualColor}`} style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
                </div>
                <div className="flex items-center gap-6 mt-4">
                  <div className={`text-4xl font-extrabold tracking-tight flex-shrink-0 ${actualColor}`}>
                    {grade}
                  </div>
                  <div className="relative w-20 h-20 ml-auto">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                      <path className="text-slate-200" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                      <path className={actualColor} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeDasharray={`${score}, 100`} strokeLinecap="round" strokeWidth="3" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-sm font-bold text-slate-900">{score}%</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </section>
      </div>

      {/* ── Tonnage Trend Chart ───────────────────────────────────── */}
      <div className="bg-white/95 backdrop-blur-sm border border-slate-200/80 rounded-xl p-6 shadow-sm text-slate-900 mb-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="text-xl text-slate-900 font-bold tracking-tight flex items-center gap-2 m-0">
              <TrendingDown size={20} className="text-red-600" />
              Waste Collection Tonnage (Apr–Jul 2026)
            </h3>
            <p className="text-sm text-slate-500 font-medium m-0 mt-1">Monthly invoiced tonnage vs. target benchmark</p>
          </div>
          <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-[10px] font-semibold tracking-wide uppercase">6,400+ MT Drop</span>
        </div>

        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={monthly_tonnage_history} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="tonnageGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-error)" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="var(--color-error)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-outline-variant)" />
              <XAxis dataKey="month" stroke="var(--color-secondary)" tickLine={false} style={{ fontSize: 11, fontFamily: 'var(--font-sans)' }} />
              <YAxis stroke="var(--color-secondary)" tickLine={false} style={{ fontSize: 11, fontFamily: 'var(--font-sans)' }} tickFormatter={v => `${v / 1000}k`} />
              <Tooltip
                formatter={(value: any, _: any, item: any) => {
                  const spend = item.payload.spend_inr ? ` (₹${(item.payload.spend_inr / 10000000).toFixed(2)} Cr)` : '';
                  return [`${Number(value).toLocaleString()} MT${spend}`, 'Billed Tonnage'];
                }}
                contentStyle={{ background: 'var(--color-surface-container-lowest)', border: '1px solid var(--color-outline-variant)', borderRadius: 8, fontSize: 12, fontFamily: 'var(--font-sans)', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
              />
              <Area type="monotone" dataKey="tonnage_mt" stroke="var(--color-error)" strokeWidth={2} fillOpacity={1} fill="url(#tonnageGrad)" name="Waste Billed (MT)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Quick-nav exhibit cards ───────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Exhibit A', title: 'GPS Telemetry Mismatch', desc: 'Weighbridge tickets with zero dump-site GPS hits', view: 'flags', icon: 'gavel', color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'Exhibit B', title: 'Contractor Billing Profiles', desc: 'Daily tonnage curves with anomaly markers', view: 'contractors', icon: 'monitoring', color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Exhibit C', title: 'Road SLA Restorations', desc: 'Amrut Yojana repairs under citizen review', view: 'repairs', icon: 'construction', color: 'text-slate-700', bg: 'bg-slate-100' },
        ].map(card => (
          <div
            key={card.label}
            className="bg-white/95 backdrop-blur-sm border border-slate-200/80 rounded-xl p-6 shadow-sm text-slate-900 hover:-translate-y-1 transition-transform cursor-pointer flex flex-col"
            onClick={() => onNavigate(card.view)}
          >
            <div className="flex justify-between items-start mb-2">
              <span className={`text-[10px] font-semibold px-2 py-1 rounded uppercase tracking-wide ${card.color} ${card.bg}`}>
                {card.label}
              </span>
              <span className={`material-symbols-outlined ${card.color}`}>{card.icon}</span>
            </div>
            <h3 className="text-sm text-slate-900 font-bold tracking-tight mb-1 m-0">{card.title}</h3>
            <p className="text-sm text-slate-500 font-medium mb-4 m-0 flex-1">{card.desc}</p>
            <div className={`mt-auto flex items-center gap-1 text-[11px] font-semibold tracking-wide ${card.color}`}>
              <span>View Evidence</span><span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
