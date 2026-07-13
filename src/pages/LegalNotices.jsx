import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Loader2, Stethoscope } from "lucide-react";
import { Toaster, toast } from "sonner";
import PractitionerNoticesSection from "@/components/legal/PractitionerNoticesSection";
import { recordLegalEvents } from "@/lib/legal/recordAcceptance";
import { EVENT_TYPES } from "@/lib/legal/documentRegistry";

// Standalone re-acceptance screen. Reached only when Layout.jsx's gate finds
// a user missing one or more of the current-version mandatory practitioner
// notices — either a legacy account from before this mechanism existed, or an
// existing user whose acceptance predates a suite version bump (the
// reacceptance-trigger case in policy-suite doc 27 clause 6). Deliberately NOT
// the old floating LegalAcceptanceModal: it shows the real notices (not a
// generic disclaimer), records distinct events, and never redirects the user
// off the app on decline.
export default function LegalNotices() {
  const navigate = useNavigate();
  const [notices, setNotices] = useState({
    collectionNotice: false,
    clinicalUse: false,
    aiTransparency: false,
    marketing: false,
  });
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = (field, value) => {
    setNotices((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const handleContinue = async () => {
    const newErrors = {};
    if (!notices.collectionNotice) newErrors.collectionNotice = "Required to continue";
    if (!notices.clinicalUse) newErrors.clinicalUse = "Required to continue";
    if (!notices.aiTransparency) newErrors.aiTransparency = "Required to continue";
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setIsSaving(true);
    try {
      const user = await base44.auth.me();
      const memberships = await base44.entities.OrganizationMember.filter({ user_email: user.email });
      const orgId = memberships?.[0]?.org_id;

      const events = [
        { eventType: EVENT_TYPES.COLLECTION_NOTICE_ACKNOWLEDGEMENT, documentId: "collection-notice" },
        { eventType: EVENT_TYPES.PROFESSIONAL_USE_ACKNOWLEDGEMENT, documentId: "clinical-use-notice" },
        { eventType: EVENT_TYPES.AI_TRANSPARENCY_CONSENT, documentId: "ai-notice" },
      ].map((e) => ({ ...e, userEmail: user.email, orgId, actorCapacity: "reacceptance" }));
      if (notices.marketing) {
        events.push({ eventType: EVENT_TYPES.MARKETING_CONSENT, userEmail: user.email, orgId, actorCapacity: "reacceptance" });
      }
      await recordLegalEvents(events);
      toast.success("Notices recorded");
      navigate("/Dashboard");
    } catch (error) {
      console.error("Failed to record legal acceptance", error);
      toast.error("Failed to save. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Toaster position="top-center" richColors />
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 flex items-center justify-center p-6">
        <div className="max-w-xl w-full space-y-6">
          <div className="text-center space-y-3">
            <div className="w-14 h-14 mx-auto bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center shadow-lg">
              <Stethoscope className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Updated notices</h1>
              <p className="text-sm text-slate-600 mt-1">
                AssessSuite's practitioner notices have been updated. Please review and confirm before continuing.
              </p>
            </div>
          </div>

          <PractitionerNoticesSection values={notices} onChange={handleChange} errors={errors} />

          <Button onClick={handleContinue} disabled={isSaving} className="w-full h-12 font-medium">
            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            {isSaving ? "Recording..." : "Continue"}
          </Button>
        </div>
      </div>
    </>
  );
}
