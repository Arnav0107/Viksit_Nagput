import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle, AlertTriangle, Send, RefreshCw, MapPin, Camera, X, ShieldCheck } from 'lucide-react';

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

const WARDS = ['Unspecified', ...Object.keys(WARD_CENTERS)];

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

export const DustbinRequestForm: React.FC = () => {
    const [areaDescription, setAreaDescription] = useState('');
    const [reason, setReason] = useState('');
    const [wardName, setWardName] = useState('Unspecified');
    const [photo, setPhoto] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [gpsStatus, setGpsStatus] = useState<'idle' | 'locating' | 'success' | 'denied'>('idle');
    const [gpsError, setGpsError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [submittedData, setSubmittedData] = useState<any | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        captureLocation();
    }, []);

    useEffect(() => {
        if (location) {
            setWardName(resolveWardFromCoordinates(location.lat, location.lng));
        }
    }, [location]);

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

    const removePhoto = () => {
        setPhoto(null);
        setPhotoPreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!areaDescription.trim() || areaDescription.trim().length < 3) {
            setSubmitError('Please describe the area or locality.');
            return;
        }
        if (!reason.trim() || reason.trim().length < 5) {
            setSubmitError('Please provide a short reason.');
            return;
        }
        if (!wardName.trim() || wardName === 'Unspecified') {
            setSubmitError('Please choose a ward when GPS is unavailable.');
            return;
        }

        setSubmitting(true);
        setSubmitError(null);

        try {
            const formData = new FormData();
            formData.append('area_description', areaDescription.trim());
            formData.append('reason', reason.trim());
            formData.append('ward_name', wardName);
            if (photo) formData.append('photo', photo);
            if (location) {
                formData.append('latitude', location.lat.toString());
                formData.append('longitude', location.lng.toString());
            }

            const response = await fetch('/api/dustbin-requests', { method: 'POST', body: formData });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || 'Failed to submit dustbin request.');
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
        setAreaDescription('');
        setReason('');
        setWardName('Unspecified');
        setPhoto(null);
        setPhotoPreview(null);
        setSubmittedData(null);
        setSubmitError(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        captureLocation();
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4 sm:p-6 text-slate-800">
            <div className="w-full max-w-2xl bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-slate-950 text-white p-6 sm:p-8">
                    <div className="inline-flex items-center gap-2 bg-amber-500/20 text-amber-300 border border-amber-500/30 px-3 py-1 rounded-full text-xs font-semibold tracking-wider uppercase mb-3">
                        <span className="material-symbols-outlined text-[16px]">delete_sweep</span>
                        NMC Dustbin Request
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight text-white m-0 mb-2">Request More Dustbins</h1>
                    <p className="text-slate-300 text-xs sm:text-sm m-0 leading-relaxed">
                        Tell the ward officer which locality needs additional dustbins. Nearby requests are grouped together for easier prioritization.
                    </p>
                    <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                        <span className="inline-flex items-center gap-1.5 bg-white/10 text-white border border-white/15 px-3 py-1.5 rounded-lg font-mono">
                            <MapPin className="w-3.5 h-3.5 text-amber-300" />
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
                            <h2 className="text-xl font-bold text-slate-900 mb-2">Dustbin Request Submitted</h2>
                            <p className="text-sm text-slate-600 mb-6 max-w-lg">
                                Your request has been grouped into <strong>{submittedData.request?.status}</strong> queue for <strong>{submittedData.request?.ward_name}</strong>.
                            </p>

                            <div className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6 text-left text-xs text-slate-700 flex flex-col gap-2.5">
                                <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                                    <span className="text-slate-500 font-medium">Request ID</span>
                                    <span className="font-mono font-semibold text-slate-900">{submittedData.request?.id}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-500 font-medium">Ward</span>
                                    <span className="font-semibold text-slate-900">{submittedData.request?.ward_name}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-500 font-medium">Request Count</span>
                                    <span className="font-semibold text-slate-900">{submittedData.request?.request_count}</span>
                                </div>
                                <div className="pt-2 border-t border-slate-200">
                                    <span className="text-slate-500 font-medium block mb-1">Reason</span>
                                    <p className="text-slate-800 m-0 italic font-normal">{submittedData.request?.reason}</p>
                                </div>
                            </div>

                            <button type="button" onClick={resetForm} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3 px-4 rounded-xl transition-all cursor-pointer text-sm">
                                Submit Another Request
                            </button>
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
                                    Locality / Area Description <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    rows={3}
                                    value={areaDescription}
                                    onChange={(event) => setAreaDescription(event.target.value)}
                                    placeholder="For example: MG Road near the market, behind the school, or by the bus stop..."
                                    className="w-full p-3.5 text-sm bg-white border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all resize-none"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
                                    Why are more dustbins needed? <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    rows={4}
                                    value={reason}
                                    onChange={(event) => setReason(event.target.value)}
                                    placeholder="For example: only one bin for the whole street, bin becomes full every evening, waste spills onto the road..."
                                    className="w-full p-3.5 text-sm bg-white border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all resize-none"
                                    required
                                />
                                <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                                    <span>Minimum 5 characters</span>
                                    <span>{reason.trim().length} chars</span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
                                    Ward Zone <span className="text-slate-400 font-normal">(suggested from GPS)</span>
                                </label>
                                <select
                                    value={wardName}
                                    onChange={(event) => setWardName(event.target.value)}
                                    className="w-full px-3.5 py-3 text-sm bg-white border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                                >
                                    {WARDS.map((ward) => (
                                        <option key={ward} value={ward}>{ward}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
                                    Optional Photo
                                </label>
                                {photoPreview ? (
                                    <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-100 max-h-64 flex items-center justify-center">
                                        <img src={photoPreview} alt="Dustbin preview" className="w-full max-h-64 object-contain" />
                                        <button type="button" onClick={removePhoto} className="absolute top-2 right-2 bg-slate-900/80 hover:bg-slate-900 text-white p-1.5 rounded-full backdrop-blur transition-all cursor-pointer" title="Remove photo">
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <div>
                                        <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoChange} className="hidden" id="dustbin-photo-input" />
                                        <label htmlFor="dustbin-photo-input" className="flex flex-col items-center justify-center gap-2 p-5 border-2 border-dashed border-slate-300 hover:border-amber-500 bg-slate-50 hover:bg-amber-50/30 rounded-xl cursor-pointer transition-all text-center">
                                            <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
                                                <Camera className="w-5 h-5" />
                                            </div>
                                            <span className="text-sm font-semibold text-slate-800">Take Photo or Upload Image</span>
                                            <span className="text-xs text-slate-500">Optional supporting evidence</span>
                                        </label>
                                    </div>
                                )}
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
                                <button type="button" onClick={captureLocation} disabled={gpsStatus === 'locating'} className="text-xs font-semibold text-amber-600 hover:text-amber-700 cursor-pointer flex items-center gap-1 shrink-0 ml-2">
                                    <RefreshCw className={`w-3 h-3 ${gpsStatus === 'locating' ? 'animate-spin' : ''}`} />
                                    {location ? 'Refresh GPS' : 'Enable GPS'}
                                </button>
                            </div>

                            <button type="submit" disabled={submitting || !areaDescription.trim() || reason.trim().length < 5} className="w-full mt-2 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm active:scale-[0.99] cursor-pointer disabled:cursor-not-allowed text-sm">
                                {submitting ? (
                                    <>
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                        Submitting Request...
                                    </>
                                ) : (
                                    <>
                                        <Send className="w-4 h-4" />
                                        Request Additional Dustbins
                                    </>
                                )}
                            </button>

                            <div className="flex items-center justify-center gap-1.5 text-center text-[11px] text-slate-400 mt-1">
                                <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                                AuditChain Nagpur • Ward Queue
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};
