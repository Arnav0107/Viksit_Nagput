import React from 'react';
import { Scale } from 'lucide-react';

interface PublicTransparencyProps {
  data: any;
}

export const PublicTransparency: React.FC<PublicTransparencyProps> = ({ data }) => {
  if (!data) return null;

  const { contractors } = data;

  const getGrade = (contractorId: string) => {
     switch (contractorId) {
       case 'antony-waste': return { grade: 'D-', color: 'text-status-flagged', desc: 'Active forensic inquiry over unexplained tonnage drops. Telemetry GPS mismatches flagged.' };
       case 'bvg-india': return { grade: 'F', color: 'text-status-flagged', desc: 'Flagged for suspicious identical weight registers. Under investigation for sand/boulder mixing.' };
       case 'amrut-repairs': return { grade: 'C+', color: 'text-status-review', desc: 'Road repair restorations triggered automated SLA holds in Dharampeth.' };
       default: return { grade: 'B', color: 'text-status-verified', desc: 'Compliance metrics within baseline parameters.' };
     }
  };

  const timelineEvents = [
    { date: "April 1, 2026", title: "Monitoring Systems Activated", desc: "NMC launches digital weighbridge ticketing tracking under new contractor guidelines." },
    { date: "May 20, 2026", title: "First GPS Discrepancies Flagged", desc: "AuditChain flags multiple trips where registered truck dump weight has zero corresponding dump site GPS entries." },
    { date: "June 15, 2026", title: "Suspicious Weight Pattern Allegations", desc: "Citizen groups publish weighbridge logs showing exact repeating heavy weights registered by BVG India trucks." },
    { date: "July 12, 2026", title: "Formal Waste Collection Inquiry Ordered", desc: "NMC Commissioner orders full forensic audit over 6,400+ MT sudden drop in monthly garbage tonnage billing." },
    { date: "August 15, 2026", title: "AuditChain Public Dashboard Released", desc: "Platform opened for public scrutiny to allow citizens to trace locked municipal waste tickets and report road SLA breaches." }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-dossier-border pb-4">
        <h1 className="font-serif text-3xl font-black uppercase tracking-tight text-dossier-text">Public Transparency Portal</h1>
        <p className="text-[10px] text-dossier-muted font-mono mt-0.5 uppercase font-bold">PUBLIC ACCESS CHANNEL — MUNICIPAL COMPLIANCE RECORD</p>
      </div>

      {/* Inquiry status box */}
      <div className="border border-status-flagged bg-status-flagged/5 p-6 font-mono text-xs text-dossier-text">
        <div className="flex items-center gap-2 text-status-flagged font-bold text-sm uppercase">
          <Scale size={20} />
          <span>Active Forensic Inquiry: IN PROGRESS</span>
        </div>
        <p className="text-xs text-dossier-text mt-3 leading-relaxed font-sans font-medium">
          The Nagpur Municipal Corporation has ordered a formal inquiry into waste collection invoicing from April–July 2026. 
          AuditChain provides tamper-proof blockchain evidence logs to investigation committees. 
          All weighbridge tickets shown on this portal are cryptographically locked on-chain and cannot be edited by contractor operators.
        </p>
      </div>

      {/* Contractor compliance report cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 border border-dossier-border divide-y md:divide-y-0 md:divide-x divide-dossier-border bg-dossier-card">
        {contractors.map((c: any) => {
          const rating = getGrade(c.id);
          return (
            <div key={c.id} className="p-6 flex flex-col justify-between h-56">
              <div>
                <div className="flex justify-between items-start">
                  <span className="font-mono text-[9px] text-dossier-muted uppercase font-bold">Compliance Grade</span>
                  <span className={`font-serif text-3xl font-black ${rating.color}`}>{rating.grade}</span>
                </div>
                <h3 className="font-serif text-sm font-extrabold mt-2 text-dossier-text uppercase">{c.name}</h3>
                <p className="text-[11px] text-dossier-muted mt-2.5 font-sans font-medium leading-relaxed">{rating.desc}</p>
              </div>
              <div className="pt-3 border-t border-dashed border-dossier-border font-mono text-[9px] text-dossier-muted uppercase font-bold">
                Total Claims: ₹{(c.claims_inr / 10000000).toFixed(2)} Cr
              </div>
            </div>
          );
        })}
      </div>

      {/* Chronological timeline */}
      <div className="border border-dossier-border p-6 bg-dossier-card">
        <h3 className="font-serif text-lg font-extrabold uppercase tracking-tight pb-3 border-b border-dossier-border mb-6 text-dossier-text">
          Inquiry Chronology & Audit Timeline (2026)
        </h3>

        <div className="relative border-l border-dossier-border ml-4 space-y-6 font-mono text-xs">
          {timelineEvents.map((event, idx) => (
            <div key={idx} className="relative pl-6">
              <span className="absolute -left-1.5 top-1 bg-dossier-bg border-2 border-dossier-text rounded-full w-2.5 h-2.5"></span>
              <span className="text-[10px] text-status-flagged font-bold uppercase tracking-wider">{event.date}</span>
              <h4 className="font-serif text-sm font-bold text-dossier-text mt-0.5 uppercase">{event.title}</h4>
              <p className="text-[11px] text-dossier-muted font-sans font-medium leading-relaxed mt-1.5">{event.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
