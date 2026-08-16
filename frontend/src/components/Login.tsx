import React, { useState } from 'react';
import { Shield, ShieldAlert, Users, AlertTriangle, KeyRound, Loader2, ExternalLink, Flag } from 'lucide-react';

interface LoginProps {
  onLogin: (role: string, token: string, username: string, displayName?: string) => void;
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
    icon: Shield,
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
    icon: ShieldAlert,
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
    icon: Users,
    accent: '#059669',
    accentBg: '#F0FDF4',
    tag: 'Read Only',
  },
];

export const Login: React.FC<LoginProps> = ({ onLogin, onExplorePublic, initialError }) => {
  const [username, setUsername] = useState<string>('auditor_nmc');
  const [password, setPassword] = useState<string>('auditor123');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(initialError || null);

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
      onLogin(data.role, data.access_token, data.username, displayName);
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
    <div style={{ minHeight: '100vh', display: 'flex', background: 'var(--color-bg)' }}>
      {/* Left decorative panel */}
      <div style={{ width: '40%', background: '#111827', padding: '48px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, background: 'var(--color-primary)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Flag size={20} color="#fff" />
          </div>
          <div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 16, lineHeight: 1.2 }}>AuditChain</div>
            <div style={{ color: '#9CA3AF', fontSize: 12 }}>Nagpur Municipal Corporation</div>
          </div>
        </div>

        <div>
          <h2 style={{ color: '#fff', fontSize: 28, fontWeight: 700, lineHeight: 1.3, marginBottom: 16 }}>
            Tamper-Proof<br />Civic Audit Portal
          </h2>
          <p style={{ color: '#9CA3AF', fontSize: 14, lineHeight: 1.6, marginBottom: 32 }}>
            Blockchain-secured weighbridge verification, road SLA tracking, and cryptographic on-chain ruling for Nagpur Municipal contracts.
          </p>

          {/* Feature list */}
          {['GPS-verified trip telemetry', 'Smart contract on-chain sealing', '10 NMC zone audit coverage', 'Public transparency ledger'].map(f => (
            <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-primary)', flexShrink: 0 }} />
              <span style={{ color: '#D1D5DB', fontSize: 13 }}>{f}</span>
            </div>
          ))}
        </div>

        <div style={{ color: '#4B5563', fontSize: 12 }}>
          NMC-2026-V8 · JWT HS256 Auth · Solidity EVM
        </div>
      </div>

      {/* Right login panel */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 32px' }}>
        <div style={{ width: '100%', maxWidth: 420 }}>
          <h1 className="t-h1" style={{ marginBottom: 6 }}>Sign in to AuditChain</h1>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: 28, fontSize: 14 }}>
            Select your role or enter credentials below.
          </p>

          {/* Error */}
          {error && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '12px 14px', marginBottom: 20, fontSize: 13, color: '#991B1B' }}>
              <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{error}</span>
            </div>
          )}

          {/* Quick-select roles */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
              Quick-select demo role
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {DEMO_PRESETS.map(preset => {
                const Icon = preset.icon;
                const isSelected = username === preset.username;
                return (
                  <button
                    key={preset.role}
                    type="button"
                    disabled={loading}
                    onClick={() => handlePresetSelect(preset)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 14px',
                      border: `1px solid ${isSelected ? preset.accent : 'var(--color-border)'}`,
                      borderRadius: 8,
                      background: isSelected ? preset.accentBg : 'var(--color-surface)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.12s',
                      opacity: loading ? 0.6 : 1,
                    }}
                  >
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: preset.accentBg, border: `1px solid ${preset.accent}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={16} style={{ color: preset.accent }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--color-text-base)' }}>{preset.title}</span>
                        <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 9999, background: preset.accentBg, color: preset.accent, border: `1px solid ${preset.accent}44`, flexShrink: 0 }}>
                          {preset.tag}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {preset.subtitle}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>or sign in manually</span>
            <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
          </div>

          {/* Manual form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--color-text-base)', marginBottom: 6 }}>Username</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="e.g. auditor_nmc"
                required
                disabled={loading}
                style={{ width: '100%', height: 40, border: '1px solid var(--color-border)', borderRadius: 6, padding: '0 12px', fontSize: 14, color: 'var(--color-text-base)', background: 'var(--color-surface)', outline: 'none' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--color-text-base)', marginBottom: 6 }}>Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={loading}
                style={{ width: '100%', height: 40, border: '1px solid var(--color-border)', borderRadius: 6, padding: '0 12px', fontSize: 14, color: 'var(--color-text-base)', background: 'var(--color-surface)', outline: 'none' }}
              />
            </div>

            <button type="submit" disabled={loading} className="btn-primary" style={{ justifyContent: 'center', height: 42, fontSize: 14 }}>
              {loading ? (
                <><Loader2 size={15} className="animate-spin" /> Authenticating…</>
              ) : (
                <><KeyRound size={15} /> Authenticate & Issue Token</>
              )}
            </button>
          </form>

          {/* Public portal link */}
          {onExplorePublic && (
            <div style={{ marginTop: 20, textAlign: 'center' }}>
              <button
                type="button"
                onClick={onExplorePublic}
                style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--color-accent)', fontSize: 13, fontWeight: 500 }}
              >
                <ExternalLink size={13} />
                Explore Public Transparency Portal — No login required
              </button>
            </div>
          )}

          <div style={{ marginTop: 24, fontSize: 11, color: 'var(--color-text-muted)', textAlign: 'center', lineHeight: 1.5 }}>
            JWT bearer tokens are validated server-side on all mutating endpoints.<br />
            RBAC policy is enforced per NMC role assignment.
          </div>
        </div>
      </div>
    </div>
  );
};
