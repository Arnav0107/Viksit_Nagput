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
        return <span key={i} style={{ color: 'var(--color-primary)', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>{part}</span>;
      }
      return <span key={i} style={{ color: defaultColor }}>{part}</span>;
    });
  };

  return (
    <div className="web3-console">
      
      {/* Console Header Bar */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px', cursor: 'pointer', borderBottom: '1px solid #374151', background: isOpen ? '#1F2937' : 'transparent' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Terminal size={14} style={{ color: '#10B981' }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: '#D1D5DB', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            AuditChain EVM Console
          </span>
          <span style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 4, padding: '2px 6px', fontSize: 10, display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
            <Cpu size={12} className="animate-spin" />
            RPC: 8545
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button 
            onClick={(e) => { e.stopPropagation(); onClear(); }}
            style={{ background: 'none', border: '1px solid #4B5563', borderRadius: 4, padding: '2px 8px', color: '#9CA3AF', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', cursor: 'pointer' }}
          >
            Clear logs
          </button>
          {isOpen ? <ChevronDown size={14} style={{ color: '#9CA3AF' }} /> : <ChevronUp size={14} style={{ color: '#9CA3AF' }} />}
        </div>
      </div>

      {/* Terminal Output */}
      {isOpen && (
        <div style={{ height: 160, overflowY: 'auto', padding: '12px 16px', fontFamily: "'JetBrains Mono', 'Courier New', monospace", fontSize: 12, backgroundColor: '#111827' }} className="custom-scrollbar">
          {logs.length === 0 ? (
            <div style={{ color: '#6B7280', textAlign: 'center', padding: '30px 0' }}>
              Listening for cryptographic ledger transactions. Verify an exhibit or sign a ticket on-chain to trigger logs.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {logs.map((log, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 8, lineHeight: 1.5 }}>
                  <span style={{ color: '#6B7280', flexShrink: 0 }}>[{log.timestamp}]</span>
                  <span style={{ color: 'var(--color-accent)', fontWeight: 600, flexShrink: 0 }}>[{log.source}]</span>
                  <span style={{ wordBreak: 'break-all' }}>{parseLogMessage(log.message, getLogStyle(log.type))}</span>
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
