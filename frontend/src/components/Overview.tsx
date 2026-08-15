import React, { useState } from 'react';
import { AlertTriangle, Database, TrendingDown, ArrowRight } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { MapContainer, TileLayer, CircleMarker, GeoJSON, Tooltip as LeafletTooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// Nagpur administrative city boundary GeoJSON
import nagpurBoundary from '../data/nagpur-boundary.json';

interface OverviewProps {
  data: any;
  loading: boolean;
  onNavigate: (view: string, targetId?: string) => void;
}

export const Overview: React.FC<OverviewProps> = ({ data, loading, onNavigate }) => {
  const [selectedZone, setSelectedZone] = useState<string | null>(null);

  const zonesData = [
    { name: "Dhantoli", coords: [21.1299, 79.0798] },
    { name: "Dharampeth", coords: [21.1287, 79.0525] },
    { name: "Hanuman Nagar", coords: [21.1450, 79.0700] },
    { name: "Nehru Nagar", coords: [21.1150, 79.0850] },
    { name: "Gandhi Baugh", coords: [21.1550, 79.1050] },
    { name: "Sataranjipura", coords: [21.1600, 79.1150] },
    { name: "Lakadganj", coords: [21.1580, 79.1300] },
    { name: "Ashi Nagar", coords: [21.1050, 79.1050] },
    { name: "Mangalwari", coords: [21.1750, 79.0600] },
    { name: "Laxmi Nagar", coords: [21.1400, 79.0900] }
  ];

  if (loading || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-96 font-mono text-xs text-dossier-text">
        <div className="w-8 h-8 border-2 border-dossier-border border-t-dossier-text animate-spin rounded-full mb-4"></div>
        <span className="animate-pulse">PARSING CRYPTOGRAPHIC LEDGER REGISTRY...</span>
      </div>
    );
  }

  const { summary, ward_anomalies, monthly_tonnage_history } = data;

  const getBadgeColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'bg-status-flagged/10 text-status-flagged border border-status-flagged/30';
      case 'medium': return 'bg-status-review/10 text-status-review border border-status-review/30';
      case 'low': return 'bg-status-verified/10 text-status-verified border border-status-verified/30';
      default: return 'bg-gray-100 text-gray-700 border border-gray-300';
    }
  };

  return (
    <div className="space-y-8">
      {/* Editorial Title Box */}
      <div className="border-b-2 border-dossier-text pb-6">
        <div className="flex flex-col md:flex-row md:items-baseline md:justify-between">
          <h1 className="font-serif text-3xl font-black tracking-tight uppercase text-dossier-text">
            NMC Municipal Audit & Verification Log
          </h1>
          <span className="font-mono text-[10px] text-dossier-muted uppercase mt-1 md:mt-0 font-bold">
            Nagpur Municipal Corporation • Document Ref: NMC-2026-V8
          </span>
        </div>
        
        {/* Paragraph lead */}
        <div className="mt-4 bg-status-flagged/5 border border-status-flagged/25 p-4 font-mono text-xs text-dossier-text">
          <div className="flex items-center gap-2 font-bold text-status-flagged mb-1 uppercase text-[11px]">
            <AlertTriangle size={15} />
            <span>Forensic Notice: Anomaly Trends in Tonnage Billings</span>
          </div>
          <p className="leading-relaxed font-sans text-xs text-dossier-text mt-1.5 font-medium">
            Historical audit records indicate an unexplained monthly drop of 6,400+ MT in waste collection billings between April and July 2026. 
            Concurrently, allegations persist that waste collection haulers (Antony Waste, BVG India) inflated billings by mixing sand/boulders. 
            All weighbridge logs and road restoration SLA projects are locked below via tamper-proof on-chain ledgers for public accountability.
          </p>
        </div>
      </div>

      {/* Grid of Minimal Ledger Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 border-t border-b border-dossier-border divide-y lg:divide-y-0 lg:divide-x divide-dossier-border bg-dossier-card">
        <div className="p-4 flex flex-col justify-between h-24">
          <span className="font-mono text-[10px] uppercase text-dossier-muted tracking-wider font-bold">Locked Weighs</span>
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-3xl font-black text-dossier-text">{summary.total_weighs}</span>
            <span className="font-mono text-[9px] text-dossier-muted uppercase font-bold">Sealed</span>
          </div>
        </div>

        <div className="p-4 flex flex-col justify-between h-24">
          <span className="font-mono text-[10px] uppercase text-status-flagged tracking-wider font-bold">GPS Violations</span>
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-3xl font-black text-status-flagged">{summary.flagged_weighs}</span>
            <span className="font-mono text-[9px] text-status-flagged/80 uppercase font-bold">Inquiry</span>
          </div>
        </div>

        <div className="p-4 flex flex-col justify-between h-24">
          <span className="font-mono text-[10px] uppercase text-status-review tracking-wider font-bold">ML Review</span>
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-3xl font-black text-status-review">{summary.under_review_weighs}</span>
            <span className="font-mono text-[9px] text-status-review/80 uppercase font-bold">Outliers</span>
          </div>
        </div>

        <div className="p-4 flex flex-col justify-between h-24">
          <span className="font-mono text-[10px] uppercase text-dossier-muted tracking-wider font-bold">Road Restorations</span>
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-3xl font-black text-dossier-text">{summary.breached_repairs} / {summary.total_repairs}</span>
            <span className="font-mono text-[9px] text-status-flagged uppercase font-bold">Breached</span>
          </div>
        </div>
      </div>

      {/* Map and Details Block */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Leaflet Nagpur Map Panel */}
        <div className="lg:col-span-7 border border-dossier-border p-6 bg-dossier-card flex flex-col justify-between">
          <div>
            <h3 className="font-serif text-lg font-extrabold uppercase tracking-tight text-dossier-text">Nagpur Zones Administrative Map</h3>
            <p className="text-[10px] text-dossier-muted font-mono mt-0.5 uppercase font-bold">Interactive Leaflet OpenStreetMap telemetry view</p>
          </div>

          <div className="my-6 relative border border-dossier-border rounded-none overflow-hidden h-80 z-10">
            <MapContainer center={[21.1458, 79.0882]} zoom={12} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                attribution='&copy; OpenStreetMap contributors &copy; CARTO'
              />
              
              {/* Optional Nagpur City Boundary Outline */}
              {nagpurBoundary && (
                <GeoJSON
                  data={nagpurBoundary as any}
                  pathOptions={{
                    color: "var(--color-dossier-text)",
                    fill: false,
                    weight: 1.5,
                    dashArray: "4, 4"
                  }}
                />
              )}

              {zonesData.map((zone) => {
                const auditData = ward_anomalies[zone.name] || { anomalies: 0, severity: "low" };
                let color = "#1b4d3e"; // Forest Green (verified)
                if (auditData.severity === 'high') {
                  color = "#9e2a2b"; // Crimson (flagged)
                } else if (auditData.severity === 'medium') {
                  color = "#c97a1b"; // Ochre (review)
                }

                // Scale circle marker size based on alert count (min radius 15px)
                const radius = 15 + (auditData.anomalies * 8);
                const isSelected = selectedZone === zone.name;

                return (
                  <CircleMarker
                    key={zone.name}
                    center={zone.coords as any}
                    pathOptions={{
                      color: color,
                      fillColor: color,
                      fillOpacity: isSelected ? 0.55 : 0.22,
                      weight: isSelected ? 3.5 : 1.5,
                    }}
                    radius={radius}
                    eventHandlers={{
                      click: () => setSelectedZone(zone.name)
                    }}
                  >
                    <LeafletTooltip permanent direction="center" className="leaflet-tooltip-custom border-none bg-transparent shadow-none font-mono text-[8px] font-bold text-black uppercase pointer-events-none">
                      {zone.name}
                    </LeafletTooltip>
                  </CircleMarker>
                );
              })}
            </MapContainer>

            {/* Print Map Legend */}
            <div className="absolute bottom-4 right-2 bg-dossier-bg border border-dossier-border p-2 text-[9px] font-mono space-y-1 z-[1000]">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-status-flagged/20 border border-status-flagged inline-block"></span>
                <span>Flagged (SLA / Telemetry)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-status-review/20 border border-status-review inline-block"></span>
                <span>Under Review (ML Outlier)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-status-verified/20 border border-status-verified inline-block"></span>
                <span>Verified (Clean Ledger)</span>
              </div>
            </div>
          </div>

          <div className="text-[10px] font-mono text-dossier-muted flex justify-between items-center border-t border-dossier-border pt-3 font-bold">
            <span>MAP SYSTEM: LEAFLET-OSM</span>
            <span>Bhandewadi Dumping coordinates: 21.1183° N, 79.0483° E</span>
          </div>
        </div>

        {/* Zone Investigation Dossier Log */}
        <div className="lg:col-span-5 flex flex-col justify-between">
          <div className="border border-dossier-border p-6 bg-dossier-card h-full flex flex-col justify-between">
            <div>
              <h3 className="font-serif text-lg font-extrabold uppercase tracking-tight text-dossier-text">Zone Investigation Log</h3>
              <div className="rule-line my-3"></div>
              
              {selectedZone ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-center pb-2">
                    <span className="font-serif text-xl font-bold tracking-tight text-dossier-text">{selectedZone}</span>
                    <span className={`font-mono text-[9px] uppercase px-2 py-0.5 font-bold ${getBadgeColor(ward_anomalies[selectedZone]?.severity || 'low')}`}>
                      {ward_anomalies[selectedZone]?.severity} severity
                    </span>
                  </div>

                  <div className="space-y-3.5 font-mono text-xs">
                    <div>
                      <span className="text-dossier-muted block uppercase text-[10px] font-bold">Registered Anomalies:</span>
                      <span className="font-bold text-dossier-text">
                        {ward_anomalies[selectedZone]?.anomalies} Contractor Anomaly Reports
                      </span>
                    </div>
                    <div>
                      <span className="text-dossier-muted block uppercase text-[10px] font-bold">Audit Narrative:</span>
                      <p className="text-dossier-text leading-relaxed font-sans text-xs mt-1.5 font-medium">
                        {ward_anomalies[selectedZone]?.details}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-48 flex flex-col items-center justify-center text-center font-mono text-[11px] text-dossier-muted space-y-2 py-6">
                  <Database size={20} className="text-dossier-border" />
                  <span className="font-bold">Select an administrative zone on the Leaflet map to display verified telemetry checks and contract status.</span>
                </div>
              )}
            </div>

            {selectedZone && ward_anomalies[selectedZone]?.anomalies > 0 && (
              <div className="pt-4 border-t border-dashed border-dossier-border mt-4">
                <button 
                  onClick={() => {
                    if (selectedZone === "Dharampeth") {
                      onNavigate("flags", "WB-2026-8021");
                    } else if (selectedZone === "Gandhi Baugh") {
                      onNavigate("flags", "WB-2026-9100");
                    } else {
                      onNavigate("flags");
                    }
                  }}
                  className="w-full flex items-center justify-between border border-dossier-text text-dossier-text text-xs font-mono font-bold py-2 px-3 hover:bg-dossier-text/5 transition-colors uppercase cursor-pointer"
                >
                  <span>Open Flagged Evidence Folder</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Historical Drop Chart */}
      <div className="border border-dossier-border p-6 bg-dossier-card">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center pb-4 border-b border-dossier-border mb-4">
          <div>
            <h3 className="font-serif text-lg font-extrabold uppercase tracking-tight flex items-center gap-2 text-dossier-text">
              <TrendingDown className="text-status-flagged" />
              Nagpur Waste Collection Tonnage Collapse (April–July 2026)
            </h3>
            <p className="text-[10px] text-dossier-muted font-mono mt-0.5 uppercase font-bold">
              Official monthly tonnage invoicing vs. target benchmark
            </p>
          </div>
          <div className="mt-2 md:mt-0 font-mono text-[10px] border border-status-flagged text-status-flagged px-2.5 py-1 uppercase bg-status-flagged/5 font-bold">
            6,400+ MT DROP REGISTERED IN REPORTING PERIOD
          </div>
        </div>

        <div className="h-64 mt-6">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={monthly_tonnage_history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="tonnageGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-status-flagged)" stopOpacity={0.12}/>
                  <stop offset="95%" stopColor="var(--color-status-flagged)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(42,42,42,0.08)"/>
              <XAxis dataKey="month" stroke="rgba(42,42,42,0.5)" tickLine={false} style={{ fontSize: '10px', fontFamily: 'monospace', fontWeight: 'bold' }} />
              <YAxis stroke="rgba(42,42,42,0.5)" tickLine={false} style={{ fontSize: '10px', fontFamily: 'monospace', fontWeight: 'bold' }} tickFormatter={(val) => `${val/1000}k MT`} />
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
              <Area type="monotone" dataKey="tonnage_mt" stroke="var(--color-status-flagged)" strokeWidth={1.5} fillOpacity={1} fill="url(#tonnageGrad)" name="Waste Billed (MT)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      {/* Exhibit indexes */}
      <div className="grid grid-cols-1 md:grid-cols-3 border border-dossier-border divide-y md:divide-y-0 md:divide-x divide-dossier-border font-mono text-xs">
        <div className="p-5 bg-dossier-card flex flex-col justify-between">
          <div>
            <span className="text-dossier-muted block uppercase text-[10px] font-bold">EXHIBIT A: TELEMETRY MISMATCH</span>
            <p className="mt-2.5 font-serif text-sm font-bold text-dossier-text">Audit logs detailing weighbridge tickets registered with zero corresponding dump site GPS hits.</p>
          </div>
          <button onClick={() => onNavigate("flags")} className="mt-4 flex items-center justify-between text-status-flagged font-bold uppercase hover:underline cursor-pointer">
            <span>Inspect Exhibits</span>
            <ArrowRight size={14} />
          </button>
        </div>

        <div className="p-5 bg-dossier-card flex flex-col justify-between">
          <div>
            <span className="text-dossier-muted block uppercase text-[10px] font-bold">EXHIBIT B: CONTRACTOR PROFILES</span>
            <p className="mt-2.5 font-serif text-sm font-bold text-dossier-text">Daily tonnage historical curves for waste collectors with statistical anomaly markers.</p>
          </div>
          <button onClick={() => onNavigate("contractors")} className="mt-4 flex items-center justify-between text-status-verified font-bold uppercase hover:underline cursor-pointer">
            <span>Inspect Contractors</span>
            <ArrowRight size={14} />
          </button>
        </div>

        <div className="p-5 bg-dossier-card flex flex-col justify-between">
          <div>
            <span className="text-dossier-muted block uppercase text-[10px] font-bold">EXHIBIT C: ROAD RESTORATIONS</span>
            <p className="mt-2.5 font-serif text-sm font-bold text-dossier-text">Amrut Yojana post-excavation sewer restorations under active citizen complaint audit check.</p>
          </div>
          <button onClick={() => onNavigate("repairs")} className="mt-4 flex items-center justify-between text-status-review font-bold uppercase hover:underline cursor-pointer">
            <span>Inspect SLA Tracker</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
      
      {/* Map coordinate citation caption */}
      <div className="text-center font-mono text-[9px] text-dossier-muted uppercase font-bold pt-4">
        Zone center points are approximate — based on locality data, not official NMC boundary coordinates.
      </div>
    </div>
  );
};
