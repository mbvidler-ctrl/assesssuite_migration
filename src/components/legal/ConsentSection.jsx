import React from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ShieldCheck } from "lucide-react";
import { getLegalDocument } from "@/lib/legal/documentRegistry";

// Single consolidated consent for the post-payment first-run sign-up
// (ProfileSetup). ONE mandatory checkbox by which the user accepts every
// instrument relevant to them, plus one independent, unticked, optional
// marketing opt-in. Replaces the former PractitionerNoticesSection +
// PracticeAgreementSection pair ON THE SIGN-UP SCREEN ONLY — the standalone
// re-acceptance screen (LegalNotices.jsx) is a separate surface and still
// uses PractitionerNoticesSection unchanged.
//
// The single checkbox is a UI consolidation only. On submit, ProfileSetup
// still records one LegalAcceptanceEvent per instrument exactly as before
// (three notice events for every user; the contract-acceptance event for a
// founding owner), so the evidentiary record is unchanged.
//
// The receipt-vs-consent distinction of the Collection Notice is preserved in
// the wording (policy-suite doc 27 clause 5): it is acknowledged as received,
// not consented to. The jurisdictions selector and adult-only confirmation are
// deliberately removed (UM-AUTO-20260718): paediatric use is in scope and any
// jurisdictional requirement is carried in the policies, not captured here.

const legalLink = (doc, text) => (
  <Link to={`/legal/${doc.slug}`} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">
    {text}
  </Link>
);

const collectionNotice = getLegalDocument("collection-notice");
const clinicalUseNotice = getLegalDocument("clinical-use-notice");
const aiNotice = getLegalDocument("ai-notice");
const terms = getLegalDocument("terms");
const dpa = getLegalDocument("dpa");
const aup = getLegalDocument("aup");
const subscription = getLegalDocument("subscription");
const subprocessors = getLegalDocument("subprocessors");

export default function ConsentSection({ values, onChange, error, isFoundingOwner = false }) {
  return (
    <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-blue-600" />
          Consent
        </CardTitle>
        <p className="text-xs text-slate-500">
          One confirmation covers every instrument that applies to you. Each is linked below.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-start gap-3">
          <Checkbox
            id="consent-accepted"
            checked={values.accepted}
            onCheckedChange={(v) => onChange("accepted", v === true)}
            aria-describedby="consent-accepted-details"
            className="mt-0.5"
          />
          <div className="text-sm text-slate-700 leading-snug">
            <Label htmlFor="consent-accepted" className="font-medium cursor-pointer">
              I confirm that:
            </Label>
            <ul id="consent-accepted-details" className="list-disc pl-5 mt-1 space-y-1">
              <li>
                I have received and can access the{" "}
                {legalLink(collectionNotice, "Practitioner Account Collection Notice")} — this acknowledges
                receipt, not consent to processing;
              </li>
              <li>
                I have read and agree to the{" "}
                {legalLink(clinicalUseNotice, "Clinical Use and Professional Responsibility Notice")}, and
                retain full professional and legal responsibility for all clinical decisions and outcomes;
              </li>
              <li>
                I have read and consent to the{" "}
                {legalLink(aiNotice, "AI and Automated Processing Transparency Notice")}, and will review
                AI-generated content before clinical use{isFoundingOwner ? ";" : "."}
              </li>
              {isFoundingOwner && (
                <li>
                  on behalf of this practice and in my own capacity, I have read and accept the{" "}
                  {legalLink(terms, "Practitioner and Clinic SaaS Terms")}, the{" "}
                  {legalLink(dpa, "Data Processing and Security Schedule")}, the{" "}
                  {legalLink(aup, "Acceptable Use Policy")}, the{" "}
                  {legalLink(subscription, "Subscription, Cancellation and Refund Policy")}, and the{" "}
                  {legalLink(subprocessors, "Approved Subprocessor and Cross-Border Data Schedule")}.
                </li>
              )}
            </ul>
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
          </div>
        </div>

        {isFoundingOwner && (
          <p className="text-xs text-slate-400 bg-slate-50 rounded-lg p-2.5">
            Direct patient accounts are disabled for every practice at this release — patients do not log in
            to AssessSuite directly.
          </p>
        )}

        <div className="border-t border-slate-100 pt-2">
          <div className="flex items-start gap-3 py-1">
            <Checkbox
              id="consent-marketing"
              checked={values.marketing}
              onCheckedChange={(v) => onChange("marketing", v === true)}
              className="mt-0.5"
            />
            <Label
              htmlFor="consent-marketing"
              className="text-sm text-slate-500 font-normal leading-snug cursor-pointer"
            >
              Optional: send me product updates and marketing by email. Unticked by default; refusing has no
              effect on your account.
            </Label>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
