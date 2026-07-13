import React from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import LegalMarkdown from "@/components/legal/LegalMarkdown";
import ReleaseStatusBanner from "@/components/legal/ReleaseStatusBanner";
import { getLegalDocumentBySlug, SUITE_VERSION } from "@/lib/legal/documentRegistry";
import { loadLegalContent } from "@/lib/legal/loadContent";

// Public, unauthenticated route: /legal/:slug. Single source of truth for
// every instrument in Group A (published, no login required) and the full
// text linked from Group B/C acceptance screens. See documentRegistry.js.
export default function LegalDocument() {
  const { slug } = useParams();
  const doc = getLegalDocumentBySlug(slug);

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

  const content = loadLegalContent(doc.file);

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-xl border border-slate-200 shadow-sm p-8">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6">
          <ArrowLeft className="w-4 h-4" />
          Back to AssessSuite
        </Link>
        <ReleaseStatusBanner releaseStatus={doc.releaseStatus} version={SUITE_VERSION} />
        <LegalMarkdown content={content} />
      </div>
    </div>
  );
}
