import React, { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { AlertCircle, Loader2, UserPlus, Trash2 } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { findPotentialDuplicates } from "@/lib/clientDuplicates";
import { ensureFounderOrganization } from "@/lib/profileFounderOrganization";

// Shared JavaScript UI primitives expose incomplete inferred props under
// checkJs. Keep this release's security-state typing independent of those
// pre-existing declaration gaps.
const QuickInput = /** @type {React.ComponentType<any>} */ (Input);
const QuickButton = /** @type {React.ComponentType<any>} */ (Button);

const EMPTY_FORM_DATA = Object.freeze({
  full_name: "",
  email: "",
  date_of_birth: "",
  gender: "",
  gender_other: "",
  apss_q1_heart_stroke: null,
  apss_q2_chest_pain: null,
  apss_q3_faint_dizzy: null,
  apss_q4_asthma: null,
  apss_q5_diabetes_control: null,
  apss_q6_other_conditions: null,
});

const EMPTY_CONSENTS = Object.freeze({
  primary: false,
  privacy: false,
  assessment: false,
  pricing: false,
  cancellation: false,
});

const CONSENT_ITEMS = [
  { showKey: "show_primary_consent", textKey: "consent_primary_text", key: "primary", label: "Primary Consent for Assessment and Treatment" },
  { showKey: "show_privacy_consent", textKey: "consent_privacy_text", key: "privacy", label: "Privacy and Data Storage Consent" },
  { showKey: "show_assessment_consent", textKey: "consent_assessment_text", key: "assessment", label: "Assessment and Testing Consent" },
  { showKey: "show_pricing_consent", textKey: "consent_pricing_text", key: "pricing", label: "Pricing Schedule Agreement" },
  { showKey: "show_cancellation_policy", textKey: "cancellation_policy_text", key: "cancellation", label: "Cancellation Policy" },
];

function activePolicyItems(policy) {
  return policy ? CONSENT_ITEMS.filter((item) => policy[item.showKey] !== false) : [];
}

function policyContractKey(policy) {
  if (!policy) return '';
  return JSON.stringify({
    id: policy.id || null,
    policy_name: policy.policy_name || null,
    version_label: policy.version_label || null,
    effective_date: policy.effective_date || null,
    items: activePolicyItems(policy).map((item) => ({
      label: item.label,
      text: policy[item.textKey],
    })),
  });
}

export default function QuickOnboardModal({ isOpen, onClose, onClientCreated }) {
  const [formData, setFormData] = useState(/** @type {Record<string, any>} */ ({ ...EMPTY_FORM_DATA }));
  const [consents, setConsents] = useState(/** @type {Record<string, boolean>} */ ({ ...EMPTY_CONSENTS }));
  const [activePolicy, setActivePolicy] = useState(/** @type {Record<string, any> | null} */ (null));
  const [policyOrgId, setPolicyOrgId] = useState(/** @type {string | null} */ (null));
  const [isPolicyLoading, setIsPolicyLoading] = useState(false);
  const [errors, setErrors] = useState(/** @type {Record<string, any>} */ ({}));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef(null);
  const signatureHasInkRef = useRef(false);
  const [hasSignature, setHasSignature] = useState(false);

  const resetQuickOnboardState = () => {
    setFormData({ ...EMPTY_FORM_DATA });
    setConsents({ ...EMPTY_CONSENTS });
    setActivePolicy(null);
    setPolicyOrgId(null);
    setErrors({});
    setIsDrawing(false);
    setHasSignature(false);
    signatureHasInkRef.current = false;
  };

  useEffect(() => {
    if (!isOpen) resetQuickOnboardState();
  }, [isOpen]);

  // Standard wording removed at Max's direction 13 July 2026 — clinician supplies own policy text; pro-forma policies may ship later.
  useEffect(() => {
    const loadPolicy = async () => {
      setIsPolicyLoading(true);
      setActivePolicy(null);
      setPolicyOrgId(null);
      try {
        const user = await base44.auth.me();
        const mems = await base44.entities.OrganizationMember.filter({ user_email: user.email }).catch(() => []);
        const primary = (mems || []).find(m => m.is_primary) || (mems || [])[0];
        const orgId = primary?.org_id;
        if (orgId) {
          const active = await base44.entities.ClinicPolicy.filter({
            org_id: orgId,
            is_active: true,
          }).catch(() => []);
          if (active.length > 0) {
            const policy = active.sort((a, b) => new Date(b.created_date).getTime() - new Date(a.created_date).getTime())[0];
            setPolicyOrgId(orgId);
            setActivePolicy(policy);
            return;
          }
        }
        setActivePolicy(null);
      } catch {
        setActivePolicy(null);
      } finally {
        setIsPolicyLoading(false);
      }
    };
    if (isOpen) void loadPolicy();
  }, [isOpen]);

  const visibleConsentItems = activePolicyItems(activePolicy);
  const policyReady = Boolean(
    activePolicy &&
    activePolicy.is_active === true &&
    visibleConsentItems.length > 0 &&
    visibleConsentItems.every(
      (item) => typeof activePolicy[item.textKey] === 'string' && activePolicy[item.textKey].trim(),
    ),
  );

  useEffect(() => {
    if (!isOpen || !policyReady || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    signatureHasInkRef.current = false;
    setHasSignature(false);
  }, [isOpen, policyReady, activePolicy]);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const getEventCoordinates = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Handle both mouse and touch events
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const coords = getEventCoordinates(e);
    
    setIsDrawing(true);
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const coords = getEventCoordinates(e);
    
    ctx.lineTo(coords.x, coords.y);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();
    signatureHasInkRef.current = true;
    setHasSignature(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    signatureHasInkRef.current = false;
    setHasSignature(false);
    if (errors.signature) {
      setErrors((prev) => ({ ...prev, signature: "" }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.full_name.trim()) newErrors.full_name = "Full name is required";
    if (!formData.date_of_birth) newErrors.date_of_birth = "Date of birth is required";
    if (!formData.gender) newErrors.gender = "Gender is required";
    if (formData.gender === "other" && !formData.gender_other.trim()) {
      newErrors.gender_other = "Please specify gender";
    }
    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }
    if (!policyReady) newErrors.policy = "Patient consent is not configured for this practice";
    const visibleKeys = visibleConsentItems.map(i => i.key);
    if (visibleKeys.some(k => !consents[k])) {
      newErrors.consents = "All consent checkboxes must be checked";
    }
    if (!hasSignature || !signatureHasInkRef.current) {
      newErrors.signature = "Client signature is required to proceed";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) {
      toast.error("Please correct the errors in the form.");
      return;
    }

    setIsSubmitting(true);
    try {
      // Get current user first
      const currentUser = await base44.auth.me();

      // Re-resolve the exact destination practice and its policy immediately
      // before capture. A membership or policy change invalidates the visible
      // consent and signature instead of silently rebinding them.
      let orgId = null;
      try {
        let memberships = await base44.entities.OrganizationMember.filter({ user_email: currentUser.email }).catch(() => []);
        if (!memberships) memberships = [];
        if (memberships.length === 0 && !policyOrgId) {
          // Retain the founder recovery path for an account that reaches this
          // workflow before organisation creation. The policy gate above will
          // still prevent any client/consent write until that new practice has
          // an active, operative policy.
          const defaultName = `${currentUser.full_name || currentUser.email}'s Clinic`.slice(0, 160);
          const newOrg = await ensureFounderOrganization({ clinicName: defaultName });
          orgId = newOrg.id;
        } else {
          const primaryMembership = memberships.find(m => m.is_primary) || memberships[0];
          orgId = primaryMembership?.org_id || null;
        }
      } catch (orgError) {
        console.error("Error checking organization:", orgError);
        toast.error("Failed to verify organization. Please try again.");
        return;
      }

      if (!orgId || orgId !== policyOrgId) {
        setConsents({ ...EMPTY_CONSENTS });
        clearSignature();
        setErrors((current) => ({
          ...current,
          policy: 'The destination practice changed. Reopen quick onboarding and obtain consent again.',
        }));
        toast.error('The destination practice changed. No client was created.');
        return;
      }

      const active = await base44.entities.ClinicPolicy.filter({
        org_id: orgId,
        is_active: true,
      });
      const currentPolicy = [...(active || [])]
        .sort((a, b) => new Date(b.created_date).getTime() - new Date(a.created_date).getTime())[0] || null;
      if (!currentPolicy || policyContractKey(currentPolicy) !== policyContractKey(activePolicy)) {
        setActivePolicy(currentPolicy);
        setConsents({ ...EMPTY_CONSENTS });
        clearSignature();
        setErrors((current) => ({
          ...current,
          policy: 'The active patient-consent policy changed. Review it and obtain a new signature.',
        }));
        toast.error('The patient-consent policy changed. No client was created.');
        return;
      }

      if (!signatureHasInkRef.current || !canvasRef.current) {
        setErrors((current) => ({ ...current, signature: 'Client signature is required to proceed' }));
        return;
      }
      const signatureData = canvasRef.current.toDataURL('image/png');
      const signedAt = new Date().toISOString();

      const clientData = {
        org_id: orgId,
        full_name: formData.full_name,
        date_of_birth: formData.date_of_birth,
        gender: formData.gender,
        gender_other: formData.gender === "other" ? formData.gender_other : null,
        email: formData.email.trim() || null,
        assigned_clinician_email: currentUser.email,
        consent_confirmed: visibleConsentItems.some(item => item.key === 'primary') && consents.primary === true,
        privacy_consent: visibleConsentItems.some(item => item.key === 'privacy') && consents.privacy === true,
        assessment_consent: visibleConsentItems.some(item => item.key === 'assessment') && consents.assessment === true,
        pricing_explained: visibleConsentItems.some(item => item.key === 'pricing') && consents.pricing === true,
        cancellation_policy_agreed: visibleConsentItems.some(item => item.key === 'cancellation') && consents.cancellation === true,
        consent_date: signedAt,
        digital_signature: signatureData,
        signed_policy_id: currentPolicy.id,
        signed_policy_name: currentPolicy.policy_name,
        signed_policy_version: currentPolicy.version_label,
        signed_policy_date: signedAt,
        signed_policy_snapshot: {
          policy_id: currentPolicy.id,
          policy_name: currentPolicy.policy_name,
          version_label: currentPolicy.version_label,
          effective_date: currentPolicy.effective_date,
          items_shown: visibleConsentItems.map(item => item.label),
          texts: Object.fromEntries(visibleConsentItems.map(item => [item.key, currentPolicy[item.textKey]])),
        },
        apss_q1_heart_stroke: formData.apss_q1_heart_stroke,
        apss_q2_chest_pain: formData.apss_q2_chest_pain,
        apss_q3_faint_dizzy: formData.apss_q3_faint_dizzy,
        apss_q4_asthma: formData.apss_q4_asthma,
        apss_q5_diabetes_control: formData.apss_q5_diabetes_control,
        apss_q6_other_conditions: formData.apss_q6_other_conditions,
        apss_completed: (formData.apss_q1_heart_stroke !== null && 
                        formData.apss_q2_chest_pain !== null && 
                        formData.apss_q3_faint_dizzy !== null && 
                        formData.apss_q4_asthma !== null && 
                        formData.apss_q5_diabetes_control !== null && 
                        formData.apss_q6_other_conditions !== null),
        apss_completion_date: (formData.apss_q1_heart_stroke !== null && 
                               formData.apss_q2_chest_pain !== null && 
                               formData.apss_q3_faint_dizzy !== null && 
                               formData.apss_q4_asthma !== null && 
                               formData.apss_q5_diabetes_control !== null && 
                               formData.apss_q6_other_conditions !== null) ? new Date().toISOString() : null,
      };

      // Check for existing client with same email if provided
      if (clientData.email) {
        const existingClients = await base44.entities.Client.filter({ email: clientData.email }).catch(() => []);
        if (existingClients && existingClients.length > 0) {
          toast.error(`A client with email "${clientData.email}" already exists.`);
          setIsSubmitting(false);
          return;
        }
      }

      // Advisory duplicate check (name + date of birth) against the org's existing clients.
      const orgClients = await base44.entities.Client.filter({ org_id: orgId }).catch(() => []);
      const potentialDuplicates = findPotentialDuplicates(clientData, orgClients);
      if (potentialDuplicates.length > 0) {
        const names = potentialDuplicates.map((c) => c.full_name).filter(Boolean).join(", ");
        const proceed = window.confirm(
          `A client with a matching name and date of birth already exists (${names || "unknown name"}). Continue and create a new client anyway?`
        );
        if (!proceed) {
          setIsSubmitting(false);
          return;
        }
      }

      const newClient = await base44.entities.Client.create(clientData);
      
      toast.success("Client quickly onboarded! Redirecting to profile...");
      onClientCreated(newClient.id);
      resetQuickOnboardState();
      onClose();
    } catch (error) {
      console.error("Failed to quick onboard client:", error);
      const errorMsg = error?.message || error?.toString() || "Unknown error";
      toast.error(`Failed to onboard: ${errorMsg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    resetQuickOnboardState();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader className="pb-4">
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" /> Quick Client Onboarding
          </DialogTitle>
          <p className="text-sm text-slate-600 mt-2">
            For walk-in clients - capture essential info to start testing immediately. Complete full onboarding later.
          </p>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <Label htmlFor="full_name">Full Name *</Label>
            <QuickInput
              id="full_name"
              value={formData.full_name}
              onChange={(e) => handleChange("full_name", e.target.value)}
              placeholder="Client's full name"
              className={errors.full_name ? "border-red-500" : ""}
            />
            {errors.full_name && <p className="text-red-500 text-sm mt-1">{errors.full_name}</p>}
          </div>

          <div>
            <Label htmlFor="email">Email (Optional)</Label>
            <QuickInput
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleChange("email", e.target.value)}
              placeholder="Client's email address"
              className={errors.email ? "border-red-500" : ""}
            />
            {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
            <p className="text-xs text-slate-500 mt-1">Can be added later if not available now</p>
          </div>

          <div>
            <Label htmlFor="date_of_birth">Date of Birth *</Label>
            <QuickInput
              id="date_of_birth"
              type="date"
              value={formData.date_of_birth}
              onChange={(e) => handleChange("date_of_birth", e.target.value)}
              className={errors.date_of_birth ? "border-red-500" : ""}
            />
            {errors.date_of_birth && <p className="text-red-500 text-sm mt-1">{errors.date_of_birth}</p>}
          </div>

          <div>
            <Label htmlFor="gender">Gender *</Label>
            <Select value={formData.gender} onValueChange={(value) => handleChange("gender", value)}>
              <SelectTrigger className={errors.gender ? "border-red-500" : ""}>
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="other">Other</SelectItem>
                <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
              </SelectContent>
            </Select>
            {errors.gender && <p className="text-red-500 text-sm mt-1">{errors.gender}</p>}
          </div>

          {formData.gender === "other" && (
            <div>
              <Label htmlFor="gender_other">Please specify *</Label>
              <QuickInput
                id="gender_other"
                value={formData.gender_other}
                onChange={(e) => handleChange("gender_other", e.target.value)}
                placeholder="Specify gender"
                className={errors.gender_other ? "border-red-500" : ""}
              />
              {errors.gender_other && <p className="text-red-500 text-sm mt-1">{errors.gender_other}</p>}
            </div>
          )}

          <div className="space-y-4 mt-6 bg-slate-50 border border-slate-200 rounded-lg p-4">
            <h3 className="font-semibold text-slate-900 text-base">Safety Screen - Adult Pre-Exercise Screening (APSS)</h3>
            <p className="text-xs text-slate-600">If you answer YES to any of the following, medical clearance from your doctor may be required before commencing exercise</p>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">1. Has your doctor ever told you that you have a heart condition, or have you ever suffered a stroke?</Label>
                <RadioGroup value={formData.apss_q1_heart_stroke?.toString()} onValueChange={(v) => handleChange("apss_q1_heart_stroke", v === "true")}>
                  <div className="flex gap-6">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="true" id="q1_yes" />
                      <Label htmlFor="q1_yes" className="font-normal">Yes</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="false" id="q1_no" />
                      <Label htmlFor="q1_no" className="font-normal">No</Label>
                    </div>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">2. Do you ever experience unexplained pains or discomfort in your chest at rest or during physical activity/exercise?</Label>
                <RadioGroup value={formData.apss_q2_chest_pain?.toString()} onValueChange={(v) => handleChange("apss_q2_chest_pain", v === "true")}>
                  <div className="flex gap-6">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="true" id="q2_yes" />
                      <Label htmlFor="q2_yes" className="font-normal">Yes</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="false" id="q2_no" />
                      <Label htmlFor="q2_no" className="font-normal">No</Label>
                    </div>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">3. Do you ever feel faint, dizzy, or lose balance during physical activity/exercise?</Label>
                <RadioGroup value={formData.apss_q3_faint_dizzy?.toString()} onValueChange={(v) => handleChange("apss_q3_faint_dizzy", v === "true")}>
                  <div className="flex gap-6">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="true" id="q3_yes" />
                      <Label htmlFor="q3_yes" className="font-normal">Yes</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="false" id="q3_no" />
                      <Label htmlFor="q3_no" className="font-normal">No</Label>
                    </div>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">4. Have you had an asthma attack requiring immediate medical attention at any time over the last 12 months?</Label>
                <RadioGroup value={formData.apss_q4_asthma?.toString()} onValueChange={(v) => handleChange("apss_q4_asthma", v === "true")}>
                  <div className="flex gap-6">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="true" id="q4_yes" />
                      <Label htmlFor="q4_yes" className="font-normal">Yes</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="false" id="q4_no" />
                      <Label htmlFor="q4_no" className="font-normal">No</Label>
                    </div>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">5. If you have diabetes (type 1 or type 2), have you had trouble controlling your blood sugar (hypo/hyperglycaemia) in the last 3 months?</Label>
                <RadioGroup value={formData.apss_q5_diabetes_control?.toString()} onValueChange={(v) => handleChange("apss_q5_diabetes_control", v === "true")}>
                  <div className="flex gap-6">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="true" id="q5_yes" />
                      <Label htmlFor="q5_yes" className="font-normal">Yes</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="false" id="q5_no" />
                      <Label htmlFor="q5_no" className="font-normal">No</Label>
                    </div>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">6. Do you have any other condition(s) that may make it dangerous for you to participate in physical activity/exercise?</Label>
                <RadioGroup value={formData.apss_q6_other_conditions?.toString()} onValueChange={(v) => handleChange("apss_q6_other_conditions", v === "true")}>
                  <div className="flex gap-6">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="true" id="q6_yes" />
                      <Label htmlFor="q6_yes" className="font-normal">Yes</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="false" id="q6_no" />
                      <Label htmlFor="q6_no" className="font-normal">No</Label>
                    </div>
                  </div>
                </RadioGroup>
              </div>
            </div>
          </div>

          <div className="space-y-4 mt-6">
            <h3 className="font-semibold text-slate-900 text-base">Consent & Confirmation</h3>
            
            <div className="space-y-4">
              {isPolicyLoading ? (
                <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Loading consent policy...</div>
              ) : !policyReady ? (
                <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-800">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p className="text-sm">A practice owner must activate a policy with operative wording before quick onboarding can be completed.</p>
                </div>
              ) : visibleConsentItems.map(item => (
                <div key={item.key} className="flex items-start space-x-3">
                  <Checkbox
                    id={`consent_${item.key}`}
                    checked={!!consents[item.key]}
                    onCheckedChange={(checked) => setConsents(prev => ({ ...prev, [item.key]: checked }))}
                  />
                  <div className="flex-1">
                    <label htmlFor={`consent_${item.key}`} className="text-sm font-semibold text-slate-900 cursor-pointer">
                      {item.label}
                    </label>
                    {activePolicy[item.textKey]?.trim() ? (
                      <p className="text-xs text-slate-600 mt-1">
                        {activePolicy[item.textKey]}
                      </p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>

            {errors.consents && <p className="text-red-500 text-sm mt-2">{errors.consents}</p>}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
            <Label className="text-sm font-semibold mb-2 block">
              Client Signature *
            </Label>
            <p className="text-xs text-slate-600 mb-3">
              By signing below, I confirm that I have read and agree to all the consent statements and policies above.
            </p>
            
            <div className="relative">
              <canvas
                ref={canvasRef}
                width={400}
                height={150}
                className={`border-2 rounded bg-white cursor-crosshair w-full ${errors.signature ? 'border-red-500' : 'border-slate-300'}`}
                style={{ touchAction: 'none' }}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />
              <QuickButton
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearSignature}
                className="absolute top-2 right-2 bg-white hover:bg-slate-100"
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Clear
              </QuickButton>
            </div>
            
            {errors.signature && <p className="text-red-500 text-sm mt-2">{errors.signature}</p>}
          </div>

          <DialogFooter className="mt-6 gap-2 pt-4">
            <QuickButton type="button" variant="outline" onClick={handleClose}>
              Cancel
            </QuickButton>
            <QuickButton type="submit" disabled={isSubmitting || isPolicyLoading || !policyReady}>
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <UserPlus className="w-4 h-4 mr-2" />
              )}
              Quick Onboard & Start Testing
            </QuickButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
