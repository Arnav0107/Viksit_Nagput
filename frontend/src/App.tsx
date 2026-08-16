import React, { useState, useEffect } from 'react';
import { Overview } from './components/Overview';
import { ContractorDetail } from './components/ContractorDetail';
import { FlaggedCases } from './components/FlaggedCases';
import { RoadRepairs } from './components/RoadRepairs';
import { PublicTransparency } from './components/PublicTransparency';
import { Login } from './components/Login';
import { Web3Console } from './components/Web3Console';
import {
  LayoutDashboard, Building, BookOpen, FileSpreadsheet, ShieldAlert,
  LogOut, LogIn, AlertCircle, Search, Flag, RefreshCw, ChevronRight, User, Menu
} from 'lucide-react';

interface ConsoleLog {
  timestamp: string;
  source: string;
  message: string;
  type: 'info' | 'success' | 'warn' | 'hex';
}

const PAGE_TITLES: Record<string, string> = {
  overview: 'Dashboard',
  contractors: 'Contractor Audit',
  flags: 'Evidence Exhibits',
  repairs: 'Road SLA Tracker',
  transparency: 'Public Ledger',
};

function App() {
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem('auditchain_token'));
  const [role, setRole] = useState<string | null>(() => sessionStorage.getItem('auditchain_role'));
  const [username, setUsername] = useState<string | null>(() => sessionStorage.getItem('auditchain_user'));
  const [displayName, setDisplayName] = useState<string | null>(() => sessionStorage.getItem('auditchain_display_name'));
  const [authError, setAuthError] = useState<string | null>(null);
  const [inlineNotice, setInlineNotice] = useState<string | null>(null);

  const [currentView, setCurrentView] = useState<string>('overview');
  const [selectedFlagCaseId, setSelectedFlagCaseId] = useState<string | null>(null);
  const [overviewData, setOverviewData] = useState<any>(null);
  const [contractors, setContractors] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [theme] = useState<'light' | 'dark'>('light');
  const [consoleLogs, setConsoleLogs] = useState<ConsoleLog[]>([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  const pushWeb3Log = (source: string, message: string, type: 'info' | 'success' | 'warn' | 'hex' = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setConsoleLogs(prev => [...prev, { timestamp, source, message, type }]);
  };

  useEffect(() => {
    pushWeb3Log("Solidity System", "AuditChain.sol smart contract initialized on EVM.", "info");
    pushWeb3Log("Solidity System", "Contract Address: 0x5FbDB2315678afecb367f032d93F642f64180aa3", "hex");
    pushWeb3Log("Solidity System", "NMC Administrator signature seal registered on-chain.", "success");
  }, []);

  const fetchDossierData = async () => {
    setLoading(true);
    try {
      const updatedOverviewRes = await fetch('/api/overview');
      const oData = await updatedOverviewRes.json();
      setOverviewData(oData);
      const contractorsRes = await fetch('/api/contractors');
      const cData = await contractorsRes.json();
      setContractors(cData);
    } catch (err) {
      console.error("Error loading API stats", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDossierData(); }, []);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('dark');
  }, [theme]);

  const handleLogin = (selectedRole: string, authToken: string, authUser: string, authDisplayName?: string) => {
    setRole(selectedRole);
    setToken(authToken);
    setUsername(authUser);
    setDisplayName(authDisplayName || authUser);
    setAuthError(null);
    setInlineNotice(null);
    pushWeb3Log("Authorization", `Logged in: [${selectedRole.toUpperCase()}] (${authDisplayName || authUser}) JWT issued.`, "success");
    setCurrentView(selectedRole === 'public' ? 'transparency' : 'overview');
  };

  const handleExplorePublic = () => {
    setRole('public');
    setToken(null);
    setUsername('citizen_public');
    setDisplayName('Public Citizen');
    setAuthError(null);
    setInlineNotice(null);
    setCurrentView('transparency');
    pushWeb3Log("Public Access", "Entered Public Transparency Portal (Unauthenticated session).", "info");
  };

  const handleLogout = (logoutMessage?: string) => {
    sessionStorage.removeItem('auditchain_token');
    sessionStorage.removeItem('auditchain_role');
    sessionStorage.removeItem('auditchain_user');
    sessionStorage.removeItem('auditchain_display_name');
    setRole(null); setToken(null); setUsername(null); setDisplayName(null); setInlineNotice(null);
    if (logoutMessage) {
      setAuthError(logoutMessage);
      pushWeb3Log("Auth Security", `Session terminated: ${logoutMessage}`, "warn");
    } else {
      setAuthError(null);
      pushWeb3Log("Authorization", "Session ended. Redirecting to authentication screen.", "info");
    }
  };

  const handleAuthError = (errMessage: string, isForbidden: boolean = false) => {
    if (isForbidden) {
      setInlineNotice(errMessage || "Access denied for your role.");
      pushWeb3Log("RBAC Policy", `Action rejected: ${errMessage}`, "warn");
      setTimeout(() => setInlineNotice(null), 7000);
    } else {
      handleLogout(errMessage || "Session expired. Please log in again.");
    }
  };

  const navigateToView = (view: string, targetId?: string) => {
    setCurrentView(view);
    setInlineNotice(null);
    setIsMobileMenuOpen(false); // Close menu on navigation
    if (targetId) {
      setSelectedFlagCaseId(targetId);
      pushWeb3Log("Navigation", `Direct link to case file [${targetId}]`, "info");
    } else {
      setSelectedFlagCaseId(null);
      pushWeb3Log("Navigation", `View → ${PAGE_TITLES[view] || view}`, "info");
    }
  };

  const handleTriggerReseed = async () => {
    pushWeb3Log("Admin Command", "Re-seed instruction received. Restoring SQLite baseline...", "warn");
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/admin/reseed', { method: 'POST', headers });
      if (res.status === 401) { handleAuthError("Session expired (401). Please log in again.", false); return; }
      if (res.status === 403) { handleAuthError("Unauthorized (403). Only Lead Auditors can reset the database.", true); return; }
      const data = await res.json();
      if (data.status === 'success') {
        pushWeb3Log("Admin Command", "EVM + DB reset complete. 120 weigh tickets, 2 alerts, 3 Amrut repairs seeded.", "success");
        await fetchDossierData();
      }
    } catch (err) { console.error(err); }
  };

  /* ── Login Screen ─────────────────────────────────────────────── */
  if (!role && !token) {
    return (
      <div style={{ background: 'var(--color-bg)', minHeight: '100vh' }}>
        <Login onLogin={handleLogin} onExplorePublic={handleExplorePublic} initialError={authError} />
      </div>
    );
  }

  /* ── Nav Items ─────────────────────────────────────────────────── */
  const navItems = [
    ...(role !== 'public' ? [
      { view: 'overview',     icon: LayoutDashboard, label: 'Dashboard' },
      { view: 'contractors',  icon: Building,        label: 'Contractor Audit' },
      { view: 'flags',        icon: ShieldAlert,     label: 'Evidence Exhibits',
        badge: overviewData?.summary?.flagged_weighs > 0 ? overviewData.summary.flagged_weighs : undefined },
    ] : []),
    { view: 'repairs',      icon: FileSpreadsheet, label: 'Road SLA Tracker' },
    { view: 'transparency', icon: BookOpen,         label: 'Public Ledger' },
  ];

  const roleColors: Record<string, string> = {
    auditor: '#DC2626',
    officer: '#D97706',
    public:  '#059669',
  };

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh', fontFamily: "'Inter', system-ui, sans-serif" }}>

      {isMobileMenuOpen && (
        <div className="mobile-backdrop" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      {/* ── Fixed Sidebar ──────────────────────────────────────────── */}
      <aside className={`sidebar ${isMobileMenuOpen ? 'sidebar-open' : ''}`}>
        {/* Logo */}
        <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, background: 'var(--color-primary)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Flag size={16} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-base)', lineHeight: 1.2 }}>AuditChain</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', lineHeight: 1.2 }}>Nagpur Municipal</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ padding: '12px 10px', flex: 1, overflowY: 'auto' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '4px 6px 8px' }}>
            Navigation
          </div>
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = currentView === item.view;
            return (
              <button
                key={item.view}
                onClick={() => navigateToView(item.view)}
                className={`sidebar-nav-item${isActive ? ' active' : ''}`}
              >
                <Icon size={16} style={{ flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{item.label}</span>
                {(item as any).badge && (
                  <span style={{ background: '#FEE2E2', color: '#991B1B', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 9999 }}>
                    {(item as any).badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar footer – user profile */}
        <div style={{ borderTop: '1px solid var(--color-border)', padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#F3F4F6', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <User size={14} style={{ color: 'var(--color-text-muted)' }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-base)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {displayName || username || 'User'}
              </div>
              <div style={{ fontSize: 11, color: role ? roleColors[role] || 'var(--color-text-muted)' : 'var(--color-text-muted)', fontWeight: 500, textTransform: 'capitalize' }}>
                {role || 'Guest'}
              </div>
            </div>
          </div>
          {token ? (
            <button
              onClick={() => handleLogout()}
              className="btn-ghost"
              style={{ width: '100%', justifyContent: 'center', fontSize: 12 }}
            >
              <LogOut size={13} /> Sign Out
            </button>
          ) : (
            <button
              onClick={() => handleLogout()}
              className="btn-ghost"
              style={{ width: '100%', justifyContent: 'center', fontSize: 12 }}
            >
              <LogIn size={13} /> Sign In
            </button>
          )}
        </div>
      </aside>

      {/* ── Fixed Top Header ───────────────────────────────────────── */}
      <header className="top-header">
        {/* Breadcrumb / Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <button 
            className="md:hidden" 
            onClick={() => setIsMobileMenuOpen(true)}
            style={{ background: 'none', border: 'none', padding: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--color-text-base)' }}
          >
            <Menu size={18} />
          </button>
          <span style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 500, display: 'none', '@media (min-width: 640px)': { display: 'inline' } } as any}>NMC</span>
          <ChevronRight size={14} style={{ color: 'var(--color-text-muted)', flexShrink: 0, display: 'none', '@media (min-width: 640px)': { display: 'block' } } as any} />
          <h1 className="t-h1" style={{ margin: 0, fontSize: 18, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {PAGE_TITLES[currentView] || 'AuditChain'}
          </h1>
        </div>

        {/* Search Bar (center) */}
        <div style={{ flex: 1, maxWidth: 360, position: 'relative', margin: '0 auto' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }} />
          <input
            type="text"
            placeholder="Search cases, wards, contractors…"
            className="search-input"
          />
        </div>

        {/* Right Side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
          {/* RBAC Notice */}
          {inlineNotice && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 6, padding: '5px 10px', fontSize: 12, color: '#991B1B', fontWeight: 500 }}>
              <AlertCircle size={13} />
              <span style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inlineNotice}</span>
              <button onClick={() => setInlineNotice(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#991B1B', fontWeight: 700, marginLeft: 4, padding: 0, fontSize: 14, lineHeight: 1 }}>×</button>
            </div>
          )}

          {/* Reseed for Auditor */}
          {role === 'auditor' && (
            <button onClick={handleTriggerReseed} className="btn-ghost" style={{ fontSize: 12 }}>
              <RefreshCw size={13} /> Reset Ledger
            </button>
          )}

          {/* Report Issue CTA */}
          <button onClick={() => navigateToView('repairs')} className="btn-primary" style={{ fontSize: 13 }}>
            <Flag size={13} /> Report Issue
          </button>
        </div>
      </header>

      {/* ── Main Content ───────────────────────────────────────────── */}
      <main className="main-content" style={{ paddingBottom: 220 }}>
        <div className="content-container">

          {currentView === 'overview' && (
            <Overview data={overviewData} loading={loading} onNavigate={navigateToView} />
          )}
          {currentView === 'contractors' && (
            <ContractorDetail contractors={contractors} onNavigate={navigateToView} />
          )}
          {currentView === 'flags' && (
            <FlaggedCases
              initialCaseId={selectedFlagCaseId}
              role={role || 'public'}
              token={token}
              onAuthError={handleAuthError}
              onPushWeb3Log={pushWeb3Log}
            />
          )}
          {currentView === 'repairs' && (
            <RoadRepairs
              role={role || 'public'}
              token={token}
              onAuthError={handleAuthError}
              onPushWeb3Log={pushWeb3Log}
            />
          )}
          {currentView === 'transparency' && (
            <PublicTransparency data={overviewData} />
          )}

        </div>
      </main>

      {/* ── Web3 Console ──────────────────────────────────────────── */}
      <Web3Console logs={consoleLogs} onClear={() => setConsoleLogs([])} />

    </div>
  );
}

export default App;
