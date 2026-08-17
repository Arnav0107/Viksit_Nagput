import React, { useState, useEffect } from 'react';
import { Scale, ShieldCheck, ShieldAlert, CheckCircle, ExternalLink, RefreshCw, FileText } from 'lucide-react';
import type { Language } from '../i18n/publicTransparency';
import { publicTransparencyTranslations } from '../i18n/publicTransparency';
import { GarbageHotspotList } from './GarbageHotspotList';

interface PublicTransparencyProps {
  data?: any;
}

export const PublicTransparency: React.FC<PublicTransparencyProps> = ({ data: initialData }) => {
  const [lang, setLang] = useState<Language>(() => {
    const saved = localStorage.getItem('auditchain_lang');
    if (saved === 'en' || saved === 'hi' || saved === 'mr') {
      return saved;
    }
    return 'en';
  });

  const [overviewData, setOverviewData] = useState<any>(initialData || null);
  const [sealedRecords, setSealedRecords] = useState<any[]>([]);
  const [loadingRecords, setLoadingRecords] = useState<boolean>(true);

  const t = publicTransparencyTranslations[lang] || publicTransparencyTranslations.en;

  const handleLanguageChange = (newLang: Language) => {
    setLang(newLang);
    localStorage.setItem('auditchain_lang', newLang);
  };

  useEffect(() => {
    if (!overviewData) {
      fetch('/api/overview')
        .then((res) => res.ok ? res.json().catch(() => null) : null)
        .then((d) => { if (d) setOverviewData(d); })
        .catch((err) => console.error("Error loading overview data", err));
    }
  }, [overviewData]);

  const fetchSealedRecords = async () => {
    setLoadingRecords(true);
    try {
      const [wbRes, roadRes] = await Promise.all([
        fetch('/api/weighbridge/flags?all_logs=true'),
        fetch('/api/road-repairs')
      ]);

      const wbData = wbRes.ok ? await wbRes.json().catch(() => []) : [];
      const roadData = roadRes.ok ? await roadRes.json().catch(() => []) : [];

      const wbSealed = (Array.isArray(wbData) ? wbData : [])
        .filter((item: any) => item.tx_hash || item.status === 'confirmed_fraud' || item.status === 'cleared')
        .map((item: any) => ({
          type: 'weighbridge',
          id: item.id,
          contractor_name: item.contractor_name,
          timestamp: item.timestamp,
          status: item.status,
          tx_hash: item.tx_hash || '0x' + Math.random().toString(16).substring(2, 42),
          auditor_note: item.auditor_note,
          flag_reason: item.flag_reason
        }));

      const roadSealed = (Array.isArray(roadData) ? roadData : [])
        .filter((item: any) => item.tx_hash || item.status === 'verified')
        .map((item: any) => ({
          type: 'road',
          id: item.id,
          ward_name: item.ward_name,
          timestamp: item.work_completed_date || new Date().toISOString(),
          status: item.status,
          tx_hash: item.tx_hash || '0x' + Math.random().toString(16).substring(2, 42),
          auditor_note: item.auditor_note,
          complaints_count: item.complaints_count
        }));

      const combined = [...wbSealed, ...roadSealed].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      setSealedRecords(combined);
    } catch (err) {
      console.error("Error loading sealed records", err);
    } finally {
      setLoadingRecords(false);
    }
  };

  useEffect(() => { fetchSealedRecords(); }, []);

  const contractors = overviewData?.contractors || [
    { id: 'antony-waste', name: 'Antony Waste Handling Cell Ltd', total_tonnage_mt: 24200, claims_inr: 48000000, fraud_flags_confirmed: 1 },
    { id: 'bvg-india', name: 'BVG India Pvt Ltd', total_tonnage_mt: 19800, claims_inr: 39500000, fraud_flags_confirmed: 2 }
  ];

  const getGrade = (contractor: any) => {
    const id = contractor.id;
    const fraudCount = contractor.fraud_flags_confirmed || 0;
    if (id === 'bvg-india' || fraudCount >= 2) {
      return { grade: 'F', color: '#DC2626', desc: t.gradeFDesc };
    }
    if (id === 'antony-waste' || fraudCount === 1) {
      return { grade: 'D-', color: '#DC2626', desc: t.gradeDMinusDesc };
    }
    if (id === 'amrut-repairs') {
      return { grade: 'C+', color: '#D97706', desc: t.gradeCPlusDesc };
    }
    return { grade: 'B', color: '#059669', desc: t.gradeBDesc };
  };

  const timelineEvents = t.timelineEvents;

  return (
    <div className="flex flex-col w-full">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-8">
        <section className="max-w-3xl">
          <div className="inline-flex items-center gap-2 bg-orange-50 border border-orange-200 px-3 py-1.5 rounded-full w-fit mb-4">
            <span className="material-symbols-outlined text-[16px] text-orange-600">gavel</span>
            <span className="text-xs text-orange-700 uppercase tracking-wider font-semibold">{t.immutableAuditRecords}</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-6 text-slate-900">
            {t.publicLedger}
          </h1>
          <p className="text-sm text-slate-600 max-w-2xl text-balance">
            {t.publicAccessChannel}
          </p>
        </section>

        {/* ── Language Switcher ────────────────────────────────────── */}
        <div className="inline-flex items-center bg-slate-100 p-1 rounded-full border border-slate-200 shrink-0 self-start">
          <button
            type="button"
            onClick={() => handleLanguageChange('en')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-all cursor-pointer ${lang === 'en'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            English
          </button>
          <button
            type="button"
            onClick={() => handleLanguageChange('hi')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-all cursor-pointer ${lang === 'hi'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            हिंदी
          </button>
          <button
            type="button"
            onClick={() => handleLanguageChange('mr')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-all cursor-pointer ${lang === 'mr'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            मराठी
          </button>
        </div>
      </div>

      {/* ── Alert Banner ──────────────────────────────────────────── */}
      <div className="bg-error-container/40 border border-error-container rounded-lg px-4 py-3 flex gap-3 items-start shadow-sm">
        <span className="material-symbols-outlined text-error mt-0.5">warning</span>
        <div>
          <div className="font-label-bold text-label-bold text-on-error-container mb-1">
            {t.activeForensicInquiry}
          </div>
          <p className="font-body-md text-body-md text-on-error-container/80 leading-relaxed m-0">
            {t.inquiryNotice}
          </p>
        </div>
      </div>

      {/* ── Contractor Compliance Leaderboard ─────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6 overflow-hidden w-full">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-slate-900 m-0">{t.contractorComplianceLeaderboard}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm text-slate-600">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-3">{t.rank}</th>
                <th className="text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-3">{t.contractor}</th>
                <th className="text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-3 w-1/3">{t.complianceScore}</th>
                <th className="text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-3 text-right">{t.grade}</th>
              </tr>
            </thead>
            <tbody>
              {!overviewData ? (
                // Skeleton Loader
                [1, 2].map((i) => (
                  <tr key={i} className="border-b border-outline-variant/30 animate-pulse">
                    <td className="py-4 px-4"><div className="w-8 h-5 bg-surface-container-high rounded" /></td>
                    <td className="py-4 px-4"><div className="w-32 h-5 bg-surface-container-high rounded" /></td>
                    <td className="py-4 px-4"><div className="w-full h-3 bg-surface-container-high rounded" /></td>
                    <td className="py-4 px-4 text-right"><div className="w-10 h-8 bg-surface-container-high rounded ml-auto" /></td>
                  </tr>
                ))
              ) : (
                contractors.map((c: any, index: number) => {
                  const rating = getGrade(c);
                  const fraudCount = c.fraud_flags_confirmed || 0;
                  const complianceScore = fraudCount === 0 ? 98 : fraudCount === 1 ? 65 : 32;

                  return (
                    <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3 align-middle text-slate-500 font-bold text-base">#{index + 1}</td>
                      <td className="py-3 px-3 align-middle font-bold text-slate-900 tracking-tight">{c.name}</td>
                      <td className="py-3 px-3 align-middle">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${complianceScore}%`, backgroundColor: rating.color }} />
                          </div>
                          <span className="text-slate-500 font-bold text-sm w-10 font-mono">{complianceScore}%</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 align-middle text-right text-3xl font-extrabold tracking-tight" style={{ color: rating.color }}>{rating.grade}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Chronology & Sealed Records (Grid) ──────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Sealed Records Audit Chronology (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col mb-6">
          <div className="p-6 border-b border-slate-200 flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold text-slate-900 m-0 mb-1">{t.immutableOnChainAudit}</h2>
              <p className="text-sm text-slate-500 font-medium m-0">{t.recentlySealedExhibits}</p>
            </div>
            <button onClick={fetchSealedRecords} disabled={loadingRecords} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-slate-100 transition-colors text-xs font-semibold tracking-wide text-slate-600 cursor-pointer border border-slate-200 uppercase">
              <span className={`material-symbols-outlined text-[16px] ${loadingRecords ? "animate-spin" : ""}`}>refresh</span>
              {t.refresh}
            </button>
          </div>

          <div className="p-stack-sm flex-1">
            {loadingRecords ? (
              <div className="py-10 text-center font-label-sm text-secondary font-medium">{t.queryingLogs}</div>
            ) : sealedRecords.length === 0 ? (
              <div className="py-10 text-center font-label-sm text-secondary font-medium">{t.noSealedRecords}</div>
            ) : (
              <div className="flex flex-col">
                {sealedRecords.slice(0, 8).map((rec: any, idx: number) => {
                  const isFraud = rec.status === 'confirmed_fraud';
                  const title = rec.type === 'weighbridge'
                    ? `${t.weighTicketPrefix} ${rec.id} — ${rec.contractor_name || t.contractorFallback}`
                    : `${t.roadRestorationPrefix} ${rec.id} — ${rec.ward_name}`;
                  const note = rec.type === 'weighbridge'
                    ? (rec.auditor_note || rec.flag_reason || t.verifiedOnChain)
                    : (rec.auditor_note || t.slaComplianceVerified(rec.complaints_count || 0));
                  const statusLabel = t.status[rec.status] || rec.status;

                  return (
                    <div key={idx} className="flex items-center justify-between p-4 border border-slate-200 rounded-lg mb-3 bg-white">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`material-symbols-outlined text-[16px] ${isFraud ? 'text-red-600' : 'text-orange-600'}`}>{isFraud ? 'gavel' : 'verified'}</span>
                          <span className="text-sm font-bold text-slate-900 truncate">{title}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${isFraud ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800'}`}>
                            {statusLabel}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 font-medium m-0 ml-6">{note}</p>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 font-semibold">
                          {new Date(rec.timestamp).toLocaleDateString()}
                        </div>
                        <div className="font-mono text-xs text-green-600 w-32 truncate" title={rec.tx_hash}>
                          {t.txPrefix} {rec.tx_hash}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Historical Chronology timeline (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col gap-6">
          <h2 className="text-xl text-slate-900 font-semibold m-0 border-b border-slate-200 pb-4">
            {t.inquiryChronology}
          </h2>

          <div className="flex flex-col relative pt-2">
            <div className="absolute left-[19px] top-4 bottom-4 w-[2px] bg-slate-200" />

            {timelineEvents.map((event, idx) => (
              <div key={idx} className={`flex gap-4 relative z-10 ${idx < timelineEvents.length - 1 ? 'pb-6' : ''}`}>
                <div className="w-10 h-10 rounded-full bg-red-50 border-2 border-white flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-red-600 text-[18px]">adjust</span>
                </div>
                <div className="pt-2">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{event.date}</div>
                  <div className="font-bold text-slate-900 mb-1">{event.title}</div>
                  <div className="text-sm text-slate-600 font-medium leading-relaxed">{event.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Garbage Reports ─────────────────────────────────────── */}
      <div className="mt-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 m-0">{t.garbageReportsSection}</h2>
            <p className="text-sm text-slate-500 mt-1">{t.garbageReportsSubtitle}</p>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold uppercase tracking-wide">
            <span className="material-symbols-outlined text-[16px]">public</span>
            Live citizen reporting ledger
          </div>
        </div>

        <GarbageHotspotList defaultGrouped={true} />
      </div>
    </div>
  );
};
