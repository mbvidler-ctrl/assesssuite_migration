import React from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import LegalMarkdown from "@/components/legal/LegalMarkdown";
import ReleaseStatusBanner from "@/components/legal/ReleaseStatusBanner";
import {
  getLegalDocumentBySlug,
  SUITE_PUBLICATION_AUTHORITY,
  SUITE_VERSION,
} from "@/lib/legal/documentRegistry";
import { loadLegalContent } from "@/lib/legal/loadContent";
import { useAuth } from "@/lib/AuthContext";

// When the verified deployment is flipped to effective
// (LEGAL_STATUS=effective via public settings), the RC banner is replaced with
// the effective-status line and source metadata is reconciled at render time.
// RC-2026.07.11 remains historical; RC-2026.07.19 is the current identifier
// recorded in new and re-acceptance events.
function applyEffectiveHeaders(content, effectiveDate) {
  // Trailing two spaces preserve the markdown hard line break — the source
  // header lines use it so each metadata line renders on its own line; dropping
  // it would collapse them into one paragraph.
  return content
    .replace(/^\*\*Release status:\*\*.*$/m, "**Release status:** Effective  ")
    .replace(/^\*\*Effective date:\*\*.*$/m, `**Effective date:** ${effectiveDate}  `)
    .replace(/^\*\*Approved by:\*\*.*$/m, `**Publication authority:** ${SUITE_PUBLICATION_AUTHORITY}  `)
    .replace(/^\*\*Publication authority:\*\*.*$/m, `**Publication authority:** ${SUITE_PUBLICATION_AUTHORITY}  `)
    .replace(/^\*\*Version:\*\*.*$/m, `**Version:** ${SUITE_VERSION}  `);
}

// Public, unauthenticated route: /legal/:slug. Single source of truth for
// every instrument in Group A (published, no login required) and the full
// text linked from Group B/C acceptance screens. See documentRegistry.js.
export default function LegalDocument() {
  const { slug } = useParams();
  const doc = getLegalDocumentBySlug(slug);
  const { appPublicSettings } = useAuth();
  const legal = appPublicSettings?.public_settings?.legal;
  const isEffective = legal?.status === "effective";
  const effectiveDate = legal?.effective_date || null;

  if (!doc) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="text-center">
          <p className="text-lg font-semibold text-slate-900">Document not found</p>
          <Link to="/" className="text-blue-700 underline text-sm mt-2 inline-block">Back to home</Link>
        </div>
      </div>
    );
  }

  const rawContent = loadLegalContent(doc.file);
  const content = isEffective && effectiveDate ? applyEffectiveHeaders(rawContent, effectiveDate) : rawContent;

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-xl border border-slate-200 shadow-sm p-8">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6">
          <ArrowLeft className="w-4 h-4" />
          Back to AssessSuite
        </Link>
        {isEffective && effectiveDate ? (
          <div className="flex items-start gap-3 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 mb-6">
            <ShieldCheck className="w-5 h-5 text-slate-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-slate-700">
              <p className="font-semibold">Current legal suite — Effective {effectiveDate}</p>
              <p className="text-slate-500 mt-0.5">Document identifier {SUITE_VERSION}</p>
            </div>
          </div>
        ) : (
          <ReleaseStatusBanner releaseStatus={doc.releaseStatus} version={SUITE_VERSION} />
        )}
        <LegalMarkdown content={content} />
      </div>
    </div>
  );
}
