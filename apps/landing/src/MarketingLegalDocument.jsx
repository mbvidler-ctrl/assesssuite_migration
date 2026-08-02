import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import LegalMarkdown from '@/components/legal/LegalMarkdown';
import ReleaseStatusBanner from '@/components/legal/ReleaseStatusBanner';
import {
  isLegalDocumentPublicationApproved,
  SUITE_VERSION,
} from '@/lib/legal/documentRegistry';
import { effectiveLegalContent } from '@/lib/legal/effectiveContent';
import { loadApprovedLandingLegalContent } from './approvedLegalContent.js';
import { getApprovedLandingLegalDocumentBySlug } from './approvedLegalDocuments.js';

const SUITE_EFFECTIVE_DATE = import.meta.env.VITE_LEGAL_EFFECTIVE_DATE || '19 July 2026';

export default function MarketingLegalDocument() {
  const { slug } = useParams();
  const doc = getApprovedLandingLegalDocumentBySlug(slug);

  if (!doc || !doc.publicRoute || !isLegalDocumentPublicationApproved(doc)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="text-center">
          <p className="text-lg font-semibold text-slate-900">Document not found</p>
          <Link to="/" className="text-blue-700 underline text-sm mt-2 inline-block">Back to home</Link>
        </div>
      </div>
    );
  }

  const isEffective = isLegalDocumentPublicationApproved(doc);
  const effectiveDate = doc.effectiveDate || SUITE_EFFECTIVE_DATE;
  const rawContent = loadApprovedLandingLegalContent(doc.file);
  const content = effectiveLegalContent(rawContent, {
    status: isEffective ? 'effective' : 'rc',
    effectiveDate: isEffective ? effectiveDate : null,
  });

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-xl border border-slate-200 shadow-sm p-8">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6">
          <ArrowLeft className="w-4 h-4" />
          Back to AssessSuite
        </Link>
        {isEffective ? (
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
