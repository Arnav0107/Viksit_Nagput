import React, { useState, useEffect } from 'react';
import { Overview } from './components/Overview';
import { ContractorDetail } from './components/ContractorDetail';
import { FlaggedCases } from './components/FlaggedCases';
import { RoadRepairs } from './components/RoadRepairs';
import { PublicTransparency } from './components/PublicTransparency';
import { Login } from './components/Login';
import { Web3Console } from './components/Web3Console';

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
  const [premiumVibe, setPremiumVibe] = useState<boolean>(false);

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
      { view: 'overview',     icon: 'dashboard',   label: 'Dashboard' },
      { view: 'contractors',  icon: 'domain',      label: 'Contractor Audit' },
      { view: 'flags',        icon: 'gavel',       label: 'Evidence Exhibits',
        badge: overviewData?.summary?.flagged_weighs > 0 ? overviewData.summary.flagged_weighs : undefined },
    ] : []),
    { view: 'repairs',      icon: 'construction', label: 'Road SLA Tracker' },
    { view: 'transparency', icon: 'description',  label: 'Public Ledger' },
  ];

  const roleColors: Record<string, string> = {
    auditor: '#DC2626',
    officer: '#D97706',
    public:  '#059669',
  };

  return (
    <div className="flex flex-col h-screen w-full text-slate-900 overflow-hidden font-sans bg-[url('https://img.magnific.com/premium-photo/high-angle-view-modern-buildings-city-against-clear-sky_1623070-169.jpg?semt=ais_test_b&w=740&q=80')] bg-cover bg-center bg-no-repeat bg-fixed relative">
      
      {/* Gradient overlay so the image fades to solid white/slate at the bottom for readability */}
      <div className="absolute inset-0 z-0 pointer-events-none bg-gradient-to-b from-white/60 via-slate-50/90 to-slate-50"></div>

      {/* ── TopNavBar (Fixed Header) ────────────────────────────── */}
      <header className="relative z-10 w-full h-16 shrink-0 bg-white/80 backdrop-blur-md border-b border-slate-200/80 shadow-sm">
        <div className="flex justify-between items-center h-full px-4 md:px-8 mx-auto">
          {/* Mobile Menu Toggle & Brand */}
          <div className="flex items-center gap-3">
            <button 
              className="md:hidden p-2 rounded hover:bg-slate-100 transition-colors text-primary cursor-pointer"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              <span className="material-symbols-outlined text-[24px]">menu</span>
            </button>
            <div className="text-xl text-primary font-bold tracking-tight truncate max-w-[200px] md:max-w-none">
              AuditChain Nagpur
            </div>
          </div>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex space-x-6 items-center h-full">
            <button onClick={() => navigateToView('overview')} className={`font-semibold text-sm h-full flex items-center transition-colors duration-200 tracking-tight cursor-pointer ${currentView === 'overview' ? 'text-primary border-b-2 border-primary' : 'text-slate-500 hover:text-slate-900'}`}>Home</button>
            <button onClick={() => navigateToView('repairs')} className={`font-semibold text-sm h-full flex items-center transition-colors duration-200 tracking-tight cursor-pointer ${currentView === 'repairs' ? 'text-primary border-b-2 border-primary' : 'text-slate-500 hover:text-slate-900'}`}>Road Repairs</button>
            <button onClick={() => navigateToView('transparency')} className={`font-semibold text-sm h-full flex items-center transition-colors duration-200 tracking-tight cursor-pointer ${currentView === 'transparency' ? 'text-primary border-b-2 border-primary' : 'text-slate-500 hover:text-slate-900'}`}>Public Ledger</button>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            {inlineNotice && (
              <div className="hidden md:flex items-center gap-2 bg-red-100 text-red-800 px-3 py-1 rounded-full text-xs font-semibold tracking-wide uppercase">
                <span className="material-symbols-outlined text-[16px]">error</span>
                <span>{inlineNotice}</span>
              </div>
            )}
            {role === 'auditor' && (
              <button onClick={handleTriggerReseed} className="hover:bg-slate-100 transition-colors duration-200 p-2 rounded-full active:scale-95 flex items-center justify-center text-slate-700 cursor-pointer" title="Reset Ledger">
                <span className="material-symbols-outlined text-[22px]">restart_alt</span>
              </button>
            )}
            <button onClick={() => handleLogout()} className="hover:bg-slate-100 transition-colors duration-200 p-2 rounded-full active:scale-95 flex items-center justify-center text-slate-700 cursor-pointer" title="Sign Out">
              <span className="material-symbols-outlined text-[22px]">logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Layout Body ───────────────────────────────────── */}
      <div className="flex flex-1 w-full overflow-hidden relative">
        
        {/* Mobile Sidebar Overlay */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setIsMobileMenuOpen(false)} />
        )}

        {/* Sidebar */}
        <aside className={`${isMobileMenuOpen ? 'fixed inset-y-0 left-0 z-50 flex shadow-2xl' : 'hidden'} md:flex flex-col w-64 shrink-0 p-4 transition-transform overflow-y-auto relative ${premiumVibe ? 'bg-slate-950 text-slate-200 border-r border-slate-800' : 'bg-white text-slate-900 border-r border-slate-200'}`}>
          
          {/* --- TRADITIONAL NAGPUR WATERMARK --- */}
          <div 
            className="absolute inset-x-0 bottom-0 h-[80%] pointer-events-none z-0 opacity-40 bg-bottom bg-no-repeat bg-contain"
            style={{ 
              backgroundImage: "url('/deekshabhoomi.svg')",
              WebkitMaskImage: "linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 100%)",
              maskImage: "linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 100%)"
            }}
          />

          <div className="relative z-10 flex flex-col h-full">
            <div className="mb-6 flex justify-between items-start">
              <div>
                <h2 className={`text-sm font-bold tracking-tight ${premiumVibe ? 'text-slate-200' : 'text-slate-900'}`}>Citizen Portal</h2>
                <p className={`text-xs font-medium ${premiumVibe ? 'text-slate-500' : 'text-slate-500'}`}>Nagpur Transparency</p>
              </div>
              <button className="md:hidden text-slate-400 p-1 cursor-pointer" onClick={() => setIsMobileMenuOpen(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <nav className="flex flex-col gap-1.5 flex-1 overflow-y-auto hide-scrollbar">
              {navItems.map(item => {
                const isActive = currentView === item.view;
                return (
                  <button
                    key={item.view}
                    onClick={() => navigateToView(item.view)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors cursor-pointer w-full text-left ${isActive ? (premiumVibe ? 'text-orange-400 bg-slate-800/60 font-bold' : 'text-primary font-bold bg-orange-50') : (premiumVibe ? 'text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 transition-colors' : 'text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors')}`}
                  >
                    <span className="material-symbols-outlined" style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}>{item.icon}</span>
                    <span className="text-sm flex-1">{item.label}</span>
                    {(item as any).badge && (
                      <span className="bg-red-100 text-red-800 text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full font-mono">
                        {(item as any).badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            <div className={`mt-auto pt-4 border-t flex flex-col gap-4 ${premiumVibe ? 'border-slate-800' : 'border-slate-200'}`}>
              <div className="flex items-center gap-3 px-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${premiumVibe ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                  <span className="material-symbols-outlined text-[18px]">person</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-semibold truncate m-0 ${premiumVibe ? 'text-slate-200' : 'text-slate-900'}`}>{displayName || 'Public Citizen'}</p>
                  <p className={`text-[10px] truncate m-0 ${premiumVibe ? 'text-slate-500' : 'text-slate-500'}`}>{role ? `${role.charAt(0).toUpperCase()}${role.slice(1)} Session` : 'Read-Only Access'}</p>
                </div>
              </div>
              <button onClick={() => navigateToView('repairs')} className="w-full bg-orange-500 text-white font-bold tracking-wide uppercase text-sm py-3 rounded-lg hover:-translate-y-[2px] transition-transform shadow-sm flex justify-center items-center gap-2 cursor-pointer">
                <span className="material-symbols-outlined text-[20px]">add_circle</span>
                <span>Report Issue</span>
              </button>
            </div>
          </div>
        </aside>

        {/* Main Scrollable Content Area */}
        <main className="relative z-10 flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto space-y-6 w-full">
            {currentView === 'overview' && (
              <Overview data={overviewData} loading={loading} onNavigate={navigateToView} premiumVibe={premiumVibe} />
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
      </div>

      {/* ── Web3 Console ──────────────────────────────────────────── */}
      <footer className="relative z-20 shrink-0">
        <Web3Console logs={consoleLogs} onClear={() => setConsoleLogs([])} />
      </footer>
    </div>
  );
}

export default App;