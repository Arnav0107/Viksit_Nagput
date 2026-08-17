import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Filter, RefreshCw, MapPin, Camera, MessageSquareText, XCircle, ThumbsUp, Forward } from 'lucide-react';

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

interface DustbinRequestQueueProps {
    scopeToWard?: string;
    token?: string | null;
}

export const DustbinRequestQueue: React.FC<DustbinRequestQueueProps> = ({ scopeToWard, token }) => {
    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [wardFilter, setWardFilter] = useState<string>(scopeToWard || 'All Wards');

    useEffect(() => {
        if (scopeToWard) {
            setWardFilter(scopeToWard);
        }
    }, [scopeToWard]);

    const loadRequests = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/dustbin-requests', {
                headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            });
            const data = await response.json();
            setRequests(Array.isArray(data) ? data : []);
        } catch {
            setError('Unable to load dustbin requests.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadRequests();
    }, [scopeToWard]);

    const filteredRequests = useMemo(() => {
        const scoped = scopeToWard ? requests.filter((request) => request.ward_name === scopeToWard) : requests;
        if (wardFilter === 'All Wards' || scopeToWard) return scoped;
        return scoped.filter((request) => request.ward_name === wardFilter);
    }, [requests, wardFilter, scopeToWard]);

    const updateStatus = async (requestId: string, status: 'approved' | 'fulfilled' | 'declined') => {
        const officer_note = window.prompt('Optional officer note') || '';
        try {
            const response = await fetch(`/api/dustbin-requests/${requestId}/status`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ status, officer_note }),
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || 'Unable to update request status.');
            }
            await loadRequests();
        } catch (updateError: any) {
            setError(updateError.message || 'Unable to update request status.');
        }
    };

    const renderCard = (request: any) => (
        <article key={request.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 sm:p-5 flex flex-col gap-4">
                <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                    <div className="relative w-full lg:w-28 h-44 lg:h-28 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                        {request.photo_url ? (
                            <img src={request.photo_url} alt={request.id} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-400">
                                <Camera className="w-6 h-6" />
                            </div>
                        )}
                        <div className="absolute top-2 left-2 bg-slate-900/80 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{request.request_count}x</div>
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                            <span className={`text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full ${request.status === 'fulfilled' ? 'bg-emerald-100 text-emerald-800' : request.status === 'approved' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>
                                {request.status}
                            </span>
                            <span className="text-[10px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">{request.ward_name}</span>
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 tracking-tight mb-1">{request.area_description}</h3>
                        <p className="text-sm text-slate-600 mb-3 line-clamp-2">{request.reason}</p>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                                <div className="text-slate-500 uppercase tracking-wide font-semibold mb-1">Requests</div>
                                <div className="text-slate-900 font-extrabold text-lg">{request.request_count}</div>
                            </div>
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                                <div className="text-slate-500 uppercase tracking-wide font-semibold mb-1">Created</div>
                                <div className="text-slate-900 font-semibold">{request.created_at ? new Date(request.created_at).toLocaleDateString() : '-'}</div>
                            </div>
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                                <div className="text-slate-500 uppercase tracking-wide font-semibold mb-1">Updated</div>
                                <div className="text-slate-900 font-semibold">{request.updated_at ? new Date(request.updated_at).toLocaleDateString() : '-'}</div>
                            </div>
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                                <div className="text-slate-500 uppercase tracking-wide font-semibold mb-1">Coordinates</div>
                                <div className="text-slate-900 font-mono text-[11px]">{request.latitude != null && request.longitude != null ? `${Number(request.latitude).toFixed(4)}, ${Number(request.longitude).toFixed(4)}` : 'N/A'}</div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-start">
                        <button type="button" onClick={() => updateStatus(request.id, 'approved')} className="px-3 py-2 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 text-xs font-semibold hover:bg-amber-100 transition-colors cursor-pointer inline-flex items-center gap-1.5">
                            <ThumbsUp className="w-4 h-4" />
                            Approve
                        </button>
                        <button type="button" onClick={() => updateStatus(request.id, 'fulfilled')} className="px-3 py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-semibold hover:bg-emerald-100 transition-colors cursor-pointer inline-flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4" />
                            Fulfilled
                        </button>
                        <button type="button" onClick={() => updateStatus(request.id, 'declined')} className="px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs font-semibold hover:bg-rose-100 transition-colors cursor-pointer inline-flex items-center gap-1.5">
                            <XCircle className="w-4 h-4" />
                            Decline
                        </button>
                    </div>
                </div>

                {request.officer_note && (
                    <div className="border-t border-slate-200 pt-4 mt-1 text-sm text-slate-600">
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Officer Note</div>
                        {request.officer_note}
                    </div>
                )}
            </div>
        </article>
    );

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 overflow-hidden w-full">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
                <div>
                    <h2 className="text-xl font-semibold text-slate-900 m-0">Dustbin Requests</h2>
                    <p className="text-sm text-slate-500 mt-1">Grouped requests help officers see where additional bins are most needed.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {!scopeToWard && (
                        <select value={wardFilter} onChange={(event) => setWardFilter(event.target.value)} className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-700">
                            <option value="All Wards">All Wards</option>
                            {WARD_ORDER.filter((ward) => ward !== 'Unspecified').map((ward) => <option key={ward} value={ward}>{ward}</option>)}
                        </select>
                    )}
                    <button type="button" onClick={loadRequests} className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-700 inline-flex items-center gap-2">
                        <RefreshCw className="w-4 h-4" />
                        Refresh
                    </button>
                </div>
            </div>

            {scopeToWard && (
                <div className="mb-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold uppercase tracking-wide">
                    <MapPin className="w-4 h-4" />
                    Scoped to {scopeToWard}
                </div>
            )}

            {loading ? (
                <div className="py-10 text-center text-sm text-slate-500">Loading dustbin requests...</div>
            ) : error ? (
                <div className="py-10 text-center text-sm text-rose-600 flex items-center justify-center gap-2"><Filter className="w-4 h-4" />{error}</div>
            ) : filteredRequests.length === 0 ? (
                <div className="py-10 text-center text-sm text-slate-500">No dustbin requests found.</div>
            ) : (
                <div className="space-y-4">
                    {filteredRequests.map((request) => renderCard(request))}
                </div>
            )}
        </div>
    );
};
