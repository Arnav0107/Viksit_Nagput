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
      case 'success': return '#059669';
      case 'warn': return '#D97706';
      case 'hex': return '#9CA3AF';
      default: return '#D1D5DB';
    }
  };

  const parseLogMessage = (msg: string, defaultColor: string) => {
    const hexRegex = /(0x[a-fA-F0-9]{10,})/g;
    const parts = msg.split(hexRegex);
    return parts.map((part, i) => {
      if (hexRegex.test(part)) {
        return <span key={i} className="font-mono font-bold text-amber-400">{part}</span>;
      }
      return <span key={i} style={{ color: defaultColor }} className="font-mono">{part}</span>;
    });
  };

  return (
    <div className="w-full font-mono text-xs bg-slate-900 text-green-400 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
      
      {/* Console Header Bar */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className={`flex justify-between items-center px-4 py-2 cursor-pointer border-b border-slate-700 transition-colors ${isOpen ? 'bg-slate-800' : 'bg-slate-900 hover:bg-slate-800'}`}
      >
        <div className="flex items-center gap-2">
          <Terminal size={14} className="text-green-500" />
          <span className="font-mono text-xs font-semibold text-slate-300 uppercase tracking-wider">
            TrashTrail EVM Console
          </span>
          <span className="font-mono text-[10px] font-semibold text-green-400 bg-green-500/10 border border-green-500/20 rounded px-1.5 py-0.5 flex items-center gap-1 ml-2">
            <Cpu size={12} className="animate-spin" />
            RPC: 8545
          </span>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={(e) => { e.stopPropagation(); onClear(); }}
            className="font-mono text-[10px] font-semibold uppercase text-slate-400 hover:text-white border border-slate-600 rounded px-2 py-0.5 bg-transparent cursor-pointer transition-colors"
          >
            Clear logs
          </button>
          {isOpen ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronUp size={14} className="text-slate-400" />}
        </div>
      </div>

      {/* Terminal Output */}
      {isOpen && (
        <div className="h-48 max-h-48 overflow-y-auto p-4 bg-slate-900 custom-scrollbar font-mono text-xs leading-relaxed">
          {logs.length === 0 ? (
            <div className="font-mono text-slate-500 text-center py-7 text-xs">
              Listening for cryptographic ledger transactions. Verify an exhibit or sign a ticket on-chain to trigger logs.
            </div>
          ) : (
            <div className="flex flex-col gap-1 font-mono text-xs">
              {logs.map((log, idx) => (
                <div key={idx} className="flex gap-2 leading-relaxed font-mono">
                  <span className="text-slate-500 shrink-0 font-mono">[{log.timestamp}]</span>
                  <span className="text-blue-400 font-bold shrink-0 font-mono">[{log.source}]</span>
                  <span className="font-mono break-all">{parseLogMessage(log.message, getLogStyle(log.type))}</span>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
