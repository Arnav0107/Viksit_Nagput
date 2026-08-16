import React, { useState } from 'react';
import { AlertTriangle, Database, TrendingDown, ArrowRight, Building, ShieldAlert, Scale } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { MapContainer, TileLayer, CircleMarker, GeoJSON, Popup, Tooltip as LeafletTooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import nagpurBoundary from '../data/nagpur-boundary.json';

interface OverviewProps {
  data: any;
  loading: boolean;
  onNavigate: (view: string, targetId?: string) => void;
}

export const Overview: React.FC<OverviewProps> = ({ data, loading, onNavigate }) => {
  const [selectedZone, setSelectedZone] = useState<string | null>(null);

  const zonesData = [
    { name: "Dhantoli",       coords: [21.1299, 79.0798] },
    { name: "Dharampeth",     coords: [21.1426, 79.0559] },
    { name: "Hanuman Nagar",  coords: [21.1189, 79.1039] },
    { name: "Nehru Nagar",    coords: [21.1150, 79.1180] },
    { name: "Gandhi Baugh",   coords: [21.1550, 79.1050] },
    { name: "Sataranjipura",  coords: [21.1620, 79.1120] },
    { name: "Lakadganj",      coords: [21.1520, 79.1320] },
    { name: "Ashi Nagar",     coords: [21.1780, 79.1200] },
    { name: "Mangalwari",     coords: [21.1710, 79.0720] },
    { name: "Laxmi Nagar",    coords: [21.1255, 79.0680] },
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
      iconBg: '#DBEAFE',
      iconColor: '#1E40AF',
    },
    {
      label: 'GPS Violations',
      value: summary.flagged_weighs,
      icon: ShieldAlert,
      iconBg: '#FEE2E2',
      iconColor: '#DC2626',
    },
    {
      label: 'ML Under Review',
      value: summary.under_review_weighs,
      icon: AlertTriangle,
      iconBg: '#FEF3C7',
      iconColor: '#D97706',
    },
    {
      label: 'SLA Breaches',
      value: `${summary.breached_repairs}/${summary.total_repairs}`,
      icon: TrendingDown,
      iconBg: '#FEE2E2',
      iconColor: '#DC2626',
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Page title */}
      <div>
        <h1 className="t-h1">NMC Audit Dashboard</h1>
        <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginTop: 4 }}>
          Nagpur Municipal Corporation · Contract Ref: NMC-2026-V8
        </p>
      </div>

      {/* ── Alert Banner ──────────────────────────────────────────── */}
      <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <AlertTriangle size={16} style={{ color: '#DC2626', flexShrink: 0, marginTop: 1 }} />
        <div>
          <div style={{ fontWeight: 600, fontSize: 13, color: '#991B1B', marginBottom: 4 }}>
            Forensic Notice: Tonnage Billing Anomalies Detected
          </div>
          <p style={{ fontSize: 13, color: '#7F1D1D', lineHeight: 1.6, margin: 0 }}>
            Unexplained 6,400+ MT drop in waste collection billings (April–July 2026). Haulers Antony Waste and BVG India
            face allegations of inflated billings. All records are tamper-proof and locked on-chain.
          </p>
        </div>
      </div>

      {/* ── 4 Hero Metric Cards ───────────────────────────────────── */}
      <div className="grid-cols-responsive-4">
        {metricCards.map(card => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="metric-card">
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div className="metric-icon" style={{ background: card.iconBg }}>
                  <Icon size={20} style={{ color: card.iconColor }} />
                </div>
                <div>
                  <div className="metric-label">{card.label}</div>
                  <div className="metric-value">{card.value}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Contractor Cards ──────────────────────────────────────── */}
      {contractors.length > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 className="t-h2">Audited Contractors</h2>
            <button
              onClick={() => onNavigate('contractors')}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--color-accent)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
            >
              View all <ArrowRight size={14} />
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {contractors.map((c: any) => (
              <div
                key={c.id}
                onClick={() => onNavigate('contractors')}
                style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '14px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'border-color 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#D1D5DB')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <Building size={14} style={{ color: 'var(--color-text-muted)' }} />
                    <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--color-text-base)' }}>{c.name}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--color-text-muted)' }}>
                    <span>Tonnage: <strong style={{ color: 'var(--color-text-base)' }}>{c.total_tonnage_mt?.toLocaleString() || 0} MT</strong></span>
                    <span>Claims: <strong style={{ color: 'var(--color-text-base)' }}>₹{((c.claims_inr || 0)/10000000).toFixed(2)} Cr</strong></span>
                  </div>
                </div>
                {(c.fraud_flags_confirmed || 0) > 0 ? (
                  <span className="badge badge-err" style={{ flexShrink: 0 }}>
                    <ShieldAlert size={10} /> {c.fraud_flags_confirmed} Fraud
                  </span>
                ) : (
                  <span className="badge badge-ok" style={{ flexShrink: 0 }}>Clean</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Map + Zone Log (8/4 split) ────────────────────────────── */}
      <div className="grid-cols-responsive-map">

        {/* Map Panel */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ marginBottom: 14 }}>
            <h2 className="t-h2" style={{ marginBottom: 2 }}>Nagpur Zone Map</h2>
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Click a zone circle to view its audit status</p>
          </div>

          <div style={{ height: 320, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--color-border)', position: 'relative', isolation: 'isolate', zIndex: 10 }}>
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
                      <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 12 }}>
                        <strong>{zone.name}</strong>
                        <div style={{ marginTop: 4, color: '#6B7280' }}>Severity: {auditData.severity}</div>
                        <div style={{ color: '#374151' }}>{auditData.anomalies} anomalies</div>
                        <div style={{ marginTop: 6, color: '#6B7280', fontSize: 11 }}>{auditData.details}</div>
                      </div>
                    </Popup>
                    <LeafletTooltip direction="top" offset={[0, -10]} opacity={1}>
                      <div style={{ fontFamily: 'Inter, sans-serif', textAlign: 'center', padding: '2px 4px' }}>
                        <div style={{ fontWeight: 600, fontSize: 12, color: '#111827', marginBottom: 4 }}>{zone.name}</div>
                        <span className={`badge ${auditData.severity === 'high' ? 'badge-err' : auditData.severity === 'medium' ? 'badge-warn' : 'badge-ok'}`} style={{ fontSize: 10 }}>
                          {auditData.severity} Severity
                        </span>
                      </div>
                    </LeafletTooltip>
                  </CircleMarker>
                );
              })}
            </MapContainer>

            {/* Legend */}
            <div style={{ position: 'absolute', bottom: 10, right: 10, background: '#fff', border: '1px solid var(--color-border)', borderRadius: 6, padding: '8px 10px', fontSize: 11, zIndex: 1000, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[['#DC2626','Flagged'],['#D97706','Under Review'],['#059669','Verified']].map(([c,l]) => (
                <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: c, flexShrink: 0 }} />
                  <span style={{ color: 'var(--color-text-muted)' }}>{l}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 10, fontSize: 11, color: 'var(--color-text-muted)' }}>
            Bhandewadi dump yard: 21.1408°N 79.1622°E · Zone centers are approximate
          </div>
        </div>

        {/* Zone Detail Panel */}
        <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
          <h2 className="t-h2" style={{ marginBottom: 14 }}>Zone Detail</h2>
          <hr className="divider" style={{ marginBottom: 16 }} />

          {selectedZone ? (
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--color-text-base)' }}>{selectedZone}</span>
                {(() => {
                  const sev = ward_anomalies[selectedZone]?.severity || 'low';
                  const cls = sev === 'high' ? 'badge-err' : sev === 'medium' ? 'badge-warn' : 'badge-ok';
                  return <span className={`badge ${cls}`}>{sev} severity</span>;
                })()}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
                <div>
                  <div style={{ color: 'var(--color-text-muted)', fontSize: 11, fontWeight: 500, marginBottom: 2 }}>ANOMALIES</div>
                  <div style={{ fontWeight: 600 }}>{ward_anomalies[selectedZone]?.anomalies || 0} reports</div>
                </div>
                <div>
                  <div style={{ color: 'var(--color-text-muted)', fontSize: 11, fontWeight: 500, marginBottom: 4 }}>AUDIT NARRATIVE</div>
                  <p style={{ color: 'var(--color-text-muted)', lineHeight: 1.6, margin: 0, fontSize: 13 }}>
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
                  className="btn-danger"
                  style={{ width: '100%', justifyContent: 'space-between', marginTop: 20 }}
                >
                  <span>View Evidence</span>
                  <ArrowRight size={14} />
                </button>
              )}
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--color-text-muted)', textAlign: 'center' }}>
              <Database size={28} style={{ color: '#E5E7EB' }} />
              <p style={{ fontSize: 13, lineHeight: 1.5, margin: 0 }}>
                Select a zone on the map to view its investigation details.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Tonnage Trend Chart ───────────────────────────────────── */}
      <div className="card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h2 className="t-h2" style={{ marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
              <TrendingDown size={18} style={{ color: '#DC2626' }} />
              Waste Collection Tonnage (Apr–Jul 2026)
            </h2>
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: 0 }}>Monthly invoiced tonnage vs. target benchmark</p>
          </div>
          <span className="badge badge-err">6,400+ MT Drop</span>
        </div>

        <div style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={monthly_tonnage_history} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="tonnageGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#DC2626" stopOpacity={0.12} />
                  <stop offset="95%" stopColor="#DC2626" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
              <XAxis dataKey="month" stroke="#D1D5DB" tickLine={false} style={{ fontSize: 11, fontFamily: 'Inter, sans-serif' }} />
              <YAxis stroke="#D1D5DB" tickLine={false} style={{ fontSize: 11, fontFamily: 'Inter, sans-serif' }} tickFormatter={v => `${v/1000}k`} />
              <Tooltip
                formatter={(value: any, _: any, item: any) => {
                  const spend = item.payload.spend_inr ? ` (₹${(item.payload.spend_inr/10000000).toFixed(2)} Cr)` : '';
                  return [`${Number(value).toLocaleString()} MT${spend}`, 'Billed Tonnage'];
                }}
                contentStyle={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: 12, fontFamily: 'Inter, sans-serif', boxShadow: 'none' }}
              />
              <Area type="monotone" dataKey="tonnage_mt" stroke="#DC2626" strokeWidth={2} fillOpacity={1} fill="url(#tonnageGrad)" name="Waste Billed (MT)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Quick-nav exhibit cards ───────────────────────────────── */}
      <div className="grid-cols-responsive-3">
        {[
          { label: 'Exhibit A', title: 'GPS Telemetry Mismatch', desc: 'Weighbridge tickets with zero dump-site GPS hits', view: 'flags', color: '#DC2626', bg: '#FEF2F2' },
          { label: 'Exhibit B', title: 'Contractor Billing Profiles', desc: 'Daily tonnage curves with anomaly markers', view: 'contractors', color: 'var(--color-accent)', bg: '#EFF6FF' },
          { label: 'Exhibit C', title: 'Road SLA Restorations', desc: 'Amrut Yojana repairs under citizen review', view: 'repairs', color: '#D97706', bg: '#FFFBEB' },
        ].map(card => (
          <div
            key={card.label}
            className="card"
            style={{ padding: '16px', cursor: 'pointer' }}
            onClick={() => onNavigate(card.view)}
          >
            <span style={{ fontSize: 10, fontWeight: 600, color: card.color, background: card.bg, padding: '2px 8px', borderRadius: 9999, display: 'inline-block', marginBottom: 10 }}>
              {card.label}
            </span>
            <h3 className="t-h3" style={{ marginBottom: 6 }}>{card.title}</h3>
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.5, margin: '0 0 14px' }}>{card.desc}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: card.color }}>
              <span>View</span><ArrowRight size={13} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
