import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, CheckCircle, Mail, Copy, Check, UserPlus, Upload } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Toaster, toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

import PersonalInfo from "../components/onboarding/PersonalInfo";
import ContactInfo from "../components/onboarding/ContactInfo";
import FundingInfo from "../components/onboarding/FundingInfo";
import APSSForm from "../components/onboarding/APSSForm";
import APSSStage2 from "../components/onboarding/APSSStage2";
import MedicalHistory from "../components/onboarding/MedicalHistory";
import ClientGoals from "../components/onboarding/ClientGoals";
import Consent from "../components/onboarding/Consent";
import QuickOnboardModal from "../components/onboarding/QuickOnboardModal";
import ReferralUploader from "../components/documents/ReferralUploader";
import { findPotentialDuplicates } from "@/lib/clientDuplicates";
import { todayLocal } from "@/lib/localDate";
import { ensureFounderOrganization } from "@/lib/profileFounderOrganization";

// Local typing bridge for the newly added toggle only; shared UI primitives
// are JavaScript and expose incomplete inferred props under checkJs.
const ReferralToggleButton = /** @type {React.ComponentType<any>} */ (Button);

const steps = [
  { id: 1, title: "Personal Information", component: PersonalInfo, clientCanComplete: true },
  { id: 2, title: "Referral Information", component: ContactInfo, clientCanComplete: true },
  { id: 3, title: "Funding Information", component: FundingInfo, clientCanComplete: false },
  { id: 4, title: "Safety Screen", component: APSSForm, clientCanComplete: false },
  { id: 5, title: "Clinical Risk Review", component: APSSStage2, clientCanComplete: false },
  { id: 6, title: "Medical History", component: MedicalHistory, clientCanComplete: true },
  { id: 7, title: "Client Goals", component: ClientGoals, clientCanComplete: true },
  { id: 8, title: "Consent & Confirmation", component: Consent, clientCanComplete: false },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const clientId = searchParams.get("id");
  const isClientView = searchParams.get("client") === "true";
  const startStep = searchParams.get("step");

  const [currentStep, setCurrentStep] = useState(startStep ? parseInt(startStep, 10) : 1);
  const [formData, setFormData] = useState({
    apss_completed: false,
    consent_confirmed: false,
    privacy_consent: false,
    assessment_consent: false,
    pricing_explained: false,
    client_completed_sections: [],
    medical_conditions: []
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLockRef = useRef(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailContent, setEmailContent] = useState("");
  const [clientLink, setClientLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [showQuickOnboardModal, setShowQuickOnboardModal] = useState(false);
  const [showReferralUploader, setShowReferralUploader] = useState(false);

  useEffect(() => {
    if (clientId) {
      setIsLoading(true);
      Promise.all([
        base44.entities.Client.filter({ id: clientId }),
        base44.entities.ClientCondition.filter({ client_id: clientId })
      ]).then(([clients, conditions]) => {
        if (clients.length > 0) {
          const clientData = clients[0];
          setFormData(prev => ({
            ...prev,
            ...clientData,
            apss_completed: clientData.apss_completed ?? prev.apss_completed,
            consent_confirmed: clientData.consent_confirmed ?? prev.consent_confirmed,
            privacy_consent: clientData.privacy_consent ?? prev.privacy_consent,
            assessment_consent: clientData.assessment_consent ?? prev.assessment_consent,
            pricing_explained: clientData.pricing_explained ?? prev.pricing_explained,
            client_completed_sections: clientData.client_completed_sections || [],
            medical_conditions: conditions || []
          }));
        } else {
          toast.error("Client not found.");
          navigate(createPageUrl("Clients"));
        }
        setIsLoading(false);
      }).catch(error => {
        console.error("Error loading client:", error);
        toast.error("Failed to load client data.");
        navigate(createPageUrl("Clients"));
        setIsLoading(false);
      });
    } else {
      setIsLoading(false);
    }
  }, [clientId, navigate]);

  const clientIdRef = useRef(clientId);
  useEffect(() => { clientIdRef.current = clientId; }, [clientId]);

  // Step changes are pure component state (no navigation), so the router
  // performs no scroll restoration; reset the window explicitly.
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [currentStep]);

  const autoSaveInProgressRef = useRef(false);
  // Holds the in-flight Client.create promise (from whichever path first
  // creates this session's client). Every create-capable path awaits it before
  // deciding create-vs-update, so a user racing ahead of the fire-and-forget
  // silent autosave on a slow connection cannot mint a second Client.
  const clientCreationRef = useRef(null);

  // Await any in-flight create, then report whether the client now has an id.
  const awaitInFlightCreate = async () => {
    if (clientCreationRef.current) {
      try { await clientCreationRef.current; } catch { /* creator logs its own error */ }
    }
    return clientIdRef.current;
  };

  const silentSaveDraft = async (data) => {
    if (autoSaveInProgressRef.current) return;
    autoSaveInProgressRef.current = true;
    try {
      const { medical_conditions, ...clientData } = data;
      // A create may already be in flight from a user-initiated path; wait for
      // it so this autosave updates rather than creating a duplicate.
      const currentClientId = clientIdRef.current || await awaitInFlightCreate();
      if (currentClientId) {
        await base44.entities.Client.update(currentClientId, clientData);
      } else {
        const user = await base44.auth.me();
        const mems = await base44.entities.OrganizationMember.filter({ user_email: user.email }).catch(() => []);
        const primary = (mems || []).find(m => m.is_primary) || (mems || [])[0];
        const draftOrgId = primary?.org_id;
        if (!draftOrgId) return;

        const createPromise = base44.entities.Client.create({
          ...clientData,
          org_id: draftOrgId,
          assigned_clinician_email: user.email,
          onboarding_status: 'in_progress'
        });
        clientCreationRef.current = createPromise;
        const newClient = await createPromise;
        if (newClient?.id) {
          window.history.replaceState(null, '', `?id=${newClient.id}`);
          clientIdRef.current = newClient.id;
        }
      }
    } catch (e) {
      console.warn('Auto-save draft failed:', e);
    } finally {
      autoSaveInProgressRef.current = false;
    }
  };

  const handleNext = (stepData) => {
    const updatedData = { ...formData, ...stepData };
    if (isClientView) {
      const completedSections = updatedData.client_completed_sections || [];
      if (!completedSections.includes(currentStep)) {
        updatedData.client_completed_sections = [...completedSections, currentStep];
      }
    }
    setFormData(updatedData);
    if (updatedData.full_name && updatedData.date_of_birth) {
      silentSaveDraft(updatedData);
    }
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleStepClick = (stepNumber) => {
    if (isClientView) {
      const step = steps.find(s => s.id === stepNumber);
      if (step && step.clientCanComplete) setCurrentStep(stepNumber);
      return;
    }
    setCurrentStep(stepNumber);
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Email content copied to clipboard!");
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  };

  const copyLinkToClipboard = async (link) => {
    try {
      await navigator.clipboard.writeText(link);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
      toast.success("Client link copied to clipboard!");
    } catch {
      toast.error("Failed to copy link to clipboard");
    }
  };

  const buildEmailContent = (fullName, email, link) => `Subject: Complete Your Pre-Appointment Form

Dear ${fullName},

Thank you for choosing our clinic for your healthcare needs. To help us provide you with the best possible care, we would like you to complete some preliminary information before your appointment.

Please click the link below to access your secure onboarding form:

${link}

You can complete the following sections at your convenience:
• Referral Information  
• Medical History
• Your Goals for Treatment

Please note: Some sections (like consent forms and clinical assessments) will be completed together during your appointment.

If you have any questions or need assistance, please don't hesitate to contact us.

Best regards,
Your Clinical Team

---
Send this email to: ${email}`;

  const handleSaveAndSendToClient = async (stepData) => {
    const updatedData = { ...formData, ...stepData };
    setFormData(updatedData);

    if (!updatedData.full_name?.trim()) { toast.error("Client name is required."); return; }
    if (!updatedData.email?.trim()) { toast.error("Client email is required."); return; }
    if (!updatedData.date_of_birth) { toast.error("Client date of birth is required."); return; }
    if (isSendingEmail || isSubmitting) return;

    setIsSendingEmail(true);
    setIsSubmitting(true);
    try {
      let client;
      const effectiveClientId = clientIdRef.current || await awaitInFlightCreate();
      if (effectiveClientId) {
        client = await base44.entities.Client.update(effectiveClientId, updatedData);
        client = { id: effectiveClientId, ...client };
      } else {
        const currentUser = await base44.auth.me();
        const { orgId } = await getOrCreateOrg(currentUser);

        const createPromise = base44.entities.Client.create({ ...updatedData, org_id: orgId, assigned_clinician_email: currentUser.email });
        clientCreationRef.current = createPromise;
        client = await createPromise;
        if (client?.id) {
          clientIdRef.current = client.id;
          window.history.replaceState(null, '', `?id=${client.id}`);
        }
      }

      const generatedLink = `${window.location.origin}${createPageUrl(`Onboarding?id=${client.id}&client=true`)}`;
      setClientLink(generatedLink);
      setEmailContent(buildEmailContent(updatedData.full_name, updatedData.email, generatedLink));
      setShowEmailDialog(true);
      toast.success(`Client saved! Email content ready for ${updatedData.email}`);
    } catch (error) {
      console.error("Failed to save client:", error);
      toast.error("Failed to save client data. Please try again.");
    } finally {
      setIsSendingEmail(false);
      setIsSubmitting(false);
    }
  };

  const handleSendToClient = async () => {
    if (!formData.email || !formData.full_name) { toast.error("Client email and name are required."); return; }
    setIsSendingEmail(true);
    try {
      const generatedLink = `${window.location.origin}${createPageUrl(`Onboarding?id=${clientId}&client=true`)}`;
      setClientLink(generatedLink);
      setEmailContent(buildEmailContent(formData.full_name, formData.email, generatedLink));
      setShowEmailDialog(true);
    } catch (error) {
      toast.error("Failed to generate email content.");
    } finally {
      setIsSendingEmail(false);
    }
  };

  const extractConditionsFromAPSS = (data) => {
    const conditions = [];
    if (data.apss_q1_heart_stroke && data.apss_q1_details) conditions.push({ condition_name: "Heart/Stroke History", notes: data.apss_q1_details });
    if (data.apss_q2_chest_pain && data.apss_q2_details) conditions.push({ condition_name: "Chest Pain", notes: data.apss_q2_details });
    if (data.apss_q3_faint_dizzy && data.apss_q3_details) conditions.push({ condition_name: "Dizziness/Balance Issues", notes: data.apss_q3_details });
    if (data.apss_q4_asthma && data.apss_q4_details) conditions.push({ condition_name: "Asthma", notes: data.apss_q4_details });
    if (data.apss_q5_diabetes_control && data.apss_q5_details) conditions.push({ condition_name: "Diabetes Control Issues", notes: data.apss_q5_details });
    if (data.apss_q6_other_conditions && data.apss_q6_details) conditions.push({ condition_name: "Other Conditions", notes: data.apss_q6_details });
    if (data.apss_s2_high_blood_pressure) conditions.push({ condition_name: "High Blood Pressure", medication: data.apss_s2_bp_medication_details || null, notes: `Systolic: ${data.apss_s2_systolic_bp || 'N/A'}, Diastolic: ${data.apss_s2_diastolic_bp || 'N/A'}` });
    if (data.apss_s2_high_cholesterol) conditions.push({ condition_name: "High Cholesterol", medication: data.apss_s2_cholesterol_medication_details || null, notes: `Total: ${data.apss_s2_total_cholesterol || 'N/A'}, HDL: ${data.apss_s2_hdl || 'N/A'}, LDL: ${data.apss_s2_ldl || 'N/A'}, Triglycerides: ${data.apss_s2_triglycerides || 'N/A'}` });
    if (data.apss_s2_high_blood_sugar) conditions.push({ condition_name: "High Blood Sugar", medication: data.apss_s2_glucose_medication_details || null, notes: `Fasting glucose: ${data.apss_s2_fasting_glucose || 'N/A'} mmol/L` });
    if (data.apss_s2_musculoskeletal_issues && data.apss_s2_musculoskeletal_details) conditions.push({ condition_name: "Musculoskeletal Issues", notes: data.apss_s2_musculoskeletal_details });
    if (data.apss_s2_hospital_admissions && data.apss_s2_hospital_admissions_details) conditions.push({ condition_name: "Recent Hospitalization", notes: data.apss_s2_hospital_admissions_details });
    if (data.apss_s2_pregnancy && data.apss_s2_pregnancy_details) conditions.push({ condition_name: "Pregnancy/Postpartum", notes: data.apss_s2_pregnancy_details });
    return conditions;
  };

  const saveConditions = async (clientRecord, medicalConditions, allFormData) => {
    const apssConditions = extractConditionsFromAPSS(allFormData);
    const allConditions = [...(medicalConditions || []), ...apssConditions];
    if (!clientRecord || allConditions.length === 0) return;
    if (clientRecord.id === clientIdRef.current) {
      const oldConditions = await base44.entities.ClientCondition.filter({ client_id: clientRecord.id });
      for (const condition of oldConditions) await base44.entities.ClientCondition.delete(condition.id);
    }
    const conditionsToCreate = allConditions
      .filter(c => c.condition_name?.trim())
      .map(c => ({ ...c, client_id: clientRecord.id, org_id: clientRecord.org_id, condition_type: c.condition_type || 'primary', pain_level: (c.pain_level !== '' && c.pain_level != null) ? Number(c.pain_level) : undefined }));
    if (conditionsToCreate.length > 0) await base44.entities.ClientCondition.bulkCreate(conditionsToCreate);
  };

  const getOrCreateOrg = async (currentUser) => {
    let memberships = await base44.entities.OrganizationMember.filter({ user_email: currentUser.email });
    if (memberships.length === 0) {
      const defaultName = `${currentUser.full_name || currentUser.email}'s Clinic`.slice(0, 160);
      const newOrg = await ensureFounderOrganization({ clinicName: defaultName });
      return { orgId: newOrg.id, memberships: [{ org_id: newOrg.id }] };
    }
    return { orgId: (memberships.find(m => m.is_primary) || memberships[0]).org_id, memberships };
  };

  const handleSubmit = async (finalData) => {
    if (submitLockRef.current || isSubmitting || isSendingEmail) return;
    submitLockRef.current = true;

    const { medical_conditions, ...clientDataFromForm } = { ...formData, ...finalData };

    if (!clientDataFromForm.full_name?.trim()) {
      toast.error("Client name is required. Please complete the Personal Information section.");
      submitLockRef.current = false;
      setCurrentStep(1);
      return;
    }
    if (!clientDataFromForm.date_of_birth) {
      toast.error("Client date of birth is required. Please complete the Personal Information section.");
      submitLockRef.current = false;
      setCurrentStep(1);
      return;
    }

    setIsSubmitting(true);
    try {
      let client;
      const effectiveClientId = clientIdRef.current || await awaitInFlightCreate();
      if (effectiveClientId) {
        const updatedClient = await base44.entities.Client.update(effectiveClientId, clientDataFromForm);
        client = { id: effectiveClientId, org_id: clientDataFromForm.org_id, ...updatedClient };
        if (isClientView) {
          await saveConditions(client, medical_conditions, clientDataFromForm);
          toast.success("Thank you! Your information has been saved.");
          return;
        }
        toast.success("Client profile updated successfully!");
      } else {
        const currentUser = await base44.auth.me();
        const { orgId } = await getOrCreateOrg(currentUser);

        const orgClients = await base44.entities.Client.filter({ org_id: orgId }).catch(() => []);
        const potentialDuplicates = findPotentialDuplicates(clientDataFromForm, orgClients);
        if (potentialDuplicates.length > 0) {
          const names = potentialDuplicates.map((c) => c.full_name).filter(Boolean).join(", ");
          const proceed = window.confirm(
            `A client with a matching name and date of birth already exists (${names || "unknown name"}). Continue and create a new client anyway?`
          );
          if (!proceed) {
            setIsSubmitting(false);
            submitLockRef.current = false;
            return;
          }
        }

        const createPromise = base44.entities.Client.create({ ...clientDataFromForm, org_id: orgId, assigned_clinician_email: currentUser.email });
        clientCreationRef.current = createPromise;
        client = await createPromise;
        if (client?.id) {
          clientIdRef.current = client.id;
          window.history.replaceState(null, '', `?id=${client.id}`);
        }
        toast.success("Client created successfully!");
      }

      await saveConditions(client, medical_conditions, clientDataFromForm);

      // Save onboarding episode snapshot
      if (!isClientView && client) {
        try {
          const existingEpisodes = await base44.entities.ClientOnboardingEpisode.filter({ client_id: client.id });
          const recentEpisode = existingEpisodes.find(ep => (Date.now() - new Date(ep.created_date).getTime()) < 120000);
          if (!recentEpisode) {
            const apssSnapshot = Object.fromEntries(Object.entries(clientDataFromForm).filter(([k]) => k.startsWith('apss_')));
            await base44.entities.ClientOnboardingEpisode.create({
              client_id: client.id,
              org_id: client.org_id,
              episode_number: (existingEpisodes.length || 0) + 1,
              episode_label: `Episode ${(existingEpisodes.length || 0) + 1}`,
              episode_date: todayLocal(),
              funding_source: clientDataFromForm.funding_source || null,
              referral_source: clientDataFromForm.referral_source || null,
              referral_source_name: clientDataFromForm.referral_source_name || null,
              referral_reason: clientDataFromForm.referral_reason || null,
              referral_date: clientDataFromForm.referral_date || null,
              client_goals: clientDataFromForm.client_goals || null,
              apss_completed: clientDataFromForm.apss_completed || false,
              apss_stage2_completed: clientDataFromForm.apss_stage2_completed || false,
              consent_confirmed: clientDataFromForm.consent_confirmed || false,
              privacy_consent: clientDataFromForm.privacy_consent || false,
              assessment_consent: clientDataFromForm.assessment_consent || false,
              pricing_explained: clientDataFromForm.pricing_explained || false,
              apss_snapshot: apssSnapshot,
              medical_conditions_snapshot: [...(medical_conditions || []), ...extractConditionsFromAPSS(clientDataFromForm)],
              status: 'active',
              signed_policy_id: clientDataFromForm.signed_policy_id || null,
              signed_policy_name: clientDataFromForm.signed_policy_name || null,
              signed_policy_version: clientDataFromForm.signed_policy_version || null,
              signed_policy_date: clientDataFromForm.signed_policy_date || null,
              signed_policy_snapshot: clientDataFromForm.signed_policy_snapshot || null,
            });
          }
        } catch (episodeErr) {
          console.warn('Failed to save onboarding episode snapshot:', episodeErr);
        }
      }

      if (!isClientView) navigate(createPageUrl(`ClientProfile?id=${client.id}`));
    } catch (error) {
      console.error("Error saving client:", error);
      toast.error(`Failed to save client: ${error?.message || 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
      submitLockRef.current = false;
    }
  };

  const handleSaveAndFinishLater = async (stepData, silentAutoSave = false) => {
    const updatedData = { ...formData, ...stepData };
    setFormData(updatedData);
    if (!updatedData.full_name || !updatedData.date_of_birth) {
      if (!silentAutoSave) toast.error("Name and date of birth are required.");
      return;
    }
    // Coalesce overlapping silent auto-saves (APSS debounce, signature pen
    // lifts): a second silent save while one is in flight would otherwise
    // race the create branch and mint a duplicate client.
    if (silentAutoSave && autoSaveInProgressRef.current) return;
    autoSaveInProgressRef.current = true;
    setIsSubmitting(true);
    try {
      const { medical_conditions, ...clientData } = updatedData;
      let client;
      // A manual "Save & Finish Later" click can arrive while a silent create
      // is still in flight; await it so we update rather than duplicate.
      const effectiveClientId = clientIdRef.current || await awaitInFlightCreate();
      if (effectiveClientId) {
        client = await base44.entities.Client.update(effectiveClientId, clientData);
        client = { id: effectiveClientId, org_id: clientData.org_id, ...client };
        if (!silentAutoSave) toast.success("Progress saved!");
      } else {
        const currentUser = await base44.auth.me();
        const { orgId } = await getOrCreateOrg(currentUser);

        const createPromise = base44.entities.Client.create({ ...clientData, org_id: orgId, assigned_clinician_email: currentUser.email });
        clientCreationRef.current = createPromise;
        client = await createPromise;
        if (client?.id) {
          clientIdRef.current = client.id;
          window.history.replaceState(null, '', `?id=${client.id}`);
        }
        if (!silentAutoSave) toast.success("Client created! You can continue anytime.");
      }
      await saveConditions(client, medical_conditions, updatedData);
      if (!silentAutoSave) navigate(createPageUrl(`ClientProfile?id=${client.id}`));
    } catch (error) {
      console.error("Error saving:", error);
      if (!silentAutoSave) toast.error(`Failed to save: ${error.message || 'Unknown error'}`);
    } finally {
      autoSaveInProgressRef.current = false;
      setIsSubmitting(false);
    }
  };

  const getStepStatus = (stepId) => {
    if (formData.client_completed_sections?.includes(stepId)) return 'client-completed';
    if (stepId < currentStep) return 'completed';
    if (stepId === currentStep) return 'current';
    return 'pending';
  };

  const getCurrentStepComponent = () => {
    const step = steps[currentStep - 1];
    if (isClientView && !step.clientCanComplete) {
      const nextClientStep = steps.find(s => s.id > currentStep && s.clientCanComplete);
      if (nextClientStep) {
        setCurrentStep(nextClientStep.id);
        return null;
      }
      return () => (
        <div className="text-center py-8">
          <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
          <h3 className="text-xl font-semibold text-slate-900 mb-2">Thank you!</h3>
          <p className="text-slate-600 mb-4">You have completed all the sections available to you. Your clinician will complete the remaining sections during your appointment.</p>
          <Button onClick={() => handleSubmit(formData)} disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Submit Information'}
          </Button>
        </div>
      );
    }
    return step.component;
  };

  const CurrentStepComponent = getCurrentStepComponent();
  const progressPercentage = (currentStep / steps.length) * 100;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 p-6 flex justify-center items-center">
        <div className="text-center p-8 bg-white/80 rounded-lg shadow-xl">
          <p className="text-xl font-semibold text-slate-800 mb-4">Loading client data...</p>
          <Progress value={50} className="w-64 h-2 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <>
      <Toaster position="top-center" richColors />

      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Email Content Ready</DialogTitle>
            <DialogDescription>Copy this content and send it to your client via your email system.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">Client Link:</label>
              <div className="flex gap-2">
                <input value={clientLink} readOnly className="flex-1 p-2 border rounded text-sm font-mono bg-slate-50" />
                <Button onClick={() => copyLinkToClipboard(clientLink)} variant="outline" size="sm">
                  {linkCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">Complete Email Content:</label>
              <Textarea value={emailContent} readOnly className="min-h-[300px] font-mono text-sm bg-slate-50" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button onClick={() => copyToClipboard(emailContent)} variant="outline">
              {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
              Copy Email Content
            </Button>
            <Button onClick={() => { setShowEmailDialog(false); if (clientId) navigate(createPageUrl(`ClientProfile?id=${clientId}`)); }}>
              Continue to Client Profile
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 p-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              {!isClientView && (
                <Button variant="outline" size="icon" onClick={() => navigate(clientId ? createPageUrl(`ClientProfile?id=${clientId}`) : createPageUrl("Dashboard"))} className="bg-white/60 backdrop-blur-sm">
                  <ArrowLeft className="w-4 h-4" />
                </Button>
              )}
              <div>
                <h1 className="text-2xl font-bold text-slate-900">
                  {isClientView ? "Complete Your Information" : (clientId ? "Edit Client Profile" : "Client Onboarding")}
                </h1>
                <p className="text-slate-600">
                  {isClientView ? "Please fill out the available sections" : `Step ${currentStep} of ${steps.length}: ${steps[currentStep - 1].title}`}
                </p>
              </div>
            </div>
            {!isClientView && !clientId && (
              <div className="flex items-center gap-2">
                <ReferralToggleButton
                  onClick={() => setShowReferralUploader((current) => !current)}
                  variant="outline"
                  className={showReferralUploader ? "bg-blue-50 border-blue-300" : "bg-white"}
                >
                  <Upload className="w-4 h-4 mr-2" /> {showReferralUploader ? 'Hide Referral' : 'Upload Referral'}
                </ReferralToggleButton>
                <Button onClick={() => setShowQuickOnboardModal(true)} className="bg-purple-600 hover:bg-purple-700">
                  <UserPlus className="w-4 h-4 mr-2" /> Quick Onboard
                </Button>
              </div>
            )}
            {!isClientView && clientId && formData.email && (
              <Button onClick={handleSendToClient} disabled={isSendingEmail} variant="outline" className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100">
                {isSendingEmail ? "Preparing..." : <><Mail className="w-4 h-4 mr-2" /> Send to Client</>}
              </Button>
            )}
          </div>

          {showReferralUploader && (
            <div className="mb-8">
              <ReferralUploader
                onClientCreated={(newClient) => {
                  setShowReferralUploader(false);
                  navigate(createPageUrl(`ClientProfile?id=${newClient.id}`));
                }}
                onClientUpdated={(updatedClient) => {
                  setShowReferralUploader(false);
                  navigate(createPageUrl(`ClientProfile?id=${updatedClient.id}`));
                }}
              />
            </div>
          )}

          <Card className="mb-8 bg-white/60 backdrop-blur-sm border-slate-200/60">
            <CardHeader className="pb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-slate-600">Progress</span>
                <span className="text-sm font-medium text-slate-600">{Math.round(progressPercentage)}%</span>
              </div>
              <Progress value={progressPercentage} className="h-2" />
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex justify-between">
                {steps.map((step) => {
                  const status = getStepStatus(step.id);
                  const isClickable = !isClientView || step.clientCanComplete;
                  return (
                    <div key={step.id} className="flex flex-col items-center">
                      <button
                        onClick={() => isClickable && handleStepClick(step.id)}
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-200 ${
                          status === 'client-completed' ? 'bg-purple-500 text-white cursor-pointer hover:bg-purple-600' :
                          status === 'completed' ? 'bg-green-500 text-white cursor-pointer hover:bg-green-600' :
                          status === 'current' ? 'bg-blue-500 text-white' :
                          isClickable ? 'bg-slate-200 text-slate-500 hover:bg-slate-300 cursor-pointer' :
                          'bg-slate-200 text-slate-500 cursor-not-allowed opacity-50'
                        }`}
                        disabled={!isClickable}
                      >
                        {(status === 'completed' || status === 'client-completed') ? <CheckCircle className="w-4 h-4" /> : step.id}
                      </button>
                      <span className={`mt-2 text-xs font-medium text-center hidden md:block max-w-20 leading-tight ${status === 'current' || status === 'completed' || status === 'client-completed' ? 'text-slate-900' : 'text-slate-500'}`}>
                        {step.title}
                      </span>
                      {status === 'client-completed' && !isClientView && <span className="text-xs text-purple-600 font-medium">Client filled</span>}
                      {!step.clientCanComplete && isClientView && <span className="text-xs text-orange-600">Staff only</span>}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {CurrentStepComponent && (
            <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-xl">
              <CardHeader>
                <CardTitle className="text-xl text-slate-900">
                  {steps[currentStep - 1].title}
                  {isClientView && !steps[currentStep - 1].clientCanComplete && (
                    <span className="ml-2 text-sm text-orange-600 font-normal">(Staff will complete this section)</span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CurrentStepComponent
                  data={formData}
                  onNext={currentStep === steps.length ? handleSubmit : handleNext}
                  onBack={handleBack}
                  onSaveAndSend={handleSaveAndSendToClient}
                  onSaveAndFinishLater={handleSaveAndFinishLater}
                  canGoBack={currentStep > 1}
                  isSubmitting={isSubmitting || isSendingEmail}
                  isLastStep={currentStep === steps.length}
                  isClientView={isClientView}
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <QuickOnboardModal
        isOpen={showQuickOnboardModal}
        onClose={() => setShowQuickOnboardModal(false)}
        onClientCreated={(newClientId) => navigate(createPageUrl(`ClientProfile?id=${newClientId}`))}
      />

    </>
  );
}
