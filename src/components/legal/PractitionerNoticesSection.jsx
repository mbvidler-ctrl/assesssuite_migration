import React from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ShieldCheck } from "lucide-react";
import { getLegalDocument } from "@/lib/legal/documentRegistry";

// The three mandatory, individually-recorded practitioner notices (doc 27
// clause 2's "mandatory separation" list) plus one independent, unticked,
// optional marketing opt-in. Shown to EVERY user — practice owner or invited
// clinician alike — at first login, regardless of the Practice Agreement step
// (which only the org owner sees). Each checkbox writes its own
// LegalAcceptanceEvent on submit; see ProfileSetup.jsx.
//
// The collection-notice checkbox is deliberately NOT labelled "agree" — it
// acknowledges the notice was displayed/received, which is not consent to
// processing (doc 27 clause 5). The other two are genuine acknowledgements/
// consents and are labelled accordingly.

const collectionNotice = getLegalDocument("collection-notice");
const clinicalUseNotice = getLegalDocument("clinical-use-notice");
const aiNotice = getLegalDocument("ai-notice");

function NoticeRow({ id, checked, onChange, error, children }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <Checkbox id={id} checked={checked} onCheckedChange={onChange} className="mt-0.5" />
      <Label htmlFor={id} className="text-sm text-slate-700 font-normal leading-snug cursor-pointer">
        {children}
        {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
      </Label>
    </div>
  );
}

export default function PractitionerNoticesSection({ values, onChange, errors = {} }) {
  return (
    <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-blue-600" />
          Practitioner Notices
        </CardTitle>
        <p className="text-xs text-slate-500">
          Required for every AssessSuite user, each recorded separately.
        </p>
      </CardHeader>
      <CardContent className="space-y-1">
        <NoticeRow
          id="notice-collection"
          checked={values.collectionNotice}
          onChange={(v) => onChange("collectionNotice", v)}
          error={errors.collectionNotice}
        >
          I acknowledge I have received and can access the{" "}
          <Link to={`/legal/${collectionNotice.slug}`} target="_blank" className="text-blue-700 underline">
            Practitioner Account Collection Notice
          </Link>{" "}
          — this acknowledges receipt, not consent to processing.
        </NoticeRow>

        <NoticeRow
          id="notice-clinical-use"
          checked={values.clinicalUse}
          onChange={(v) => onChange("clinicalUse", v)}
          error={errors.clinicalUse}
        >
          I have read and agree to the{" "}
          <Link to={`/legal/${clinicalUseNotice.slug}`} target="_blank" className="text-blue-700 underline">
            Clinical Use and Professional Responsibility Notice
          </Link>{" "}
          — I retain full professional and legal responsibility for all clinical decisions and outcomes.
        </NoticeRow>

        <NoticeRow
          id="notice-ai"
          checked={values.aiTransparency}
          onChange={(v) => onChange("aiTransparency", v)}
          error={errors.aiTransparency}
        >
          I have read and consent to the{" "}
          <Link to={`/legal/${aiNotice.slug}`} target="_blank" className="text-blue-700 underline">
            AI and Automated Processing Transparency Notice
          </Link>{" "}
          — I understand which functions use AI assistance and that I must review AI-generated content before clinical use.
        </NoticeRow>

        <div className="border-t border-slate-100 mt-2 pt-2">
          <NoticeRow
            id="notice-marketing"
            checked={values.marketing}
            onChange={(v) => onChange("marketing", v)}
          >
            <span className="text-slate-500">
              Optional: send me product updates and marketing by email. Unticked by default; refusing has no effect on your account.
            </span>
          </NoticeRow>
        </div>
      </CardContent>
    </Card>
  );
}
