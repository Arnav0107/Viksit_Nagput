import React, { useState } from 'react';
import { Shield, ShieldAlert, Users, AlertTriangle, KeyRound, UserCheck, Loader2, ExternalLink } from 'lucide-react';

interface LoginProps {
  onLogin: (role: string, token: string, username: string, displayName?: string) => void;
  onExplorePublic?: () => void;
  initialError?: string | null;
}

const DEMO_PRESETS = [
  {
    role: 'auditor',
    title: 'NMC Lead Auditor',
    subtitle: 'Cryptographic signing & on-chain sealing (Full RBAC)',
    username: 'auditor_nmc',
    password: 'auditor123',
    displayName: 'NMC Lead Auditor',
    icon: Shield,
    badgeColor: 'border-status-flagged text-status-flagged bg-status-flagged/10',
  },
  {
    role: 'officer',
    title: 'Ward Zone Officer',
    subtitle: 'Citizen complaints & SLA review access',
    username: 'officer_ward7',
    password: 'officer123',
    displayName: 'Ward Zone Officer',
    icon: ShieldAlert,
    badgeColor: 'border-status-review text-status-review bg-status-review/10',
  },
  {
    role: 'public',
    title: 'Public Transparency',
    subtitle: 'Read-only transaction ledger & complaint filing',
    username: 'citizen_nagpur',
    password: 'public123',
    displayName: 'Public Transparency',
    icon: Users,
    badgeColor: 'border-status-verified text-status-verified bg-status-verified/10',
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
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: loginUser, password: loginPass }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Authentication failed. Please verify credentials.');
      }

      const displayName = data.display_name || presetDisplayName || data.username;

      // Store token securely in sessionStorage (not localStorage)
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
    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password.');
      return;
    }
    executeLogin(username, password);
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4">
      <div className="max-w-lg w-full border border-dossier-border bg-dossier-card p-8 rounded-none relative shadow-sm">
        
        {/* Dossier stamp overlay design */}
        <div className="absolute top-0 right-0 w-24 h-24 border-b border-l border-dossier-border p-2 flex flex-col justify-center items-center select-none pointer-events-none">
          <span className="font-mono text-[8px] text-dossier-muted font-bold uppercase tracking-tighter">SECURE•AUTH</span>
          <span className="font-mono text-[7px] text-status-verified font-bold uppercase tracking-widest mt-0.5">JWT • HS256</span>
        </div>

        <div className="text-center pb-6 border-b border-dashed border-dossier-border mb-6">
          <span className="font-mono text-[9px] text-dossier-muted block tracking-widest font-bold">DECENTRALIZED AUDITING</span>
          <h1 className="font-serif text-3xl font-black tracking-tight mt-1 text-dossier-text">AuditChain Nagpur</h1>
          <p className="text-[10px] text-dossier-muted font-mono mt-1.5 uppercase font-bold">Civic-Tech Municipal Contract Auditing Portal</p>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="mb-6 p-3 border border-status-flagged bg-status-flagged/10 text-status-flagged text-xs font-mono flex items-start gap-2 animate-fadeIn">
            <AlertTriangle size={15} className="shrink-0 mt-0.5" />
            <div>
              <span className="font-bold uppercase block">Authentication Error</span>
              <span className="text-[11px] opacity-90">{error}</span>
            </div>
          </div>
        )}

        {/* Quick-Select Demo Roles */}
        <div className="space-y-2.5 mb-6">
          <div className="text-center font-mono text-[10px] text-dossier-muted uppercase font-bold tracking-wider mb-2">
            Quick-Select Demo Role (1-Click Demo)
          </div>

          <div className="grid grid-cols-1 gap-2">
            {DEMO_PRESETS.map((preset) => {
              const Icon = preset.icon;
              const isSelected = username === preset.username;
              return (
                <button
                  key={preset.role}
                  type="button"
                  disabled={loading}
                  onClick={() => handlePresetSelect(preset)}
                  className={`w-full border p-3 bg-dossier-bg transition-all text-left flex gap-3 items-center group cursor-pointer ${
                    isSelected ? 'border-dossier-text ring-1 ring-dossier-text' : 'border-dossier-border hover:border-dossier-text'
                  } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className={`p-2 border shrink-0 ${preset.badgeColor}`}>
                    <Icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-serif font-black text-xs uppercase text-dossier-text">
                        {preset.title}
                      </h3>
                      <span className="font-mono text-[8px] uppercase tracking-wider text-dossier-muted px-1 border border-dossier-border bg-dossier-card">
                        {preset.username}
                      </span>
                    </div>
                    <p className="text-[9px] text-dossier-muted font-mono uppercase truncate mt-0.5">
                      {preset.subtitle}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Manual Credentials Form */}
        <form onSubmit={handleSubmit} className="border-t border-dashed border-dossier-border pt-5 space-y-4">
          <div className="font-mono text-[10px] text-dossier-muted uppercase font-bold tracking-wider">
            Or Sign In With Custom Credentials
          </div>

          <div className="space-y-3 font-mono text-xs">
            <div>
              <label className="block text-[9px] uppercase font-bold text-dossier-muted mb-1">
                Username
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. auditor_nmc"
                  required
                  disabled={loading}
                  className="w-full bg-dossier-bg border border-dossier-border px-3 py-2 text-dossier-text focus:outline-none focus:border-dossier-text font-mono text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-[9px] uppercase font-bold text-dossier-muted mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  disabled={loading}
                  className="w-full bg-dossier-bg border border-dossier-border px-3 py-2 text-dossier-text focus:outline-none focus:border-dossier-text font-mono text-xs"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-dossier-text text-dossier-bg py-2.5 font-mono text-xs uppercase font-bold tracking-wider hover:opacity-90 transition-opacity flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Verifying Credentials &amp; Generating JWT...</span>
              </>
            ) : (
              <>
                <KeyRound size={14} />
                <span>Authenticate &amp; Issue Token</span>
              </>
            )}
          </button>
        </form>

        {/* Public Access Link */}
        {onExplorePublic && (
          <div className="mt-4 pt-3 border-t border-dossier-border text-center">
            <button
              type="button"
              onClick={onExplorePublic}
              className="text-[11px] font-mono text-status-verified hover:underline flex items-center justify-center gap-1.5 mx-auto font-bold uppercase cursor-pointer"
            >
              <ExternalLink size={12} />
              <span>Explore Public Transparency Portal (No Login Required)</span>
            </button>
          </div>
        )}

        <div className="mt-6 font-mono text-[9px] text-dossier-muted text-center leading-relaxed">
          <div className="flex justify-center items-center gap-1 text-status-flagged font-bold uppercase mb-1">
            <UserCheck size={11} />
            <span>NMC RBAC ENFORCEMENT</span>
          </div>
          Server validates signed JWT bearer headers on all mutating blockchain &amp; administrative endpoints.
        </div>

      </div>
    </div>
  );
};
