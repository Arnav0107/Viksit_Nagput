import React, { useState, useEffect } from 'react';
import { AlertTriangle, KeyRound, Loader2, ExternalLink, Flag, Radio } from 'lucide-react';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, GeoJSON, Tooltip as LeafletTooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import nagpurBoundary from '../data/nagpur-boundary.json';

interface LoginProps {
  onLogin: (role: string, token: string, username: string, displayName?: string, ward?: string | null) => void;
  onExplorePublic?: () => void;
  initialError?: string | null;
}

const DEMO_PRESETS = [
  {
    role: 'auditor',
    title: 'NMC Lead Auditor',
    subtitle: 'Cryptographic signing & on-chain sealing — Full RBAC access',
    username: 'auditor_nmc',
    password: 'auditor123',
    displayName: 'NMC Lead Auditor',
    accent: '#DC2626',
    accentBg: '#FEF2F2',
    tag: 'Full Access',
  },
  {
    role: 'officer',
    title: 'Ward Zone Officer',
    subtitle: 'Citizen complaints & SLA review access',
    username: 'officer_ward7',
    password: 'officer123',
    displayName: 'Ward Zone Officer',
    accent: '#D97706',
    accentBg: '#FFFBEB',
    tag: 'SLA Review',
  },
  {
    role: 'public',
    title: 'Public Transparency',
    subtitle: 'Read-only ledger & complaint filing — No login required',
    username: 'citizen_nagpur',
    password: 'public123',
    displayName: 'Public Transparency',
    accent: '#059669',
    accentBg: '#F0FDF4',
    tag: 'Read Only',
  },
];

const NAGPUR_ZONES = [
  { name: "Dhantoli", code: "DH", coords: [21.1299, 79.0798] as [number, number] },
  { name: "Dharampeth", code: "DP", coords: [21.1426, 79.0559] as [number, number] },
  { name: "Hanuman Nagar", code: "HN", coords: [21.1189, 79.1039] as [number, number] },
  { name: "Nehru Nagar", code: "NN", coords: [21.1150, 79.1180] as [number, number] },
  { name: "Gandhi Baugh", code: "GB", coords: [21.1550, 79.1050] as [number, number] },
  { name: "Sataranjipura", code: "SP", coords: [21.1620, 79.1120] as [number, number] },
  { name: "Lakadganj", code: "LK", coords: [21.1520, 79.1320] as [number, number] },
  { name: "Ashi Nagar", code: "AN", coords: [21.1780, 79.1200] as [number, number] },
  { name: "Mangalwari", code: "MW", coords: [21.1710, 79.0720] as [number, number] },
  { name: "Laxmi Nagar", code: "LN", coords: [21.1255, 79.0680] as [number, number] },
];

const createWardBadgeIcon = (code: string, hasAnomalies: boolean) => {
  return L.divIcon({
    className: 'custom-ward-marker-wrapper',
    html: `
      <div class="custom-ward-badge">
        ${code}
        ${hasAnomalies ? '<span style="position:absolute;top:-2px;right:-2px;width:7px;height:7px;border-radius:50%;background:#DC2626;border:1.5px solid #fff;"></span>' : ''}
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18],
  });
};

export const Login: React.FC<LoginProps> = ({ onLogin, onExplorePublic, initialError }) => {
  const [username, setUsername] = useState<string>('auditor_nmc');
  const [password, setPassword] = useState<string>('auditor123');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(initialError || null);
  const [wardStats, setWardStats] = useState<Record<string, { anomalies: number; severity: string; details: string }>>({});

  useEffect(() => {
    fetch('/api/overview')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.ward_anomalies) {
          setWardStats(data.ward_anomalies);
        }
      })
      .catch(() => {});
  }, []);

  const executeLogin = async (loginUser: string, loginPass: string, presetDisplayName?: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUser, password: loginPass }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Authentication failed.');
      const displayName = data.display_name || presetDisplayName || data.username;
      sessionStorage.setItem('auditchain_token', data.access_token);
      sessionStorage.setItem('auditchain_role', data.role);
      sessionStorage.setItem('auditchain_user', data.username);
      sessionStorage.setItem('auditchain_display_name', displayName);
      if (data.ward) {
        sessionStorage.setItem('auditchain_ward', data.ward);
      } else {
        sessionStorage.removeItem('auditchain_ward');
      }
      onLogin(data.role, data.access_token, data.username, displayName, data.ward || null);
    } catch (err: any) {
      setError(err.message || 'Unable to connect to authentication server');
    } finally {
      setLoading(false);
    }
  };

  const handlePresetSelect = (preset: typeof DEMO_PRESETS[0]) => {
    setUsername(preset.username);
    setPassword(preset.password);
    executeLogin(preset.username, preset.password, preset.displayName);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) { setError('Please enter both username and password.'); return; }
    executeLogin(username, password);
  };

  return (
    <div style={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#0A0F1D' }}>
      
      {/* ── 1. MASTHEAD BAR (full width, navy background with amber accent border) ── */}
      <header
        style={{
          position: 'relative',
          width: '100%',
          height: '76px',
          background: '#0A0F1D',
          borderBottom: '2px solid #F59E0B',
          padding: '0 28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxSizing: 'border-box',
          flexShrink: 0,
          zIndex: 40,
          overflow: 'hidden',
        }}
      >
        {/* Animated Stamp Seal Watermark */}
        <div className="login-seal-watermark">
          <svg viewBox="0 0 240 240" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="#F59E0B" style={{ width: '100%', height: '100%' }}>
            <circle cx="120" cy="120" r="114" strokeWidth="2.5" />
            <circle cx="120" cy="120" r="106" strokeWidth="1" strokeDasharray="3 3" />
            <circle cx="120" cy="120" r="88" strokeWidth="1.8" />
            <circle cx="120" cy="120" r="62" strokeWidth="1.2" />
            <path d="M120 36 L120 62 M120 178 L120 204 M36 120 L62 120 M178 120 L204 120 M60 60 L80 80 M160 160 L180 180 M60 180 L80 160 M160 80 L180 60" strokeWidth="1.5" strokeLinecap="round" />
            <polygon points="120,68 123,76 131,76 125,81 127,89 120,84 113,89 115,81 109,76 117,76" fill="#F59E0B" stroke="none" />
            <polygon points="120,172 123,164 131,164 125,159 127,151 120,156 113,151 115,159 109,164 117,164" fill="#F59E0B" stroke="none" />
            <polygon points="68,120 76,123 76,131 81,125 89,127 84,120 89,113 81,115 76,109 76,117" fill="#F59E0B" stroke="none" />
            <polygon points="172,120 164,123 164,131 159,125 151,127 156,120 151,113 159,115 164,109 164,117" fill="#F59E0B" stroke="none" />
            <text x="120" y="125" textAnchor="middle" fill="#F59E0B" stroke="none" fontSize="13" fontWeight="800" letterSpacing="2" fontFamily="sans-serif">NMC · 2026</text>
          </svg>
        </div>

        {/* Left side: Seal + Brand */}
        <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', gap: 12 }}>
          <img
            src="/trashtrail-logo.jpg"
            alt="TrashTrail Logo"
            style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover', border: '1.5px solid #F59E0B', boxShadow: '0 2px 10px rgba(245, 158, 11, 0.3)', flexShrink: 0 }}
          />
          <div>
            <div style={{ color: '#FFFFFF', fontWeight: 800, fontSize: 18, lineHeight: 1.2, letterSpacing: '-0.02em' }}>TrashTrail</div>
            <div style={{ color: '#94A3B8', fontSize: 11.5, fontWeight: 500, letterSpacing: '0.01em' }}>Nagpur Municipal Corporation</div>
          </div>
        </div>

        {/* Right side: Official Access Portal label */}
        <div style={{ position: 'relative', zIndex: 2, textAlign: 'right' }}>
          <div style={{ color: '#F59E0B', fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            OFFICIAL ACCESS PORTAL
          </div>
          <div style={{ color: '#64748B', fontSize: 10.5, fontWeight: 500, marginTop: 2, fontFamily: 'monospace' }}>
            NMC-2026-V8 · SOLIDITY EVM
          </div>
        </div>
      </header>

      {/* ── 2. FULL VIEWPORT MAP BACKGROUND + FLOATING LOGIN DOCKET ── */}
      <div style={{ position: 'relative', flex: 1, width: '100%', overflow: 'hidden' }}>
        
        {/* FULLSCREEN LEAFLET MAP OF NAGPUR */}
        <div style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1 }}>
          
          {/* Cartographic Survey Corner Ticks */}
          <div className="map-corner-tick map-corner-tick-tl" />
          <div className="map-corner-tick map-corner-tick-tr" />
          <div className="map-corner-tick map-corner-tick-bl" />
          <div className="map-corner-tick map-corner-tick-br" />

          <MapContainer
            center={[21.1458, 79.0882]}
            zoom={12}
            scrollWheelZoom={true}
            style={{ height: '100%', width: '100%', zIndex: 1 }}
          >
            {/* CartoDB Voyager Basemap Tiles (Distinct & richly detailed map style) */}
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            />
            {nagpurBoundary && (
              <GeoJSON
                data={nagpurBoundary as any}
                pathOptions={{ color: '#D97706', fill: false, weight: 2.2, dashArray: '5,5', opacity: 0.85 }}
              />
            )}
            {NAGPUR_ZONES.map(zone => {
              const stats = wardStats[zone.name];
              const hasAnomalies = stats ? stats.anomalies > 0 : false;
              return (
                <Marker
                  key={zone.name}
                  position={zone.coords}
                  icon={createWardBadgeIcon(zone.code, hasAnomalies)}
                >
                  <LeafletTooltip direction="top" offset={[0, -18]} opacity={1}>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: '#0F172A', padding: '3px 6px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <div style={{ fontWeight: 800, fontSize: 12 }}>{zone.name} Zone ({zone.code})</div>
                      {stats !== undefined ? (
                        <div style={{ fontSize: 10.5, fontWeight: 600, color: stats.anomalies > 0 ? '#DC2626' : '#059669', marginTop: 3 }}>
                          {stats.anomalies > 0 ? `⚠️ ${stats.anomalies} flagged ${stats.anomalies === 1 ? 'case' : 'cases'}` : '✓ 0 flagged cases · Compliant'}
                        </div>
                      ) : (
                        <div style={{ fontSize: 10, color: '#64748B', marginTop: 2 }}>NMC Telemetry Node</div>
                      )}
                    </div>
                  </LeafletTooltip>
                </Marker>
              );
            })}
          </MapContainer>

          {/* Map Top-Left Overlay Badge */}
          <div
            style={{
              position: 'absolute',
              top: 18,
              left: 18,
              zIndex: 1000,
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(226, 232, 240, 0.9)',
              borderRadius: 8,
              padding: '8px 14px',
              boxShadow: '0 4px 16px rgba(15, 23, 42, 0.1)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 0 3px rgba(16, 185, 129, 0.25)' }} />
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#D97706' }}>
                10 NMC AUDIT ZONES
              </div>
              <div style={{ fontSize: 10, color: '#64748B', fontWeight: 500 }}>
                Live GPS Telemetry & Anomaly Grid
              </div>
            </div>
          </div>

          {/* Map Bottom-Left Legend & Info Pill */}
          <div
            style={{
              position: 'absolute',
              bottom: 18,
              left: 18,
              zIndex: 1000,
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(226, 232, 240, 0.9)',
              borderRadius: 8,
              padding: '8px 14px',
              fontSize: 11,
              color: '#334155',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              boxShadow: '0 4px 16px rgba(15, 23, 42, 0.1)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#FFFFFF', border: '2px solid #F59E0B' }} />
              <span>Telemetry Node</span>
            </div>
            <div style={{ width: 1, height: 12, background: '#E2E8F0' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#DC2626' }} />
              <span style={{ fontSize: 10.5, color: '#64748B' }}>Flagged Alert</span>
            </div>
          </div>
        </div>

        {/* FLOATING LOGIN DOCKET CARD (OVERLAID ON MAP) */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            right: 0,
            width: '100%',
            maxWidth: 520,
            zIndex: 10,
            padding: '20px 24px',
            overflowY: 'auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              width: '100%',
              background: 'rgba(255, 255, 255, 0.96)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(226, 232, 240, 0.9)',
              borderRadius: 12,
              padding: '28px 24px',
              boxShadow: '0 20px 45px -12px rgba(15, 23, 42, 0.22), 0 0 0 1px rgba(0, 0, 0, 0.04)',
            }}
          >
            {/* Header Title */}
            <div style={{ marginBottom: 16 }}>
              <h1 className="t-h1" style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-text-base)', marginBottom: 4, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 10 }}>
                <img src="/trashtrail-logo.jpg" alt="TrashTrail Logo" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '1px solid rgba(245, 158, 11, 0.4)' }} />
                <span>Sign in to TrashTrail</span>
              </h1>
              <p style={{ color: 'var(--color-text-muted)', fontSize: 13, margin: 0 }}>
                Select your role or enter credentials below.
              </p>
            </div>

            {/* Error Notification */}
            {error && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6, padding: '10px 12px', marginBottom: 16, fontSize: 12.5, color: '#991B1B' }}>
                <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>{error}</span>
              </div>
            )}

            {/* ── Role Selector Register Table ── */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                Quick-select demo role
              </div>

              <div style={{ border: '1px solid var(--color-border)', borderRadius: 6, background: '#ffffff', overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                {DEMO_PRESETS.map((preset, idx) => {
                  const isSelected = username === preset.username;
                  return (
                    <button
                      key={preset.role}
                      type="button"
                      disabled={loading}
                      onClick={() => handlePresetSelect(preset)}
                      style={{
                        position: 'relative',
                        width: '100%',
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        padding: '10px 14px 10px 18px',
                        borderTop: idx > 0 ? '1px solid var(--color-border)' : 'none',
                        borderBottom: 'none',
                        borderLeft: 'none',
                        borderRight: 'none',
                        borderRadius: 0,
                        background: isSelected ? preset.accentBg : '#ffffff',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'background 0.12s, border-color 0.12s',
                        opacity: loading ? 0.6 : 1,
                        boxSizing: 'border-box',
                      }}
                    >
                      {/* Left Accent Bar */}
                      <div
                        style={{
                          position: 'absolute',
                          left: 0,
                          top: 0,
                          bottom: 0,
                          width: isSelected ? 4.5 : 2,
                          background: preset.accent,
                          opacity: isSelected ? 1 : 0.25,
                          transition: 'all 0.12s',
                        }}
                      />

                      {/* Left Column: Role Name & Access Label */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 140, flexShrink: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--color-text-base)' }}>
                          {preset.title}
                        </div>
                        <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: preset.accent }}>
                          {preset.tag}
                        </div>
                      </div>

                      {/* Right Column: Description */}
                      <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', lineHeight: 1.3, flex: 1, textAlign: 'right' }}>
                        {preset.subtitle}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Manual Login Form ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0 12px' }}>
              <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
              <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>or sign in manually</span>
              <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginBottom: 3 }}>
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="e.g. auditor_nmc"
                  required
                  disabled={loading}
                  style={{
                    width: '100%',
                    height: 36,
                    border: 'none',
                    borderBottom: '1.5px solid var(--color-border)',
                    borderRadius: 0,
                    padding: '4px 2px',
                    fontSize: 13.5,
                    color: 'var(--color-text-base)',
                    background: 'transparent',
                    outline: 'none',
                    transition: 'border-color 0.15s',
                    boxSizing: 'border-box',
                  }}
                  onFocus={e => (e.currentTarget.style.borderBottomColor = 'var(--color-accent)')}
                  onBlur={e => (e.currentTarget.style.borderBottomColor = 'var(--color-border)')}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginBottom: 3 }}>
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  disabled={loading}
                  style={{
                    width: '100%',
                    height: 36,
                    border: 'none',
                    borderBottom: '1.5px solid var(--color-border)',
                    borderRadius: 0,
                    padding: '4px 2px',
                    fontSize: 13.5,
                    color: 'var(--color-text-base)',
                    background: 'transparent',
                    outline: 'none',
                    transition: 'border-color 0.15s',
                    boxSizing: 'border-box',
                  }}
                  onFocus={e => (e.currentTarget.style.borderBottomColor = 'var(--color-accent)')}
                  onBlur={e => (e.currentTarget.style.borderBottomColor = 'var(--color-border)')}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  height: 40,
                  fontSize: 13.5,
                  fontWeight: 700,
                  marginTop: 4,
                  borderRadius: 4,
                }}
              >
                {loading ? (
                  <><Loader2 size={14} className="animate-spin" /> Authenticating…</>
                ) : (
                  <><KeyRound size={14} /> Authenticate & Issue Token</>
                )}
              </button>
            </form>

            {/* Public portal link */}
            {onExplorePublic && (
              <div style={{ marginTop: 16, textAlign: 'left' }}>
                <button
                  type="button"
                  onClick={onExplorePublic}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--color-accent)', fontSize: 12.5, fontWeight: 600, padding: 0 }}
                >
                  <ExternalLink size={12} />
                  Explore Public Transparency Portal — No login required
                </button>
              </div>
            )}

            <div style={{ marginTop: 18, fontSize: 10.5, color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
              JWT bearer tokens are validated server-side on all mutating endpoints. RBAC policy is enforced per NMC role assignment.
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
