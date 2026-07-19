import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Loader2, Stethoscope } from "lucide-react";
import { Toaster, toast } from "sonner";
import ConsentSection from "@/components/legal/ConsentSection";
import { recordLegalAcceptanceBundle } from "@/lib/legal/recordAcceptance";

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
  const [consent, setConsent] = useState({
    accepted: false,
    marketing: false,
  });
  const [membership, setMembership] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const user = await base44.auth.me();
        const memberships = await base44.entities.OrganizationMember.filter({ user_email: user.email });
        if (!memberships?.[0]) throw new Error("No organisation membership is available");
        if (active) setMembership(memberships[0]);
      } catch (error) {
        console.error("Failed to load legal acceptance context", error);
        if (active) toast.error("Unable to load your practice context. Please try again.");
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleChange = (field, value) => {
    setConsent((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const handleContinue = async () => {
    const newErrors = {};
    if (!consent.accepted) newErrors.accepted = "Required to continue";
    if (!membership?.org_id) newErrors.context = "Practice context is unavailable";
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setIsSaving(true);
    try {
      await recordLegalAcceptanceBundle({
        orgId: membership.org_id,
        marketingOptIn: consent.marketing,
      });
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

          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-slate-500">
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Loading applicable instruments...
            </div>
          ) : (
            <ConsentSection
              values={consent}
              onChange={handleChange}
              error={errors.accepted || errors.context}
              isFoundingOwner={membership?.role === "owner"}
            />
          )}

          <Button
            onClick={handleContinue}
            disabled={isLoading || isSaving || !membership}
            className="w-full h-12 font-medium"
          >
            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            {isSaving ? "Recording..." : "Continue"}
          </Button>
        </div>
      </div>
    </>
  );
}
