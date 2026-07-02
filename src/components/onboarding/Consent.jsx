import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CheckCircle, Loader2, PenTool, RotateCcw, FileText, AlertCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";

const DEFAULT_POLICY = {
  show_primary_consent: true,
  show_privacy_consent: true,
  show_assessment_consent: true,
  show_pricing_consent: true,
  show_cancellation_policy: true,
  consent_primary_text: "I consent to receive clinical assessment and treatment services. I understand that this may involve physical examination, movement assessment, and therapeutic interventions.",
  consent_privacy_text: "I consent to the collection, storage, and use of my personal health information for the purpose of providing clinical services and maintaining medical records in accordance with privacy regulations.",
  consent_assessment_text: "I consent to participate in various physical and psychological assessment tests as recommended by my clinician. I understand the purpose, risks, and benefits of these assessments.",
  consent_pricing_text: "I confirm that the pricing schedule for services has been explained to me and I agree to the stated fees and payment terms.",
  cancellation_policy_text: "I understand that appointments cancelled with less than 24 hours notice may incur a cancellation fee. I agree to provide adequate notice when cancelling or rescheduling appointments.",
  policy_name: "Default Policy",
  version_label: "v1.0"
};

const CONSENT_ITEMS = [
  { showKey: "show_primary_consent", textKey: "consent_primary_text", formKey: "consent_confirmed", label: "Primary Consent for Assessment and Treatment" },
  { showKey: "show_privacy_consent", textKey: "consent_privacy_text", formKey: "privacy_consent", label: "Privacy and Data Storage Consent" },
  { showKey: "show_assessment_consent", textKey: "consent_assessment_text", formKey: "assessment_consent", label: "Assessment and Testing Consent" },
  { showKey: "show_pricing_consent", textKey: "consent_pricing_text", formKey: "pricing_explained", label: "Pricing Schedule Agreement" },
  { showKey: "show_cancellation_policy", textKey: "cancellation_policy_text", formKey: "cancellation_policy_agreed", label: "Cancellation Policy" },
];

export default function Consent({ data, onNext, onBack, canGoBack, isSubmitting, onSaveAndFinishLater }) {
  const [formData, setFormData] = useState({
    consent_confirmed: data.consent_confirmed || false,
    privacy_consent: data.privacy_consent || false,
    assessment_consent: data.assessment_consent || false,
    pricing_explained: data.pricing_explained || false,
    cancellation_policy_agreed: data.cancellation_policy_agreed || false,
    digital_signature: data.digital_signature || ""
  });

  const [activePolicy, setActivePolicy] = useState(null);
  const [loadingPolicy, setLoadingPolicy] = useState(true);
  const [errors, setErrors] = useState({});
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef(null);
  const [hasSignature, setHasSignature] = useState(!!data.digital_signature);
  const [signatureLocked, setSignatureLocked] = useState(!!data.digital_signature);

  // Re-sync when parent data prop updates (e.g. after Onboarding.jsx loads client from DB)
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      consent_confirmed: data.consent_confirmed || false,
      privacy_consent: data.privacy_consent || false,
      assessment_consent: data.assessment_consent || false,
      pricing_explained: data.pricing_explained || false,
      cancellation_policy_agreed: data.cancellation_policy_agreed || false,
      digital_signature: data.digital_signature || prev.digital_signature || "",
    }));
    if (data.digital_signature) {
      setHasSignature(true);
      setSignatureLocked(true);
    }
  }, [
    data.consent_confirmed,
    data.privacy_consent,
    data.assessment_consent,
    data.pricing_explained,
    data.cancellation_policy_agreed,
    data.digital_signature
  ]);

  useEffect(() => { loadActivePolicy(); }, []);

  const loadActivePolicy = async () => {
    setLoadingPolicy(true);
    try {
      const user = await base44.auth.me();
      // Resolve org_id via OrganizationMember (works for all roles)
      let orgId = null;
      try {
        const mems = await base44.entities.OrganizationMember.filter({ user_email: user.email });
        const primary = (mems || []).find(m => m.is_primary) || (mems || [])[0];
        orgId = primary?.org_id;
      } catch {}

      if (orgId) {
        const all = await base44.entities.ClinicPolicy.list().catch(() => []);
        const active = (all || []).filter(p => p.org_id === orgId && p.is_active === true);
        if (active.length > 0) {
          const sorted = active.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
          setActivePolicy(sorted[0]);
          setLoadingPolicy(false);
          return;
        }
      }
      setActivePolicy(DEFAULT_POLICY);
    } catch (error) {
      console.error("Error loading policy:", error);
      setActivePolicy(DEFAULT_POLICY);
    }
    setLoadingPolicy(false);
  };

  const visibleItems = activePolicy ? CONSENT_ITEMS.filter(item => activePolicy[item.showKey] !== false) : CONSENT_ITEMS;

  const handleSubmit = (e) => {
    e.preventDefault();
    const policySnapshot = activePolicy ? {
      policy_id: activePolicy.id || null,
      policy_name: activePolicy.policy_name,
      version_label: activePolicy.version_label,
      effective_date: activePolicy.effective_date,
      items_shown: visibleItems.map(i => i.label),
      texts: Object.fromEntries(visibleItems.map(i => [i.formKey, activePolicy[i.textKey]]))
    } : null;
    onNext({
      ...formData,
      signed_policy_id: activePolicy?.id || null,
      signed_policy_name: activePolicy?.policy_name || null,
      signed_policy_version: activePolicy?.version_label || null,
      signed_policy_date: new Date().toISOString(),
      signed_policy_snapshot: policySnapshot
    });
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: "" }));
  };

  const startDrawing = (e) => {
    if (signatureLocked) return;
    setIsDrawing(true);
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo((e.clientX || e.touches?.[0]?.clientX) - rect.left, (e.clientY || e.touches?.[0]?.clientY) - rect.top);
  };

  const draw = (e) => {
    if (!isDrawing || signatureLocked) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1e293b';
    ctx.lineTo((e.clientX || e.touches?.[0]?.clientX) - rect.left, (e.clientY || e.touches?.[0]?.clientY) - rect.top);
    ctx.stroke();
  };

  const stopDrawing = async () => {
    if (isDrawing) {
      setIsDrawing(false);
      const canvas = canvasRef.current;
      const signatureData = canvas.toDataURL();
      const updatedData = { ...formData, digital_signature: signatureData, consent_date: new Date().toISOString() };
      setFormData(updatedData);
      setHasSignature(true);
      if (errors.digital_signature) setErrors(prev => ({ ...prev, digital_signature: "" }));
      if (onSaveAndFinishLater) {
        try { await onSaveAndFinishLater(updatedData, true); }
        catch (e) { console.warn("Auto-save signature failed:", e); }
      }
    }
  };

  const clearSignature = () => {
    if (signatureLocked) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setFormData(prev => ({ ...prev, digital_signature: "" }));
    setHasSignature(false);
  };

  const unlockSignature = () => {
    setSignatureLocked(false);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    setFormData(prev => ({ ...prev, digital_signature: "" }));
    setHasSignature(false);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      if (data.digital_signature) {
        setFormData(prev => ({ ...prev, digital_signature: data.digital_signature }));
        setHasSignature(true);
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0);
        img.src = data.digital_signature;
      }
    }
  }, [data.digital_signature]);

  const allConsentsGiven = visibleItems.every(i => formData[i.formKey]) && hasSignature;

  if (loadingPolicy) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        <span className="ml-2 text-slate-500 text-sm">Loading consent form...</span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {activePolicy && (
        <div className="flex items-center gap-2 p-2.5 bg-blue-50 border border-blue-100 rounded-lg">
          <FileText className="w-4 h-4 text-blue-500 shrink-0" />
          <span className="text-xs text-blue-700">
            <span className="font-semibold">{activePolicy.policy_name}</span>
            {activePolicy.version_label && <Badge className="ml-2 bg-blue-100 text-blue-700 text-xs">{activePolicy.version_label}</Badge>}
            {activePolicy.effective_date && <span className="ml-1 text-blue-500"> Â· Effective {activePolicy.effective_date}</span>}
          </span>
        </div>
      )}

      <div className="space-y-4">
        {visibleItems.map((item) => (
          <Card key={item.formKey} className={`border ${formData[item.formKey] ? 'border-green-200 bg-green-50/30' : 'border-slate-200'}`}>
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <Checkbox
                  id={item.formKey}
                  checked={formData[item.formKey]}
                  onCheckedChange={(checked) => handleChange(item.formKey, checked)}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <Label htmlFor={item.formKey} className="font-semibold text-slate-900 cursor-pointer">{item.label}</Label>
                  <p className="text-sm text-slate-600 mt-1">{activePolicy?.[item.textKey]}</p>
                </div>
                {formData[item.formKey] && <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-2 border-slate-200">
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-slate-700">
                Digital Signature *
              </Label>
              {hasSignature && (
                <Button type="button" variant="outline" size="sm" onClick={unlockSignature}>
                  <RotateCcw className="w-4 h-4 mr-1" /> Clear & Re-sign
                </Button>
              )}
            </div>

            {hasSignature && formData.digital_signature ? (
              <div className="border-2 border-green-300 bg-green-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <p className="text-sm font-medium text-green-700">Signature already provided</p>
                </div>
                <img
                  src={formData.digital_signature}
                  alt="Client signature"
                  className="border border-slate-200 rounded bg-white max-h-24 w-auto"
                />
              </div>
            ) : (
              <div className="border-2 border-dashed border-slate-300 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <PenTool className="w-4 h-4 text-slate-500" />
                  <p className="text-sm text-slate-600">Sign below using your finger or stylus</p>
                </div>
                <canvas
                  ref={canvasRef}
                  width={600}
                  height={200}
                  className="border border-slate-300 rounded bg-white cursor-crosshair touch-none w-full block"
                  style={{ touchAction: 'none' }}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    const touch = e.touches[0];
                    const canvas = canvasRef.current;
                    const rect = canvas.getBoundingClientRect();
                    const ctx = canvas.getContext('2d');
                    setIsDrawing(true);
                    ctx.beginPath();
                    ctx.moveTo(touch.clientX - rect.left, touch.clientY - rect.top);
                  }}
                  onTouchMove={(e) => {
                    e.preventDefault();
                    if (!isDrawing) return;
                    const touch = e.touches[0];
                    const canvas = canvasRef.current;
                    const rect = canvas.getBoundingClientRect();
                    const ctx = canvas.getContext('2d');
                    ctx.lineWidth = 2;
                    ctx.lineCap = 'round';
                    ctx.strokeStyle = '#1e293b';
                    ctx.lineTo(touch.clientX - rect.left, touch.clientY - rect.top);
                    ctx.stroke();
                  }}
                  onTouchEnd={async (e) => {
                    e.preventDefault();
                    if (isDrawing) {
                      setIsDrawing(false);
                      const canvas = canvasRef.current;
                      const signatureData = canvas.toDataURL();
                      const updatedData = { ...formData, digital_signature: signatureData, consent_date: new Date().toISOString() };
                      setFormData(updatedData);
                      setHasSignature(true);
                      if (errors.digital_signature) setErrors(prev => ({ ...prev, digital_signature: "" }));
                      if (onSaveAndFinishLater) {
                        try { await onSaveAndFinishLater(updatedData, true); }
                        catch (err) { console.warn("Auto-save signature failed:", err); }
                      }
                    }
                  }}
                />
              </div>
            )}

            {!hasSignature && (
              <Button type="button" variant="outline" size="sm" onClick={clearSignature}>
                <RotateCcw className="w-4 h-4 mr-1" /> Clear
              </Button>
            )}

            {errors.digital_signature && (
              <p className="text-red-500 text-sm">{errors.digital_signature}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {!allConsentsGiven && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
          <p className="text-sm text-amber-700">Please tick all consent items and provide a signature to proceed.</p>
        </div>
      )}

      <div className="flex justify-between pt-2">
        {canGoBack && (
          <Button type="button" variant="outline" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
        )}
        <div className={`flex gap-3 ${!canGoBack ? 'ml-auto' : 'ml-auto'}`}>
          {onSaveAndFinishLater && (
            <Button type="button" variant="outline" onClick={() => onSaveAndFinishLater(formData)} className="text-slate-600" disabled={isSubmitting}>
              Save & Finish Later
            </Button>
          )}
          <Button type="submit" disabled={isSubmitting || !allConsentsGiven} className="bg-green-600 hover:bg-green-700">
            {isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : <><CheckCircle className="w-4 h-4 mr-2" />Complete Onboarding</>}
          </Button>
        </div>
      </div>
    </form>
  );
}