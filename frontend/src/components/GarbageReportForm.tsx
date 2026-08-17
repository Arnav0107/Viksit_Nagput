import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, CheckCircle, AlertTriangle, Send, RefreshCw, X, MapPin, ShieldCheck, Image as ImageIcon, FileVideo2, Download } from 'lucide-react';

const WARD_CENTERS: Record<string, { lat: number; lng: number }> = {
    'Laxmi Nagar': { lat: 21.1255, lng: 79.0680 },
    'Dharampeth': { lat: 21.1426, lng: 79.0559 },
    'Hanuman Nagar': { lat: 21.1189, lng: 79.1039 },
    'Dhantoli': { lat: 21.1299, lng: 79.0798 },
    'Nehru Nagar': { lat: 21.1150, lng: 79.1180 },
    'Gandhi Baugh': { lat: 21.1550, lng: 79.1050 },
    'Sataranjipura': { lat: 21.1620, lng: 79.1120 },
    'Lakadganj': { lat: 21.1520, lng: 79.1320 },
    'Ashi Nagar': { lat: 21.1780, lng: 79.1200 },
    'Mangalwari': { lat: 21.1710, lng: 79.0720 },
};

const WARDS = Object.keys(WARD_CENTERS);

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
    const toRad = (value: number) => (value * Math.PI) / 180;
    const radiusKm = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * radiusKm * 1000 * Math.asin(Math.sqrt(a));
}

function resolveWardFromCoordinates(lat: number, lng: number): string {
    let bestWard = 'Unspecified';
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const [ward, coords] of Object.entries(WARD_CENTERS)) {
        const distance = haversineMeters(lat, lng, coords.lat, coords.lng);
        if (distance < bestDistance) {
            bestDistance = distance;
            bestWard = ward;
        }
    }
    return bestWard;
}

export const GarbageReportForm: React.FC = () => {
    const [photo, setPhoto] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [extraFile, setExtraFile] = useState<File | null>(null);
    const [extraPreview, setExtraPreview] = useState<string | null>(null);
    const [description, setDescription] = useState<string>('');
    const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [gpsStatus, setGpsStatus] = useState<'idle' | 'locating' | 'success' | 'denied'>('idle');
    const [gpsError, setGpsError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState<boolean>(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [submittedData, setSubmittedData] = useState<any | null>(null);

    const photoInputRef = useRef<HTMLInputElement>(null);
    const extraInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        captureLocation();
    }, []);

    const captureLocation = () => {
        if (!navigator.geolocation) {
            setGpsStatus('denied');
            setGpsError('Geolocation is not supported by your browser.');
            return;
        }

        setGpsStatus('locating');
        setGpsError(null);

        navigator.geolocation.getCurrentPosition(
            (position) => {
                setLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
                setGpsStatus('success');
            },
            () => {
                setGpsStatus('denied');
                setGpsError('GPS permission denied or unavailable. You can still submit without location.');
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
        );
    };

    const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0] || null;
        setPhoto(file);
        setSubmitError(null);
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => setPhotoPreview(reader.result as string);
        reader.readAsDataURL(file);
    };

    const handleExtraChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0] || null;
        setExtraFile(file);
        setSubmitError(null);
        if (!file) return;
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onloadend = () => setExtraPreview(reader.result as string);
            reader.readAsDataURL(file);
            return;
        }
        setExtraPreview(null);
    };

    const clearPhoto = () => {
        setPhoto(null);
        setPhotoPreview(null);
        if (photoInputRef.current) photoInputRef.current.value = '';
    };

    const clearExtra = () => {
        setExtraFile(null);
        setExtraPreview(null);
        if (extraInputRef.current) extraInputRef.current.value = '';
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!photo) {
            setSubmitError('Please attach a photo of the garbage issue.');
            return;
        }
        if (!description.trim() || description.trim().length < 5) {
            setSubmitError('Please provide a brief description (at least 5 characters).');
            return;
        }

        setSubmitting(true);
        setSubmitError(null);

        try {
            const formData = new FormData();
            formData.append('photo', photo);
            if (extraFile) formData.append('extra_file', extraFile);
            formData.append('description', description.trim());
            if (location) {
                formData.append('latitude', location.lat.toString());
                formData.append('longitude', location.lng.toString());
            }

            const response = await fetch('/api/garbage-reports', { method: 'POST', body: formData });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || 'Failed to submit garbage report.');
            }

            const data = await response.json();
            setSubmittedData(data);
        } catch (error: any) {
            setSubmitError(error.message || 'An unexpected error occurred while submitting.');
        } finally {
            setSubmitting(false);
        }
    };

    const resetForm = () => {
        setPhoto(null);
        setPhotoPreview(null);
        setExtraFile(null);
        setExtraPreview(null);
        setDescription('');
        setSubmittedData(null);
        setSubmitError(null);
        if (photoInputRef.current) photoInputRef.current.value = '';
        if (extraInputRef.current) extraInputRef.current.value = '';
        captureLocation();
    };

    const wardName = location ? resolveWardFromCoordinates(location.lat, location.lng) : 'Unspecified';

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4 sm:p-6 text-slate-800">
            <div className="w-full max-w-2xl bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-slate-950 text-white p-6 sm:p-8">
                    <div className="inline-flex items-center gap-2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-1 rounded-full text-xs font-semibold tracking-wider uppercase mb-3">
                        <span className="material-symbols-outlined text-[16px]">eco</span>
                        NMC Sanitation Watch
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight text-white m-0 mb-2">Report Garbage or Sanitation Issue</h1>
                    <p className="text-slate-300 text-xs sm:text-sm m-0 leading-relaxed">
                        Share photo evidence and GPS coordinates so the system can cluster similar reports into the same tracked hotspot.
                    </p>
                    <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                        <span className="inline-flex items-center gap-1.5 bg-white/10 text-white border border-white/15 px-3 py-1.5 rounded-lg font-mono">
                            <MapPin className="w-3.5 h-3.5 text-emerald-300" />
                            {location ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : 'GPS pending'}
                        </span>
                        <span className="inline-flex items-center gap-1.5 bg-white/10 text-white border border-white/15 px-3 py-1.5 rounded-lg font-mono">
                            Ward: {wardName}
                        </span>
                    </div>
                </div>

                <div className="p-6 sm:p-8">
                    {submittedData ? (
                        <div className="flex flex-col items-center text-center py-6">
                            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mb-4 border border-emerald-200">
                                <CheckCircle className="w-8 h-8" />
                            </div>
                            <h2 className="text-xl font-bold text-slate-900 mb-2">Garbage Report Submitted</h2>
                            <p className="text-sm text-slate-600 mb-6 max-w-lg">
                                {submittedData.hotspot_created ? (
                                    <>You're the first to report this issue. We created a new tracked hotspot for <strong>{submittedData.hotspot?.ward_name}</strong>.</>
                                ) : (
                                    <>This report matched an existing hotspot in <strong>{submittedData.hotspot?.ward_name}</strong>. Thanks for confirming it.</>
                                )}
                            </p>

                            <div className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6 text-left text-xs text-slate-700 flex flex-col gap-2.5">
                                <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                                    <span className="text-slate-500 font-medium">Reference ID</span>
                                    <span className="font-mono font-semibold text-slate-900">{submittedData.report?.id}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-500 font-medium">Hotspot ID</span>
                                    <span className="font-mono font-semibold text-slate-900">{submittedData.hotspot?.id}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-500 font-medium">Ward</span>
                                    <span className="font-semibold text-slate-900">{submittedData.hotspot?.ward_name || submittedData.report?.ward_name || 'Unspecified'}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-500 font-medium">Hotspot Count</span>
                                    <span className="font-semibold text-slate-900">{submittedData.hotspot?.report_count}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-500 font-medium">AI Match</span>
                                    <span className="font-semibold text-slate-900">{submittedData.report?.ai_is_duplicate_of_hotspot ? 'Similar report grouped' : 'New hotspot created'}</span>
                                </div>
                                {submittedData.report?.ai_reasoning && (
                                    <div className="pt-2 border-t border-slate-200">
                                        <span className="text-slate-500 font-medium block mb-1">AI Reasoning</span>
                                        <p className="text-slate-800 m-0 italic font-normal">{submittedData.report.ai_reasoning}</p>
                                    </div>
                                )}
                            </div>

                            <div className="w-full flex flex-col sm:flex-row gap-3">
                                <button type="button" onClick={() => window.print()} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl transition-all cursor-pointer text-sm inline-flex items-center justify-center gap-2">
                                    <Download className="w-4 h-4" />
                                    Download PDF Receipt
                                </button>
                                <button type="button" onClick={resetForm} className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3 px-4 rounded-xl transition-all cursor-pointer text-sm inline-flex items-center justify-center">
                                    Submit Another Report
                                </button>
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                            {submitError && (
                                <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 p-3.5 rounded-xl text-xs font-medium">
                                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                    <span>{submitError}</span>
                                </div>
                            )}

                            {gpsError && (
                                <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 text-amber-800 p-3.5 rounded-xl text-xs font-medium">
                                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                    <span>{gpsError}</span>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
                                    Photo Evidence <span className="text-red-500">*</span>
                                </label>
                                {photoPreview ? (
                                    <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-100 max-h-64 flex items-center justify-center">
                                        <img src={photoPreview} alt="Garbage preview" className="w-full max-h-64 object-contain" />
                                        <button type="button" onClick={clearPhoto} className="absolute top-2 right-2 bg-slate-900/80 hover:bg-slate-900 text-white p-1.5 rounded-full backdrop-blur transition-all cursor-pointer" title="Remove photo">
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <div>
                                        <input ref={photoInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoChange} className="hidden" id="garbage-photo-input" />
                                        <label htmlFor="garbage-photo-input" className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-slate-300 hover:border-emerald-500 bg-slate-50 hover:bg-emerald-50/30 rounded-xl cursor-pointer transition-all text-center">
                                            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                                                <Camera className="w-6 h-6" />
                                            </div>
                                            <span className="text-sm font-semibold text-slate-800">Take Photo or Upload Image</span>
                                            <span className="text-xs text-slate-500">Camera capture supported on mobile devices</span>
                                        </label>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
                                    Extra Attachment <span className="text-slate-400 font-normal">(Optional)</span>
                                </label>
                                <input ref={extraInputRef} type="file" accept="image/*,video/*" onChange={handleExtraChange} className="hidden" id="garbage-extra-input" />
                                {extraFile ? (
                                    <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-100 p-3 flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center shrink-0">
                                                {extraFile?.type.startsWith('video/') ? <FileVideo2 className="w-5 h-5" /> : <ImageIcon className="w-5 h-5" />}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="text-sm font-semibold text-slate-900 truncate">{extraFile?.name}</div>
                                                <div className="text-xs text-slate-500">{extraFile?.type || 'Attachment'}</div>
                                            </div>
                                        </div>
                                        <button type="button" onClick={clearExtra} className="bg-slate-900/80 hover:bg-slate-900 text-white p-2 rounded-full transition-all cursor-pointer" title="Remove attachment">
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <label htmlFor="garbage-extra-input" className="flex flex-col items-center justify-center gap-2 p-5 border-2 border-dashed border-slate-300 hover:border-slate-500 bg-slate-50 rounded-xl cursor-pointer transition-all text-center">
                                        <div className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center">
                                            <ImageIcon className="w-5 h-5" />
                                        </div>
                                        <span className="text-sm font-semibold text-slate-800">Add extra photo or short video</span>
                                        <span className="text-xs text-slate-500">Optional supporting evidence</span>
                                    </label>
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
                                    Description of Issue <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    rows={4}
                                    value={description}
                                    onChange={(event) => setDescription(event.target.value)}
                                    placeholder="Describe the sanitation issue, for example overflowing bin, open dump, or garbage not collected..."
                                    className="w-full p-3.5 text-sm bg-white border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none"
                                    required
                                />
                                <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                                    <span>Minimum 5 characters</span>
                                    <span>{description.trim().length} chars</span>
                                </div>
                            </div>

                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2 min-w-0">
                                    <MapPin className={`w-4 h-4 shrink-0 ${location ? 'text-emerald-600' : 'text-slate-400'}`} />
                                    <div className="truncate">
                                        {gpsStatus === 'locating' ? (
                                            <span className="text-slate-500 font-medium">Detecting GPS location...</span>
                                        ) : location ? (
                                            <span className="text-slate-700 font-mono font-medium">GPS: {location.lat.toFixed(4)}, {location.lng.toFixed(4)}</span>
                                        ) : (
                                            <span className="text-slate-500">Location not captured</span>
                                        )}
                                    </div>
                                </div>
                                <button type="button" onClick={captureLocation} disabled={gpsStatus === 'locating'} className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 cursor-pointer flex items-center gap-1 shrink-0 ml-2">
                                    <RefreshCw className={`w-3 h-3 ${gpsStatus === 'locating' ? 'animate-spin' : ''}`} />
                                    {location ? 'Refresh GPS' : 'Enable GPS'}
                                </button>
                            </div>

                            <button type="submit" disabled={submitting || !photo || description.trim().length < 5} className="w-full mt-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm active:scale-[0.99] cursor-pointer disabled:cursor-not-allowed text-sm">
                                {submitting ? (
                                    <>
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                        Submitting Report...
                                    </>
                                ) : (
                                    <>
                                        <Send className="w-4 h-4" />
                                        Submit Garbage Report
                                    </>
                                )}
                            </button>

                            <div className="flex items-center justify-center gap-1.5 text-center text-[11px] text-slate-400 mt-1">
                                <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                                AuditChain Nagpur • Public Sanitation Watch
                            </div>
                        </form>
                    )}
                </div>
            </div>

            {submittedData && createPortal(
                <div id="complaint-receipt-pdf" className="hidden print:block p-8 border-2 border-slate-300 rounded-2xl bg-white max-w-2xl mx-auto">
                    {/* Official Header */}
                    <div className="text-center border-b-2 border-slate-950 pb-6 mb-6">
                        <div className="font-extrabold text-2xl tracking-wider text-slate-950 uppercase">Nagpur Municipal Corporation</div>
                        <div className="text-xs font-bold tracking-widest text-slate-500 uppercase mt-1">AuditChain Transparency Portal • Sanitation Watch Receipt</div>
                    </div>

                    {/* Subheading */}
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">Complaint Reference</div>
                            <div className="text-lg font-mono font-extrabold text-slate-950">{submittedData.report?.id}</div>
                        </div>
                        <div className="text-right">
                            <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">Date & Time</div>
                            <div className="text-sm font-bold text-slate-950">
                                {submittedData.report?.created_at ? new Date(submittedData.report.created_at).toLocaleString() : new Date().toLocaleString()}
                            </div>
                        </div>
                    </div>

                    {/* Main content grid */}
                    <div className="grid grid-cols-2 gap-4 border border-slate-200 rounded-xl p-4 mb-6 bg-slate-50 text-xs">
                        <div>
                            <span className="text-slate-500 font-semibold block mb-1">Ward Name</span>
                            <span className="font-bold text-slate-950 text-sm">{submittedData.hotspot?.ward_name || submittedData.report?.ward_name || 'Unspecified'}</span>
                        </div>
                        <div>
                            <span className="text-slate-500 font-semibold block mb-1">Hotspot Association</span>
                            <span className="font-bold text-slate-950 text-sm">
                                {submittedData.report?.ai_is_duplicate_of_hotspot ? `Linked to Hotspot ${submittedData.hotspot?.id}` : `New Hotspot Created (${submittedData.hotspot?.id})`}
                            </span>
                        </div>
                        <div className="col-span-2">
                            <span className="text-slate-500 font-semibold block mb-1">GPS Location Coordinates</span>
                            <span className="font-mono font-bold text-slate-950 text-sm">
                                {location ? `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}` : 'N/A'}
                            </span>
                        </div>
                        <div className="col-span-2 border-t border-slate-200 pt-3">
                            <span className="text-slate-500 font-semibold block mb-1">Citizen Complaint Description</span>
                            <p className="text-slate-800 m-0 font-normal text-sm leading-relaxed">{description}</p>
                        </div>
                    </div>

                    {/* Evidence Section */}
                    {photoPreview && (
                        <div className="mb-6">
                            <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-2">Submitted Photo Evidence</div>
                            <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-100 max-h-60 flex items-center justify-center p-2">
                                <img src={photoPreview} alt="Evidence" className="max-h-56 object-contain" />
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
                                    This complaint log has been registered under the NMC AuditChain Nagpur smart contract audit framework for garbage disposal monitoring.
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
