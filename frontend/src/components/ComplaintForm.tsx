import React, { useState, useEffect, useRef } from 'react';
import { Camera, MapPin, CheckCircle, AlertTriangle, Send, RefreshCw, X, Image as ImageIcon, ShieldCheck } from 'lucide-react';

export const ComplaintForm: React.FC = () => {
  // Extract optional repairId from path (e.g., /complaint/RR-2026-001 or /complaint/204) or query params
  const [repairId, setRepairId] = useState<string>('');
  
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [description, setDescription] = useState<string>('');
  
  // GPS state
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'locating' | 'success' | 'denied'>('idle');
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Form submission state
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedData, setSubmittedData] = useState<any | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // 1. Parse repairId from URL pathname or search params
    const pathname = window.location.pathname;
    const parts = pathname.split('/').filter(Boolean);
    if (parts.length >= 2 && parts[0].toLowerCase() === 'complaint') {
      setRepairId(decodeURIComponent(parts[1]));
    } else {
      const urlParams = new URLSearchParams(window.location.search);
      const queryId = urlParams.get('repair_id') || urlParams.get('repairId');
      if (queryId) {
        setRepairId(queryId);
      }
    }

    // 2. Auto-capture GPS on mount
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
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
        setGpsStatus('success');
      },
      (error) => {
        setGpsStatus('denied');
        setGpsError('GPS permission denied or unavailable. You can still submit without location.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPhoto(file);
      setSubmitError(null);

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removePhoto = () => {
    setPhoto(null);
    setPhotoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!photo) {
      setSubmitError('Please attach or capture a photo of the defect.');
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
      formData.append('description', description.trim());
      if (repairId.trim()) {
        formData.append('repair_id', repairId.trim());
      }
      if (location) {
        formData.append('latitude', location.lat.toString());
        formData.append('longitude', location.lng.toString());
      }

      const res = await fetch('/api/complaints', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Failed to submit complaint. Please try again.');
      }

      const result = await res.json();
      setSubmittedData(result);
    } catch (err: any) {
      console.error('Error submitting complaint:', err);
      setSubmitError(err.message || 'An unexpected error occurred while submitting.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setPhoto(null);
    setPhotoPreview(null);
    setDescription('');
    setSubmittedData(null);
    setSubmitError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    captureLocation();
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4 sm:p-6 text-slate-800">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        
        {/* Top Header Banner */}
        <div className="bg-slate-900 text-white p-6 sm:p-8">
          <div className="inline-flex items-center gap-2 bg-orange-500/20 text-orange-400 border border-orange-500/30 px-3 py-1 rounded-full text-xs font-semibold tracking-wider uppercase mb-3">
            <span className="material-symbols-outlined text-[16px]">assured_workload</span>
            NMC Public Grievance
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white m-0 mb-2">
            Report Road or Infrastructure Defect
          </h1>
          <p className="text-slate-300 text-xs sm:text-sm m-0 leading-relaxed">
            Nagpur Municipal Corporation Civic Quality Assurance Portal. Submit evidence directly for automated audit tracking.
          </p>

          {repairId && (
            <div className="mt-4 inline-flex items-center gap-2 bg-white/10 text-white border border-white/20 px-3 py-1.5 rounded-lg text-xs font-mono">
              <span className="material-symbols-outlined text-[16px] text-orange-400">link</span>
              Linked to Repair #{repairId}
            </div>
          )}
        </div>

        {/* Form Body or Success State */}
        <div className="p-6 sm:p-8">
          {submittedData ? (
            /* Success Screen */
            <div className="flex flex-col items-center text-center py-6">
              <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mb-4 border border-emerald-200">
                <CheckCircle className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">
                Report Submitted Successfully
              </h2>
              <p className="text-sm text-slate-600 mb-6 max-w-sm">
                {submittedData.repair_id ? (
                  <>Your report has been submitted and linked to <strong>Repair #{submittedData.repair_id}</strong>.</>
                ) : (
                  <>Your report has been logged in the citizen grievance registry.</>
                )}
              </p>

              {/* Submission Summary Card */}
              <div className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6 text-left text-xs text-slate-700 flex flex-col gap-2.5">
                <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                  <span className="text-slate-500 font-medium">Status</span>
                  <span className="bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded uppercase tracking-wide">
                    {submittedData.status || 'Submitted'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Report Reference ID</span>
                  <span className="font-mono font-semibold text-slate-900">{submittedData.id}</span>
                </div>
                {submittedData.repair_id && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Linked Repair</span>
                    <span className="font-mono font-semibold text-slate-900">{submittedData.repair_id}</span>
                  </div>
                )}
                {submittedData.latitude && submittedData.longitude && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">GPS Location</span>
                    <span className="font-mono text-slate-900">{submittedData.latitude.toFixed(4)}, {submittedData.longitude.toFixed(4)}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-slate-200">
                  <span className="text-slate-500 font-medium block mb-1">Description</span>
                  <p className="text-slate-800 m-0 italic font-normal">{submittedData.description}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={resetForm}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3 px-4 rounded-xl transition-all cursor-pointer text-sm"
              >
                Submit Another Report
              </button>
            </div>
          ) : (
            /* Complaint Submission Form */
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              
              {/* Error Banner */}
              {submitError && (
                <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 p-3.5 rounded-xl text-xs font-medium">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{submitError}</span>
                </div>
              )}

              {/* Photo Upload Area */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
                  Photo Evidence <span className="text-red-500">*</span>
                </label>

                {photoPreview ? (
                  <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-100 max-h-64 flex items-center justify-center">
                    <img src={photoPreview} alt="Evidence Preview" className="w-full max-h-64 object-contain" />
                    <button
                      type="button"
                      onClick={removePhoto}
                      className="absolute top-2 right-2 bg-slate-900/80 hover:bg-slate-900 text-white p-1.5 rounded-full backdrop-blur transition-all cursor-pointer"
                      title="Remove photo"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleFileChange}
                      className="hidden"
                      id="complaint-photo-input"
                    />
                    <label
                      htmlFor="complaint-photo-input"
                      className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-slate-300 hover:border-orange-500 bg-slate-50 hover:bg-orange-50/30 rounded-xl cursor-pointer transition-all text-center"
                    >
                      <div className="w-12 h-12 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center">
                        <Camera className="w-6 h-6" />
                      </div>
                      <span className="text-sm font-semibold text-slate-800">
                        Take Photo or Upload Image
                      </span>
                      <span className="text-xs text-slate-500">
                        Camera capture supported on mobile devices
                      </span>
                    </label>
                  </div>
                )}
              </div>

              {/* Description Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
                  Description of Issue <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the road condition or defect (e.g. deep pothole, open utility trench, asphalt crumbling, improper resurfacing)..."
                  className="w-full p-3.5 text-sm bg-white border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all resize-none"
                  required
                />
                <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                  <span>Minimum 5 characters</span>
                  <span>{description.trim().length} chars</span>
                </div>
              </div>

              {/* Linked Repair ID (Optional manual / read-only) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                  Road Repair Reference ID <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={repairId}
                  onChange={(e) => setRepairId(e.target.value)}
                  placeholder="e.g. RR-2026-001"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                />
              </div>

              {/* Auto GPS Location Status */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <MapPin className={`w-4 h-4 shrink-0 ${location ? 'text-emerald-600' : 'text-slate-400'}`} />
                  <div className="truncate">
                    {gpsStatus === 'locating' ? (
                      <span className="text-slate-500 font-medium">Detecting GPS location...</span>
                    ) : location ? (
                      <span className="text-slate-700 font-mono font-medium">
                        GPS: {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                      </span>
                    ) : (
                      <span className="text-slate-500">Location not captured</span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={captureLocation}
                  disabled={gpsStatus === 'locating'}
                  className="text-xs font-semibold text-orange-600 hover:text-orange-700 cursor-pointer flex items-center gap-1 shrink-0 ml-2"
                >
                  <RefreshCw className={`w-3 h-3 ${gpsStatus === 'locating' ? 'animate-spin' : ''}`} />
                  {location ? 'Refresh GPS' : 'Enable GPS'}
                </button>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting || !photo || description.trim().length < 5}
                className="w-full mt-2 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-300 text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm active:scale-[0.99] cursor-pointer disabled:cursor-not-allowed text-sm"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Submitting Report...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Submit Public Report
                  </>
                )}
              </button>

              <div className="flex items-center justify-center gap-1.5 text-center text-[11px] text-slate-400 mt-1">
                <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                AuditChain Nagpur • Public Citizen Engagement
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
