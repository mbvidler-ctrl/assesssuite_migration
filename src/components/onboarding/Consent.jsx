import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CheckCircle, Loader2, PenTool, RotateCcw, FileText, AlertCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";

// Standard wording removed at Max's direction 13 July 2026 — clinician supplies own policy text; pro-forma policies may ship later.
const CONSENT_ITEMS = [
  { showKey: "show_primary_consent", textKey: "consent_primary_text", formKey: "consent_confirmed", quickKey: "primary", label: "Primary Consent for Assessment and Treatment" },
  { showKey: "show_privacy_consent", textKey: "consent_privacy_text", formKey: "privacy_consent", quickKey: "privacy", label: "Privacy and Data Storage Consent" },
  { showKey: "show_assessment_consent", textKey: "consent_assessment_text", formKey: "assessment_consent", quickKey: "assessment", label: "Assessment and Testing Consent" },
  { showKey: "show_pricing_consent", textKey: "consent_pricing_text", formKey: "pricing_explained", quickKey: "pricing", label: "Pricing Schedule Agreement" },
  { showKey: "show_cancellation_policy", textKey: "cancellation_policy_text", formKey: "cancellation_policy_agreed", quickKey: "cancellation", label: "Cancellation Policy" },
];

function activeItems(policy) {
  return policy ? CONSENT_ITEMS.filter((item) => policy[item.showKey] !== false) : [];
}

function policySnapshot(policy, items) {
  if (!policy) return null;
  return {
    policy_id: policy.id || null,
    policy_name: policy.policy_name,
    version_label: policy.version_label,
    effective_date: policy.effective_date,
    items_shown: items.map((item) => item.label),
    texts: Object.fromEntries(items.map((item) => [item.formKey, policy[item.textKey]])),
  };
}

function policyContractKey(policy) {
  if (!policy) return '';
  const items = activeItems(policy);
  return JSON.stringify({
    id: policy.id || null,
    policy_name: policy.policy_name || null,
    version_label: policy.version_label || null,
    effective_date: policy.effective_date || null,
    items: items.map((item) => ({
      label: item.label,
      text: policy[item.textKey],
    })),
  });
}

function signedEvidenceMatchesPolicy(data, policy) {
  if (!policy || !data?.digital_signature || data.signed_policy_id !== policy.id) return false;
  if ((data.signed_policy_version || null) !== (policy.version_label || null)) return false;
  const snapshot = data.signed_policy_snapshot;
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return false;
  const items = activeItems(policy);
  if (snapshot.policy_id !== policy.id) return false;
  if ((snapshot.policy_name || null) !== (policy.policy_name || null)) return false;
  if ((snapshot.version_label || null) !== (policy.version_label || null)) return false;
  if ((snapshot.effective_date || null) !== (policy.effective_date || null)) return false;
  if (JSON.stringify(snapshot.items_shown || []) !== JSON.stringify(items.map((item) => item.label))) return false;
  if (!snapshot.texts || typeof snapshot.texts !== 'object' || Array.isArray(snapshot.texts)) return false;
  return items.every((item) => (
    snapshot.texts[item.formKey] === policy[item.textKey]
    || snapshot.texts[item.quickKey] === policy[item.textKey]
  ));
}

function emptyPolicyEvidence() {
  return {
    signed_policy_id: null,
    signed_policy_name: null,
    signed_policy_version: null,
    signed_policy_date: null,
    signed_policy_snapshot: null,
  };
}

export default function Consent({ data, orgId, onNext, onBack, canGoBack, isSubmitting, onSaveAndFinishLater }) {
  const [formData, setFormData] = useState(/** @type {Record<string, any>} */ ({
    consent_confirmed: false,
    privacy_consent: false,
    assessment_consent: false,
    pricing_explained: false,
    cancellation_policy_agreed: false,
    digital_signature: "",
    ...emptyPolicyEvidence(),
  }));

  const [activePolicy, setActivePolicy] = useState(/** @type {Record<string, any> | null} */ (null));
  const [resolvedPolicyOrgId, setResolvedPolicyOrgId] = useState(/** @type {string | null} */ (null));
  const [loadingPolicy, setLoadingPolicy] = useState(true);
  const [isPolicyVerifying, setIsPolicyVerifying] = useState(false);
  const [errors, setErrors] = useState(/** @type {Record<string, string>} */ ({}));
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef(null);
  const signatureHasInkRef = useRef(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [signatureLocked, setSignatureLocked] = useState(false);

  const loadActivePolicy = async () => {
    setLoadingPolicy(true);
    setActivePolicy(null);
    setResolvedPolicyOrgId(null);
    try {
      const user = await base44.auth.me();
      const memberships = await base44.entities.OrganizationMember.filter({ user_email: user.email });
      const requestedOrgId = typeof orgId === 'string' && orgId ? orgId : null;
      const selectedMembership = requestedOrgId
        ? (memberships || []).find((membership) => membership.org_id === requestedOrgId)
        : ((memberships || []).find((membership) => membership.is_primary) || (memberships || [])[0]);
      const policyOrgId = selectedMembership?.org_id || null;

      if (policyOrgId) {
        const active = await base44.entities.ClinicPolicy.filter({
          org_id: policyOrgId,
          is_active: true,
        }).catch(() => []);
        if (active.length > 0) {
          const sorted = active.sort((a, b) => new Date(b.created_date).getTime() - new Date(a.created_date).getTime());
          setResolvedPolicyOrgId(policyOrgId);
          setActivePolicy(sorted[0]);
          return;
        }
      }
      setActivePolicy(null);
    } catch (error) {
      console.error("Error loading policy:", error);
      setActivePolicy(null);
    } finally {
      setLoadingPolicy(false);
    }
  };

  useEffect(() => { void loadActivePolicy(); }, [orgId]);

  const visibleItems = activeItems(activePolicy);
  const policyReady = Boolean(
    activePolicy &&
    activePolicy.is_active === true &&
    visibleItems.length > 0 &&
    visibleItems.every((item) => typeof activePolicy[item.textKey] === 'string' && activePolicy[item.textKey].trim()),
  );

  // A stored signature applies only to the exact policy content it originally
  // accompanied. A newly active, edited or differently scoped policy forces
  // fresh checkboxes and a fresh signature; the old signature is never rebound.
  useEffect(() => {
    if (!activePolicy) return;
    const evidenceMatches = signedEvidenceMatchesPolicy(data, activePolicy);
    setFormData({
      consent_confirmed: evidenceMatches && data.consent_confirmed === true,
      privacy_consent: evidenceMatches && data.privacy_consent === true,
      assessment_consent: evidenceMatches && data.assessment_consent === true,
      pricing_explained: evidenceMatches && data.pricing_explained === true,
      cancellation_policy_agreed: evidenceMatches && data.cancellation_policy_agreed === true,
      digital_signature: evidenceMatches ? data.digital_signature : "",
      ...(evidenceMatches ? {
        signed_policy_id: data.signed_policy_id,
        signed_policy_name: data.signed_policy_name,
        signed_policy_version: data.signed_policy_version,
        signed_policy_date: data.signed_policy_date,
        signed_policy_snapshot: data.signed_policy_snapshot,
      } : emptyPolicyEvidence()),
    });
    setHasSignature(evidenceMatches);
    setSignatureLocked(evidenceMatches);
    signatureHasInkRef.current = evidenceMatches;
    if (!evidenceMatches && data.digital_signature) {
      setErrors((current) => ({
        ...current,
        policy: 'The active patient-consent policy changed. Review it and obtain a new signature.',
      }));
    }
  }, [
    activePolicy,
    data.consent_confirmed,
    data.privacy_consent,
    data.assessment_consent,
    data.pricing_explained,
    data.cancellation_policy_agreed,
    data.digital_signature,
    data.signed_policy_id,
    data.signed_policy_name,
    data.signed_policy_version,
    data.signed_policy_date,
    data.signed_policy_snapshot,
  ]);

  const invalidateConsentForPolicyChange = (message) => {
    setFormData({
      consent_confirmed: false,
      privacy_consent: false,
      assessment_consent: false,
      pricing_explained: false,
      cancellation_policy_agreed: false,
      digital_signature: "",
      ...emptyPolicyEvidence(),
    });
    setHasSignature(false);
    setSignatureLocked(false);
    signatureHasInkRef.current = false;
    setErrors((current) => ({ ...current, policy: message }));
  };

  const currentPolicyEvidence = (signedAt = new Date().toISOString()) => ({
    signed_policy_id: activePolicy?.id || null,
    signed_policy_name: activePolicy?.policy_name || null,
    signed_policy_version: activePolicy?.version_label || null,
    signed_policy_date: signedAt,
    signed_policy_snapshot: policySnapshot(activePolicy, visibleItems),
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!policyReady) {
      setErrors(prev => ({ ...prev, policy: 'Patient consent is not configured for this practice.' }));
      return;
    }
    if (!visibleItems.every((item) => formData[item.formKey]) || !hasSignature || !signatureHasInkRef.current) {
      setErrors((current) => ({ ...current, digital_signature: 'Review every consent item and provide a signature.' }));
      return;
    }

    setIsPolicyVerifying(true);
    try {
      const user = await base44.auth.me();
      const memberships = await base44.entities.OrganizationMember.filter({ user_email: user.email });
      const requestedOrgId = typeof orgId === 'string' && orgId ? orgId : resolvedPolicyOrgId;
      const selectedMembership = (memberships || []).find((membership) => membership.org_id === requestedOrgId);
      if (!selectedMembership || selectedMembership.org_id !== resolvedPolicyOrgId) {
        invalidateConsentForPolicyChange('The client practice changed. Reload the correct policy and obtain consent again.');
        return;
      }
      const active = await base44.entities.ClinicPolicy.filter({
        org_id: resolvedPolicyOrgId,
        is_active: true,
      });
      const currentPolicy = [...(active || [])]
        .sort((a, b) => new Date(b.created_date).getTime() - new Date(a.created_date).getTime())[0] || null;
      if (!currentPolicy || policyContractKey(currentPolicy) !== policyContractKey(activePolicy)) {
        setActivePolicy(currentPolicy);
        invalidateConsentForPolicyChange('The active patient-consent policy changed. Review it and obtain a new signature.');
        return;
      }
      onNext({
        ...formData,
        ...currentPolicyEvidence(formData.signed_policy_date || new Date().toISOString()),
      });
    } catch (error) {
      console.error('Unable to re-verify patient consent policy', error);
      setErrors((current) => ({
        ...current,
        policy: 'The current patient-consent policy could not be verified. No consent was recorded.',
      }));
    } finally {
      setIsPolicyVerifying(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: "" }));
  };

  const startDrawing = (e) => {
    if (signatureLocked) return;
    signatureHasInkRef.current = false;
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
    signatureHasInkRef.current = true;
  };

  const stopDrawing = async () => {
    if (isDrawing) {
      setIsDrawing(false);
      if (!signatureHasInkRef.current) {
        setErrors((current) => ({ ...current, digital_signature: 'Please draw a signature before continuing.' }));
        return;
      }
      const canvas = canvasRef.current;
      const signatureData = canvas.toDataURL();
      const signedAt = new Date().toISOString();
      const updatedData = {
        ...formData,
        digital_signature: signatureData,
        consent_date: signedAt,
        ...currentPolicyEvidence(signedAt),
      };
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
    signatureHasInkRef.current = false;
    setFormData(prev => ({ ...prev, digital_signature: "", ...emptyPolicyEvidence() }));
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
    signatureHasInkRef.current = false;
    setFormData(prev => ({ ...prev, digital_signature: "", ...emptyPolicyEvidence() }));
    setHasSignature(false);
  };

  const allConsentsGiven = policyReady
    && visibleItems.every(i => formData[i.formKey])
    && hasSignature
    && signatureHasInkRef.current;

  if (loadingPolicy) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        <span className="ml-2 text-slate-500 text-sm">Loading consent form...</span>
      </div>
    );
  }


  if (!policyReady) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-6 space-y-3">
          <div className="flex items-start gap-2 text-amber-800">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Patient consent is not configured</p>
              <p className="text-sm mt-1">A practice owner must activate a policy with operative wording before a client can sign or complete onboarding.</p>
            </div>
          </div>
          {canGoBack && <button type="button" onClick={onBack} className="inline-flex items-center rounded-md border border-amber-300 bg-white px-3 py-2 text-sm text-amber-900"><ArrowLeft className="w-4 h-4 mr-2" /> Back</button>}
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
            {activePolicy.effective_date && <span className="ml-1 text-blue-500"> · Effective {activePolicy.effective_date}</span>}
          </span>
        </div>
      )}

      {errors.policy && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-800">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <p className="text-sm">{errors.policy}</p>
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
                  {activePolicy?.[item.textKey]?.trim() ? (
                    <p className="text-sm text-slate-600 mt-1">{activePolicy[item.textKey]}</p>
                  ) : null}
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
                    signatureHasInkRef.current = false;
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
                    signatureHasInkRef.current = true;
                  }}
                  onTouchEnd={async (e) => {
                    e.preventDefault();
                    if (isDrawing) {
                      setIsDrawing(false);
                      if (!signatureHasInkRef.current) {
                        setErrors((current) => ({ ...current, digital_signature: 'Please draw a signature before continuing.' }));
                        return;
                      }
                      const canvas = canvasRef.current;
                      const signatureData = canvas.toDataURL();
                      const signedAt = new Date().toISOString();
                      const updatedData = {
                        ...formData,
                        digital_signature: signatureData,
                        consent_date: signedAt,
                        ...currentPolicyEvidence(signedAt),
                      };
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
            <Button type="button" variant="outline" onClick={() => onSaveAndFinishLater(formData)} className="text-slate-600" disabled={isSubmitting || isPolicyVerifying}>
              Save & Finish Later
            </Button>
          )}
          <Button type="submit" disabled={isSubmitting || isPolicyVerifying || !allConsentsGiven} className="bg-green-600 hover:bg-green-700">
            {isSubmitting || isPolicyVerifying ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Verifying...</> : <><CheckCircle className="w-4 h-4 mr-2" />Complete Onboarding</>}
          </Button>
        </div>
      </div>
    </form>
  );
}
