import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronRight, Filter, RefreshCw, MapPin, Camera, MessageSquareText, CheckCircle2, AlertTriangle, Download, ShieldCheck } from 'lucide-react';

const WARD_ORDER = [
    'Laxmi Nagar',
    'Dharampeth',
    'Hanuman Nagar',
    'Dhantoli',
    'Nehru Nagar',
    'Gandhi Baugh',
    'Sataranjipura',
    'Lakadganj',
    'Ashi Nagar',
    'Mangalwari',
    'Unspecified',
];

interface GarbageHotspotListProps {
    scopeToWard?: string;
    showActions?: boolean;
    token?: string | null;
    defaultGrouped?: boolean;
}

export const GarbageHotspotList: React.FC<GarbageHotspotListProps> = ({ scopeToWard, showActions = false, token, defaultGrouped = false }) => {
    const [hotspots, setHotspots] = useState<any[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [wardFilter, setWardFilter] = useState<string>(scopeToWard || 'All Wards');
    const [groupByWard, setGroupByWard] = useState<boolean>(defaultGrouped || Boolean(scopeToWard));
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
    const [detailCache, setDetailCache] = useState<Record<string, any>>({});
    const [showResolved, setShowResolved] = useState<boolean>(false);
    const [printingReport, setPrintingReport] = useState<any | null>(null);
    const [printingHotspot, setPrintingHotspot] = useState<any | null>(null);

    useEffect(() => {
        if (printingReport && printingHotspot) {
            const timer = setTimeout(() => {
                window.print();
                setPrintingReport(null);
                setPrintingHotspot(null);
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [printingReport, printingHotspot]);

    useEffect(() => {
        if (scopeToWard) {
            setWardFilter(scopeToWard);
        }
    }, [scopeToWard]);

    const loadHotspots = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/garbage-hotspots');
            const data = await response.json();
            setHotspots(Array.isArray(data) ? data : []);
        } catch (fetchError) {
            setError('Unable to load garbage hotspots.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadHotspots();
    }, [scopeToWard]);

    const filteredHotspots = useMemo(() => {
        let list = scopeToWard ? hotspots.filter((hotspot) => hotspot.ward_name === scopeToWard) : hotspots;
        if (wardFilter !== 'All Wards' && !scopeToWard) {
            list = list.filter((hotspot) => hotspot.ward_name === wardFilter);
        }
        if (!showResolved) {
            list = list.filter((hotspot) => hotspot.status !== 'resolved');
        }
        return list;
    }, [hotspots, wardFilter, scopeToWard, showResolved]);

    const groupedHotspots = useMemo(() => {
        if (!groupByWard) return null;
        const groups: Record<string, any[]> = {};
        filteredHotspots.forEach((hotspot) => {
            const ward = hotspot.ward_name || 'Unspecified';
            groups[ward] = groups[ward] || [];
            groups[ward].push(hotspot);
        });
        return groups;
    }, [filteredHotspots, groupByWard]);

    const toggleExpanded = async (hotspotId: string) => {
        const next = new Set(expandedIds);
        if (next.has(hotspotId)) {
            next.delete(hotspotId);
            setExpandedIds(next);
            return;
        }

        next.add(hotspotId);
        setExpandedIds(next);

        if (!detailCache[hotspotId]) {
            try {
                const response = await fetch(`/api/garbage-hotspots/${hotspotId}`);
                const data = await response.json();
                setDetailCache((prev) => ({ ...prev, [hotspotId]: data }));
            } catch {
                setDetailCache((prev) => ({ ...prev, [hotspotId]: null }));
            }
        }
    };

    const sendStatusUpdate = async (hotspotId: string, status: 'acknowledged' | 'resolved') => {
        const resolution_note = status === 'resolved' ? window.prompt('Optional resolution note') || '' : '';
        try {
            const response = await fetch(`/api/garbage-hotspots/${hotspotId}/status`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ status, resolution_note }),
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || 'Unable to update hotspot status.');
            }
            await loadHotspots();
        } catch (statusError: any) {
            setError(statusError.message || 'Unable to update hotspot status.');
        }
    };

    const renderHotspotCard = (hotspot: any, index: number) => {
        const isExpanded = expandedIds.has(hotspot.id);
        const detail = detailCache[hotspot.id] || hotspot;
        const similarCount = Math.max(0, (hotspot.report_count || 1) - 1);

        return (
            <article key={hotspot.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-4 sm:p-5 flex flex-col gap-4">
                    <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                        <div className="relative w-full sm:w-24 h-44 sm:h-24 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                            {hotspot.representative_photo_url ? (
                                <img src={hotspot.representative_photo_url} alt={hotspot.title} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-400">
                                    <Camera className="w-6 h-6" />
                                </div>
                            )}
                            <div className="absolute top-2 left-2 bg-slate-900/80 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">#{index + 1}</div>
                        </div>

                        <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                                <span className={`text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full ${hotspot.status === 'resolved' ? 'bg-emerald-100 text-emerald-800' : hotspot.status === 'acknowledged' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'}`}>
                                    {hotspot.status}
                                </span>
                                <span className="text-[10px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">{hotspot.category || 'other'}</span>
                                <span className="text-[10px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">{hotspot.ward_name}</span>
                                {similarCount > 0 && (
                                    <span className="text-[10px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700">
                                        +{similarCount} similar reports
                                    </span>
                                )}
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 tracking-tight mb-1">{hotspot.title}</h3>
                            <p className="text-sm text-slate-600 mb-3 line-clamp-2">{detail.reports?.[0]?.description || hotspot.title}</p>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                                    <div className="text-slate-500 uppercase tracking-wide font-semibold mb-1">Reports</div>
                                    <div className="text-slate-900 font-extrabold text-lg">{hotspot.report_count}</div>
                                </div>
                                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                                    <div className="text-slate-500 uppercase tracking-wide font-semibold mb-1">First</div>
                                    <div className="text-slate-900 font-semibold">{hotspot.first_reported_at ? new Date(hotspot.first_reported_at).toLocaleDateString() : '-'}</div>
                                </div>
                                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                                    <div className="text-slate-500 uppercase tracking-wide font-semibold mb-1">Last</div>
                                    <div className="text-slate-900 font-semibold">{hotspot.last_reported_at ? new Date(hotspot.last_reported_at).toLocaleDateString() : '-'}</div>
                                </div>
                                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                                    <div className="text-slate-500 uppercase tracking-wide font-semibold mb-1">Coordinates</div>
                                    <div className="text-slate-900 font-mono text-[11px]">{Number(hotspot.latitude).toFixed(4)}, {Number(hotspot.longitude).toFixed(4)}</div>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-start">
                            {showActions && (
                                <>
                                    <button type="button" onClick={() => sendStatusUpdate(hotspot.id, 'acknowledged')} className="px-3 py-2 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 text-xs font-semibold hover:bg-amber-100 transition-colors cursor-pointer">
                                        Acknowledge
                                    </button>
                                    <button type="button" onClick={() => sendStatusUpdate(hotspot.id, 'resolved')} className="px-3 py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-semibold hover:bg-emerald-100 transition-colors cursor-pointer">
                                        Resolve
                                    </button>
                                </>
                            )}
                            <button type="button" onClick={() => toggleExpanded(hotspot.id)} className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer inline-flex items-center gap-1.5">
                                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                {isExpanded ? 'Hide' : 'Details'}
                            </button>
                        </div>
                    </div>

                    {isExpanded && (
                        <div className="border-t border-slate-200 pt-4 mt-1">
                            <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-slate-800">
                                <MessageSquareText className="w-4 h-4 text-slate-500" />
                                Linked Reports
                            </div>
                            <div className="space-y-3">
                                {(detail.reports || []).map((report: any) => (
                                    <div key={report.id} className="grid grid-cols-1 sm:grid-cols-[110px_minmax(0,1fr)] gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3">
                                        <div className="rounded-lg overflow-hidden bg-slate-100 border border-slate-200 h-24 sm:h-20">
                                            {report.photo_url ? <img src={report.photo_url} alt={report.id} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-400"><Camera className="w-5 h-5" /></div>}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2 mb-1">
                                                <span className="font-mono text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-900 text-white">{report.id}</span>
                                                <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-white text-slate-700 border border-slate-200">{report.status}</span>
                                                {report.ai_is_duplicate_of_hotspot && (
                                                    <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Matched</span>
                                                )}
                                            </div>
                                            <p className="text-sm text-slate-700 mb-2">{report.description}</p>
                                            <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-500 mt-1">
                                                <div className="flex flex-wrap items-center gap-3">
                                                    <span>{report.created_at ? new Date(report.created_at).toLocaleString() : '-'}</span>
                                                    {report.ai_match_confidence != null && <span>Confidence: {Math.round(report.ai_match_confidence * 100)}%</span>}
                                                    {(showActions && report.ai_reasoning) && <span className="text-slate-600">AI: {report.ai_reasoning}</span>}
                                                </div>
                                                <button type="button" onClick={() => { setPrintingReport(report); setPrintingHotspot(hotspot); }} className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-semibold cursor-pointer">
                                                    <Download className="w-3.5 h-3.5" />
                                                    Download Receipt
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </article>
        );
    };

    const renderBody = () => {
        if (loading) {
            return <div className="py-10 text-center text-sm text-slate-500">Loading garbage hotspots...</div>;
        }
        if (error) {
            return <div className="py-10 text-center text-sm text-rose-600 flex items-center justify-center gap-2"><AlertTriangle className="w-4 h-4" />{error}</div>;
        }
        if (!filteredHotspots.length) {
            return <div className="py-10 text-center text-sm text-slate-500">No garbage hotspots found.</div>;
        }

        if (groupByWard && groupedHotspots) {
            return Object.entries(groupedHotspots)
                .sort((a, b) => WARD_ORDER.indexOf(a[0]) - WARD_ORDER.indexOf(b[0]))
                .map(([ward, items]) => (
                    <section key={ward} className="space-y-3">
                        <div className="flex items-center gap-2 mt-6 mb-2">
                            <span className="px-3 py-1 rounded-full bg-slate-900 text-white text-xs font-bold uppercase tracking-wide">{ward}</span>
                            <span className="text-xs text-slate-500 font-semibold">{items.length} hotspot(s)</span>
                        </div>
                        <div className="space-y-4">
                            {items.map((hotspot, index) => renderHotspotCard(hotspot, index))}
                        </div>
                    </section>
                ));
        }

        return <div className="space-y-4">{filteredHotspots.map((hotspot, index) => renderHotspotCard(hotspot, index))}</div>;
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 overflow-hidden w-full">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
                <div>
                    <h2 className="text-xl font-semibold text-slate-900 m-0">Garbage Reports</h2>
                    <p className="text-sm text-slate-500 mt-1">Ranked by report count so the busiest hotspots rise to the top.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {!scopeToWard && (
                        <select value={wardFilter} onChange={(event) => setWardFilter(event.target.value)} className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-700">
                            <option value="All Wards">All Wards</option>
                            {WARD_ORDER.filter((ward) => ward !== 'Unspecified').map((ward) => <option key={ward} value={ward}>{ward}</option>)}
                        </select>
                    )}
                    <button type="button" onClick={() => setShowResolved((val) => !val)} className={`px-3 py-2 rounded-xl border text-sm inline-flex items-center gap-2 transition-colors cursor-pointer ${showResolved ? 'bg-emerald-50 border-emerald-200 text-emerald-800 font-semibold' : 'border-slate-200 bg-white text-slate-700'}`}>
                        <CheckCircle2 className="w-4 h-4" />
                        {showResolved ? 'Showing Resolved' : 'Hide Resolved'}
                    </button>
                    <button type="button" onClick={() => setGroupByWard((value) => !value)} className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 inline-flex items-center gap-2">
                        <Filter className="w-4 h-4" />
                        {groupByWard ? 'Flat view' : 'Group by ward'}
                    </button>
                    <button type="button" onClick={loadHotspots} className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-700 inline-flex items-center gap-2">
                        <RefreshCw className="w-4 h-4" />
                        Refresh
                    </button>
                </div>
            </div>

            {scopeToWard && (
                <div className="mb-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold uppercase tracking-wide">
                    <MapPin className="w-4 h-4" />
                    Scoped to {scopeToWard}
                </div>
            )}

            {renderBody()}

            {printingReport && printingHotspot && createPortal(
                <div id="complaint-receipt-pdf" className="hidden print:block p-8 border-2 border-slate-300 rounded-2xl bg-white max-w-2xl mx-auto text-slate-800">
                    {/* Official Header */}
                    <div className="text-center border-b-2 border-slate-950 pb-6 mb-6">
                        <div className="font-extrabold text-2xl tracking-wider text-slate-950 uppercase">Nagpur Municipal Corporation</div>
                        <div className="text-xs font-bold tracking-widest text-slate-500 uppercase mt-1 flex items-center justify-center gap-1.5">
                            <img src="/trashtrail-logo.jpg" alt="TrashTrail Logo" className="w-4 h-4 rounded-full object-cover shrink-0" />
                            <span>TrashTrail Transparency Portal • Sanitation Watch Receipt</span>
                        </div>
                    </div>

                    {/* Subheading */}
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">Complaint Reference</div>
                            <div className="text-lg font-mono font-extrabold text-slate-950">{printingReport.id}</div>
                        </div>
                        <div className="text-right">
                            <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">Date & Time</div>
                            <div className="text-sm font-bold text-slate-950">
                                {printingReport.created_at ? new Date(printingReport.created_at).toLocaleString() : new Date().toLocaleString()}
                            </div>
                        </div>
                    </div>

                    {/* Main content grid */}
                    <div className="grid grid-cols-2 gap-4 border border-slate-200 rounded-xl p-4 mb-6 bg-slate-50 text-xs">
                        <div>
                            <span className="text-slate-500 font-semibold block mb-1">Ward Name</span>
                            <span className="font-bold text-slate-950 text-sm">{printingHotspot.ward_name || printingReport.ward_name || 'Unspecified'}</span>
                        </div>
                        <div>
                            <span className="text-slate-500 font-semibold block mb-1">Hotspot Association</span>
                            <span className="font-bold text-slate-950 text-sm">
                                {printingReport.ai_is_duplicate_of_hotspot ? `Linked to Hotspot ${printingHotspot.id}` : `New Hotspot Created (${printingHotspot.id})`}
                            </span>
                        </div>
                        <div className="col-span-2">
                            <span className="text-slate-500 font-semibold block mb-1">GPS Location Coordinates</span>
                            <span className="font-mono font-bold text-slate-950 text-sm">
                                {printingReport.latitude != null && printingReport.longitude != null ? `${printingReport.latitude.toFixed(6)}, ${printingReport.longitude.toFixed(6)}` : `${printingHotspot.latitude.toFixed(6)}, ${printingHotspot.longitude.toFixed(6)}`}
                            </span>
                        </div>
                        <div className="col-span-2 border-t border-slate-200 pt-3">
                            <span className="text-slate-500 font-semibold block mb-1">Citizen Complaint Description</span>
                            <p className="text-slate-800 m-0 font-normal text-sm leading-relaxed">{printingReport.description}</p>
                        </div>
                    </div>

                    {/* Evidence Section */}
                    {printingReport.photo_url && (
                        <div className="mb-6">
                            <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-2">Submitted Photo Evidence</div>
                            <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-100 max-h-60 flex items-center justify-center p-2">
                                <img src={printingReport.photo_url} alt="Evidence" className="max-h-56 object-contain" />
                            </div>
                        </div>
                    )}

                    {/* Verification and signature block */}
                    <div className="border-t border-slate-200 pt-6 mt-6">
                        <div className="flex justify-between items-end">
                            <div className="max-w-xs">
                                <div className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider mb-2">
                                    <ShieldCheck className="w-3.5 h-3.5" />
                                    On-Chain Verified
                                </div>
                                <p className="text-[10px] text-slate-500 leading-normal m-0">
                                    This complaint log has been registered under the NMC TrashTrail Nagpur smart contract audit framework for garbage disposal monitoring.
                                </p>
                            </div>
                            <div className="text-right">
                                <div className="w-32 h-10 border-b border-slate-900 mx-auto mb-1 flex items-center justify-center text-xs italic font-serif text-slate-400">NMC Officer</div>
                                <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Authorized Signature</div>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};
