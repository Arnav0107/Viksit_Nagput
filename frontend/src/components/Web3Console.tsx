import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Cpu, ChevronUp, ChevronDown, Check, Play } from 'lucide-react';

interface ConsoleLog {
  timestamp: string;
  source: string;
  message: string;
  type: 'info' | 'success' | 'warn' | 'hex';
}

interface Web3ConsoleProps {
  logs: ConsoleLog[];
  onClear: () => void;
}

export const Web3Console: React.FC<Web3ConsoleProps> = ({ logs, onClear }) => {
  const [isOpen, setIsOpen] = useState<boolean>(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isOpen]);

  const getLogStyle = (type: string) => {
    switch (type) {
      case 'success': return 'text-status-verified';
      case 'warn': return 'text-status-review';
      case 'hex': return 'text-gray-400 select-all';
      default: return 'text-gray-300';
    }
  };

  return (
    <div className="border-t-2 border-black dark:border-dossier-border-dark bg-[#0a0c0e] text-white z-40 fixed bottom-0 left-0 right-0">
      
      {/* Console Header Bar */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="flex justify-between items-center py-2 px-4 cursor-pointer hover:bg-white/[0.02] border-b border-white/[0.05]"
      >
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider font-bold">
          <Terminal size={14} className="text-status-verified" />
          <span>AuditChain Decentralized Ledger Output Feed</span>
          <span className="bg-status-verified/15 text-status-verified border border-status-verified/30 rounded px-1.5 py-0.5 text-[8px] flex items-center gap-1 font-bold">
            <Cpu size={10} className="animate-spin" />
            EVM RPC: 8545
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono text-gray-500">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            className="hover:text-white uppercase font-bold text-[9px] border border-white/10 px-2 py-0.5 rounded"
          >
            Clear logs
          </button>
          {isOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </div>
      </div>

      {/* Terminal Output */}
      {isOpen && (
        <div className="h-32 overflow-y-auto px-6 py-3 font-mono text-[10px] space-y-1.5 custom-scrollbar bg-[#07080a]">
          {logs.length === 0 ? (
            <div className="text-gray-500 text-center py-6">
              Listening for cryptographic ledger transactions. Verify an exhibit or sign a ticket on-chain to trigger logs.
            </div>
          ) : (
            logs.map((log, idx) => (
              <div key={idx} className="flex gap-2 leading-relaxed">
                <span className="text-gray-600 shrink-0">[{log.timestamp}]</span>
                <span className="text-status-review font-bold shrink-0">[{log.source}]</span>
                <span className={getLogStyle(log.type)}>{log.message}</span>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
};
