import React from 'react';
import { Shield, ShieldAlert, Users, AlertTriangle } from 'lucide-react';

interface LoginProps {
  onLogin: (role: string) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full border border-dossier-border bg-dossier-card p-8 rounded-none relative">
        
        {/* Dossier stamp overlay design */}
        <div className="absolute top-0 right-0 w-20 h-20 border-b border-l border-dossier-border p-2 flex justify-center items-center select-none pointer-events-none">
          <span className="font-mono text-[8px] text-dossier-muted font-bold uppercase rotate-12 tracking-tighter">NMC•SECURE</span>
        </div>

        <div className="text-center pb-6 border-b border-dashed border-dossier-border mb-6">
          <span className="font-mono text-[9px] text-dossier-muted block tracking-widest font-bold">DECENTRALIZED AUDITING</span>
          <h1 className="font-serif text-3xl font-black tracking-tight mt-1 text-dossier-text">AuditChain Nagpur</h1>
          <p className="text-[10px] text-dossier-muted font-mono mt-1.5 uppercase font-bold">Civic-Tech Municipal Contract Auditing Portal</p>
        </div>

        <div className="space-y-3.5">
          <div className="text-center font-mono text-[10px] text-dossier-muted uppercase font-bold tracking-wider mb-2">
            Select Credential Profile for Verification
          </div>

          {/* Role selection buttons */}
          <button
            onClick={() => onLogin('auditor')}
            className="w-full border border-dossier-border p-4 bg-dossier-bg hover:border-dossier-text transition-all text-left flex gap-4 items-center group cursor-pointer"
          >
            <div className="p-2 border border-dossier-border bg-dossier-card text-dossier-text">
              <Shield size={20} />
            </div>
            <div>
              <h3 className="font-serif font-black text-sm uppercase text-dossier-text flex items-center gap-1.5">
                NMC Lead Auditor
              </h3>
              <p className="text-[9px] text-dossier-muted font-mono uppercase mt-0.5 font-bold">Cryptographic signing & on-chain sealing</p>
            </div>
          </button>

          <button
            onClick={() => onLogin('officer')}
            className="w-full border border-dossier-border p-4 bg-dossier-bg hover:border-dossier-text transition-all text-left flex gap-4 items-center group cursor-pointer"
          >
            <div className="p-2 border border-dossier-border bg-dossier-card text-status-review">
              <ShieldAlert size={20} />
            </div>
            <div>
              <h3 className="font-serif font-black text-sm uppercase text-dossier-text">
                Ward Zone Officer
              </h3>
              <p className="text-[9px] text-dossier-muted font-mono uppercase mt-0.5 font-bold">Citizen complaints & SLA review access</p>
            </div>
          </button>

          <button
            onClick={() => onLogin('public')}
            className="w-full border border-dossier-border p-4 bg-dossier-bg hover:border-dossier-text transition-all text-left flex gap-4 items-center group cursor-pointer"
          >
            <div className="p-2 border border-dossier-border bg-dossier-card text-status-verified">
              <Users size={20} />
            </div>
            <div>
              <h3 className="font-serif font-black text-sm uppercase text-dossier-text">
                Public Transparency
              </h3>
              <p className="text-[9px] text-dossier-muted font-mono uppercase mt-0.5 font-bold">Read-only transaction ledger & complaint filing</p>
            </div>
          </button>
        </div>

        <div className="mt-8 font-mono text-[9px] text-dossier-muted text-center leading-relaxed font-bold">
          <div className="flex justify-center items-center gap-1 text-status-flagged font-bold uppercase mb-1">
            <AlertTriangle size={11} />
            <span>NMC AUDIT STANDARDS ENFORCED</span>
          </div>
          Cryptographic ledgers locked via mock Solc RPC interface. Live wallets automatically sign transactions if detected.
        </div>

      </div>
    </div>
  );
};
