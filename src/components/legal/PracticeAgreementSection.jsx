import React from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { FileCheck } from "lucide-react";
import { getLegalDocument } from "@/lib/legal/documentRegistry";

const AU_JURISDICTIONS = ["QLD", "NSW", "VIC", "WA", "SA", "TAS", "ACT", "NT"];

const terms = getLegalDocument("terms");
const dpa = getLegalDocument("dpa");
const aup = getLegalDocument("aup");
const subscription = getLegalDocument("subscription");
const subprocessors = getLegalDocument("subprocessors");

// Shown only when this ProfileSetup submission is FOUNDING a new practice
// (no existing OrganizationMember row) — the practice's first user binds the
// contract on the organisation's behalf. Invited clinicians who join an
// already-agreed practice do not see this section; they only ever get
// PractitionerNoticesSection. Captures the practical facts that gate feature
// availability (jurisdictions served, adult-only confirmation) — this is NOT
// a substitute for the full commercial Order Form (policy-suite doc 24),
// which remains a separate process; see the doc-24 gap note in the session
// report.
export default function PracticeAgreementSection({ values, onChange, errors = {} }) {
  const toggleJurisdiction = (j) => {
    const next = values.jurisdictions.includes(j)
      ? values.jurisdictions.filter((x) => x !== j)
      : [...values.jurisdictions, j];
    onChange("jurisdictions", next);
  };

  return (
    <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileCheck className="w-5 h-5 text-blue-600" />
          Practice Agreement
        </CardTitle>
        <p className="text-xs text-slate-500">
          You are setting up a new practice — this binds AssessSuite's subscription contract for your organisation.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="text-sm font-medium text-slate-700">States/territories where your practice will use AssessSuite *</Label>
          <div className="flex flex-wrap gap-3 mt-2">
            {AU_JURISDICTIONS.map((j) => (
              <label key={j} className="flex items-center gap-1.5 text-sm text-slate-700 cursor-pointer">
                <Checkbox checked={values.jurisdictions.includes(j)} onCheckedChange={() => toggleJurisdiction(j)} />
                {j}
              </label>
            ))}
          </div>
          {errors.jurisdictions && <p className="text-red-500 text-xs mt-1">{errors.jurisdictions}</p>}
          <p className="text-xs text-slate-400 mt-1">Determines which state recording-consent and health-worker-code rules apply to your sessions.</p>
        </div>

        <div className="flex items-start gap-3">
          <Checkbox
            id="adult-only"
            checked={values.adultOnlyConfirmed}
            onCheckedChange={(v) => onChange("adultOnlyConfirmed", v)}
            className="mt-0.5"
          />
          <Label htmlFor="adult-only" className="text-sm text-slate-700 font-normal leading-snug cursor-pointer">
            I confirm this practice's use of AssessSuite is limited to adult patients (18 and over). Paediatric use — guardian
            authority, assent and consent — is not yet supported and must not be used until separately released.
            {errors.adultOnlyConfirmed && <p className="text-red-500 text-xs mt-1">{errors.adultOnlyConfirmed}</p>}
          </Label>
        </div>

        <p className="text-xs text-slate-400 bg-slate-50 rounded-lg p-2.5">
          Direct patient accounts are disabled for every practice at this release — patients do not log in to AssessSuite directly.
        </p>

        <div className="border-t border-slate-100 pt-4">
          <div className="flex items-start gap-3">
            <Checkbox
              id="contract-accept"
              checked={values.contractAccepted}
              onCheckedChange={(v) => onChange("contractAccepted", v)}
              className="mt-0.5"
            />
            <Label htmlFor="contract-accept" className="text-sm text-slate-700 font-normal leading-snug cursor-pointer">
              On behalf of this practice, I have read and accept the{" "}
              <Link to={`/legal/${terms.slug}`} target="_blank" className="text-blue-700 underline">Practitioner and Clinic SaaS Terms</Link>,{" "}
              <Link to={`/legal/${dpa.slug}`} target="_blank" className="text-blue-700 underline">Data Processing and Security Schedule</Link>,{" "}
              <Link to={`/legal/${aup.slug}`} target="_blank" className="text-blue-700 underline">Acceptable Use Policy</Link>,{" "}
              <Link to={`/legal/${subscription.slug}`} target="_blank" className="text-blue-700 underline">Subscription, Cancellation and Refund Policy</Link>, and the{" "}
              <Link to={`/legal/${subprocessors.slug}`} target="_blank" className="text-blue-700 underline">Approved Subprocessor and Cross-Border Data Schedule</Link>.
              {errors.contractAccepted && <p className="text-red-500 text-xs mt-1">{errors.contractAccepted}</p>}
            </Label>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
