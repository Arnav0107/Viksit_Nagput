import React, { useState, useEffect } from 'react';
import { Overview } from './components/Overview';
import { ContractorDetail } from './components/ContractorDetail';
import { FlaggedCases } from './components/FlaggedCases';
import { RoadRepairs } from './components/RoadRepairs';
import { PublicTransparency } from './components/PublicTransparency';
import { Login } from './components/Login';
import { Web3Console } from './components/Web3Console';
import {
  Building, BookOpen, FileSpreadsheet, ShieldAlert,
  User, Sun, Moon, LogOut, Layers, LogIn, AlertCircle
} from 'lucide-react';

interface ConsoleLog {
  timestamp: string;
  source: string;
  message: string;
  type: 'info' | 'success' | 'warn' | 'hex';
}

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
  const [theme, setTheme] = useState<'light' | 'dark'>('light'); // Default to light theme
  const [consoleLogs, setConsoleLogs] = useState<ConsoleLog[]>([]);

  const pushWeb3Log = (source: string, message: string, type: 'info' | 'success' | 'warn' | 'hex' = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setConsoleLogs(prev => [...prev, { timestamp, source, message, type }]);
  };

  // Setup default blockchain logs on boot
  useEffect(() => {
    pushWeb3Log("Solidity System", "AuditChain.sol smart contract initialized on EVM.", "info");
    pushWeb3Log("Solidity System", "Contract Address: 0x5FbDB2315678afecb367f032d93F642f64180aa3", "hex");
    pushWeb3Log("Solidity System", "NMC Administrator signature seal registered on-chain.", "success");
  }, []);

  // Fetch initial stats
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

  useEffect(() => {
    fetchDossierData();
  }, []);

  // Handle dark mode DOM sync
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  const handleLogin = (selectedRole: string, authToken: string, authUser: string, authDisplayName?: string) => {
    setRole(selectedRole);
    setToken(authToken);
    setUsername(authUser);
    setDisplayName(authDisplayName || authUser);
    setAuthError(null);
    setInlineNotice(null);
    pushWeb3Log("Authorization", `Logged in under profile: [${selectedRole.toUpperCase()}] (${authDisplayName || authUser}) with valid JWT`, "success");
    if (selectedRole === 'public') {
      setCurrentView('transparency');
    } else {
      setCurrentView('overview');
    }
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
    setRole(null);
    setToken(null);
    setUsername(null);
    setDisplayName(null);
    setInlineNotice(null);
    if (logoutMessage) {
      setAuthError(logoutMessage);
      pushWeb3Log("Auth Security", `Session terminated: ${logoutMessage}`, "warn");
    } else {
      setAuthError(null);
      pushWeb3Log("Authorization", `Session ended. Redirecting to authentication screen.`, "info");
    }
  };

  const handleAuthError = (errMessage: string, isForbidden: boolean = false) => {
    if (isForbidden) {
      // 403 Forbidden: show inline warning without logging out
      setInlineNotice(errMessage || "Access denied for your role.");
      pushWeb3Log("RBAC Policy", `Action rejected: ${errMessage}`, "warn");
      setTimeout(() => setInlineNotice(null), 7000);
    } else {
      // 401 Unauthorized: session expired -> log out
      handleLogout(errMessage || "Session expired. Please log in again.");
    }
  };

  const navigateToView = (view: string, targetId?: string) => {
    setCurrentView(view);
    setInlineNotice(null);
    if (targetId) {
      setSelectedFlagCaseId(targetId);
      pushWeb3Log("Dossier Index", `Direct navigation to exhibit case file [${targetId}]`, "info");
    } else {
      setSelectedFlagCaseId(null);
      pushWeb3Log("Dossier Index", `View switched to: [${view.toUpperCase()}]`, "info");
    }
  };

  // Seeding trigger callback for demo UI
  const handleTriggerReseed = async () => {
    pushWeb3Log("Admin Command", "Received re-seed instruction. Restoring SQLite parameters to baseline...", "warn");
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/admin/reseed', { method: 'POST', headers });

      if (res.status === 401) {
        handleAuthError("Session expired (401). Please log in again.", false);
        return;
      }

      if (res.status === 403) {
        handleAuthError("Unauthorized (403). Only Lead Auditors can reset the database.", true);
        return;
      }

      const data = await res.json();
      if (data.status === 'success') {
        pushWeb3Log("Admin Command", "EVM and Local DB reset complete. Seeded 120 weigh tickets, 2 high-severity contract alerts, 3 Amrut repairs.", "success");
        await fetchDossierData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (!role && !token) {
    return (
      <div className="bg-dossier-bg min-h-screen text-dossier-text">
        <div className="absolute top-4 right-4 flex gap-2 z-50">
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 border border-dossier-border bg-dossier-card text-gray-500 hover:text-dossier-text cursor-pointer rounded-sm"
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
        <Login onLogin={handleLogin} onExplorePublic={handleExplorePublic} initialError={authError} />
        <div className="h-10"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-36 transition-colors duration-150 bg-dossier-bg text-dossier-text">

      {/* Platform Header */}
      <header className="border-b border-dossier-border bg-dossier-card sticky top-0 z-30 font-mono text-xs">
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="border border-dossier-text px-2 py-1 font-bold text-sm tracking-tighter bg-dossier-bg">
              AUDIT•CHAIN
            </div>
            <div>
              <span className="font-serif text-lg font-black uppercase tracking-tight block text-dossier-text">AuditChain Nagpur</span>
              <span className="text-[10px] text-dossier-muted uppercase tracking-widest block font-bold">Tamper-Proof Ledger Verification</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Seed Trigger Button for Lead Auditor */}
            {role === 'auditor' && (
              <button
                onClick={handleTriggerReseed}
                className="text-[9px] border border-dossier-border text-dossier-text hover:bg-dossier-text/5 px-2 py-1 font-bold uppercase transition-colors cursor-pointer"
              >
                Reset / Seed Ledger
              </button>
            )}

            {/* Profile Credentials Display */}
            <div className="flex items-center gap-2 border-l border-dossier-border pl-4 text-dossier-text">
              <User size={14} className="text-dossier-muted" />
              <span className="font-bold uppercase text-[9px]">
                CREDENTIAL: <span className={role === 'auditor' ? 'text-status-flagged' : role === 'officer' ? 'text-status-review' : 'text-status-verified'}>
                  {role}
                </span>
                {displayName && <span className="text-dossier-muted font-normal ml-1">({displayName})</span>}
              </span>
            </div>

            {/* Theme Toggle */}
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-1.5 border border-dossier-border bg-dossier-card hover:bg-dossier-text/5 cursor-pointer"
              title="Toggle Light / Dark Mode"
            >
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            </button>

            {/* Logout / Switch Role */}
            {token ? (
              <button
                onClick={() => handleLogout()}
                className="p-1.5 border border-status-flagged text-status-flagged hover:bg-status-flagged/5 cursor-pointer font-bold uppercase text-[9px] flex items-center gap-1"
                title="Logout Session"
              >
                <LogOut size={14} />
                <span className="hidden sm:inline">Logout</span>
              </button>
            ) : (
              <button
                onClick={() => handleLogout()}
                className="p-1.5 border border-status-verified text-status-verified hover:bg-status-verified/5 cursor-pointer font-bold uppercase text-[9px] flex items-center gap-1"
                title="Sign In"
              >
                <LogIn size={14} />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Inline RBAC Warning Notice */}
      {inlineNotice && (
        <div className="max-w-[1600px] mx-auto px-6 pt-4">
          <div className="border border-status-flagged bg-status-flagged/10 text-status-flagged p-3 font-mono text-xs flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold">
              <AlertCircle size={15} />
              <span>{inlineNotice}</span>
            </div>
            <button 
              onClick={() => setInlineNotice(null)}
              className="text-[10px] uppercase font-bold hover:underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Main Layout Area */}
      <div className="max-w-[1600px] mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* Sidebar Index (Print Report Index Look) */}
          <aside className="lg:col-span-3 font-mono text-xs space-y-4">
            <div className="border border-dossier-border p-4 bg-dossier-card">
              <span className="text-[9px] text-dossier-muted block tracking-wider uppercase mb-3 font-bold">Document Sections</span>
              <nav className="space-y-1">

                {role !== 'public' && (
                  <>
                    <button
                      onClick={() => navigateToView('overview')}
                      className={`w-full flex items-center justify-between px-3 py-2 border font-bold uppercase transition-colors text-left cursor-pointer ${currentView === 'overview'
                          ? 'bg-dossier-text text-dossier-bg border-dossier-text'
                          : 'border-transparent hover:bg-dossier-text/5 text-dossier-text'
                        }`}
                    >
                      <div className="flex items-center gap-2">
                        <Layers size={13} />
                        <span>1. Zone Summary</span>
                      </div>
                    </button>

                    <button
                      onClick={() => navigateToView('contractors')}
                      className={`w-full flex items-center justify-between px-3 py-2 border font-bold uppercase transition-colors text-left cursor-pointer ${currentView === 'contractors'
                          ? 'bg-dossier-text text-dossier-bg border-dossier-text'
                          : 'border-transparent hover:bg-dossier-text/5 text-dossier-text'
                        }`}
                    >
                      <div className="flex items-center gap-2">
                        <Building size={13} />
                        <span>2. Contractor Audit</span>
                      </div>
                    </button>

                    <button
                      onClick={() => navigateToView('flags')}
                      className={`w-full flex items-center justify-between px-3 py-2 border font-bold uppercase transition-colors text-left cursor-pointer ${currentView === 'flags'
                          ? 'bg-dossier-text text-dossier-bg border-dossier-text'
                          : 'border-transparent hover:bg-dossier-text/5 text-dossier-text'
                        }`}
                    >
                      <div className="flex items-center gap-2">
                        <ShieldAlert size={13} className={currentView === 'flags' ? '' : 'text-status-flagged'} />
                        <span>3. Evidence Exhibits</span>
                      </div>
                      {overviewData?.summary?.flagged_weighs > 0 && (
                        <span className="bg-status-flagged/10 text-status-flagged border border-status-flagged/30 text-[9px] font-bold px-1.5 py-0.5 rounded-sm">
                          {overviewData.summary.flagged_weighs} Alert
                        </span>
                      )}
                    </button>
                  </>
                )}

                <button
                  onClick={() => navigateToView('repairs')}
                  className={`w-full flex items-center gap-2 px-3 py-2 border font-bold uppercase transition-colors text-left cursor-pointer ${currentView === 'repairs'
                      ? 'bg-dossier-text text-dossier-bg border-dossier-text'
                      : 'border-transparent hover:bg-dossier-text/5 text-dossier-text'
                    }`}
                >
                  <FileSpreadsheet size={13} />
                  <span>{role === 'public' ? '1. Road SLA Tracker' : '4. Road SLA Tracker'}</span>
                </button>

                <button
                  onClick={() => navigateToView('transparency')}
                  className={`w-full flex items-center gap-2 px-3 py-2 border font-bold uppercase transition-colors text-left cursor-pointer ${currentView === 'transparency'
                      ? 'bg-dossier-text text-dossier-bg border-dossier-text'
                      : 'border-transparent hover:bg-dossier-text/5 text-dossier-text'
                    }`}
                >
                  <BookOpen size={13} />
                  <span>{role === 'public' ? '2. Public Ledger' : '5. Public Ledger'}</span>
                </button>

              </nav>
            </div>

            {/* Print Note Card */}
            <div className="border border-dossier-border p-4 bg-dossier-card font-sans leading-relaxed text-[11px] text-dossier-text">
              <span className="font-mono text-[9px] text-dossier-muted block uppercase tracking-wider mb-1.5 font-bold">Audit Parameters:</span>
              Dharampeth, Hanuman Nagar, Dhantoli, Nehru Nagar, Gandhi Baugh, Laxmi Nagar, Sataranjipura, Lakadganj, Ashi Nagar, and Mangalwari constitute the 10 official NMC administrative zones under audit.
            </div>
          </aside>

          {/* Core Content Viewer */}
          <main className="lg:col-span-9">
            {currentView === 'overview' && (
              <Overview
                data={overviewData}
                loading={loading}
                onNavigate={navigateToView}
              />
            )}

            {currentView === 'contractors' && (
              <ContractorDetail
                contractors={contractors}
                onNavigate={navigateToView}
              />
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
              <PublicTransparency
                data={overviewData}
              />
            )}
          </main>

        </div>
      </div>

      {/* Cryptographic Node console feed */}
      <Web3Console
        logs={consoleLogs}
        onClear={() => setConsoleLogs([])}
      />
    </div>
  );
}

export default App;
