import React from 'react';

import { Badge } from '@/components/ui/badge';

import { statusLabel } from '../lib/format';

const STATUS_STYLES = {
  requested: 'bg-slate-100 text-slate-800 border-slate-200',
  assembling_evidence: 'bg-sky-50 text-sky-800 border-sky-200',
  draft: 'bg-blue-50 text-blue-800 border-blue-200',
  needs_review: 'bg-amber-50 text-amber-900 border-amber-300',
  approved: 'bg-emerald-50 text-emerald-800 border-emerald-300',
  sent: 'bg-emerald-100 text-emerald-900 border-emerald-300',
  amendment_in_progress: 'bg-violet-50 text-violet-800 border-violet-300',
  cancelled: 'bg-slate-100 text-slate-500 border-slate-200 line-through',
};

export function StatusBadge({ status }) {
  return (
    <Badge variant="outline" className={`font-medium ${STATUS_STYLES[status] || ''}`} data-status={status}>
      {statusLabel(status)}
    </Badge>
  );
}

const STATE_STYLES = {
  present: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  missing: 'bg-red-50 text-red-800 border-red-200',
  unknown: 'bg-amber-50 text-amber-900 border-amber-200',
  not_applicable: 'bg-slate-50 text-slate-500 border-slate-200',
};

export function RequirementStateBadge({ state }) {
  const label = { present: 'Present', missing: 'Missing', unknown: 'Unknown', not_applicable: 'Not applicable' }[state] || state;
  return <Badge variant="outline" className={STATE_STYLES[state] || ''} data-state={state}>{label}</Badge>;
}

/**
 * Requirement-based completeness summary. Deliberately not a single
 * percentage: the counts of present, missing and unknown requirements are
 * shown side by side so a gap is never hidden by a high score.
 */
export function CompletenessChips({ summary, blockingGaps = [] }) {
  if (!summary) return <span className="text-xs text-slate-500">Evidence not yet assembled</span>;
  return (
    <span className="inline-flex flex-wrap gap-1 text-xs" title={blockingGaps.length ? `Missing: ${blockingGaps.join(', ')}` : 'No missing requirements'}>
      <Badge variant="outline" className={STATE_STYLES.present}>{summary.present} present</Badge>
      <Badge variant="outline" className={STATE_STYLES.missing}>{summary.missing} missing</Badge>
      <Badge variant="outline" className={STATE_STYLES.unknown}>{summary.unknown} unknown</Badge>
      {summary.not_applicable ? <Badge variant="outline" className={STATE_STYLES.not_applicable}>{summary.not_applicable} n/a</Badge> : null}
    </span>
  );
}

export function OriginBadge({ section }) {
  if (section.kind === 'facts') {
    return <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">Recorded facts</Badge>;
  }
  if (section.origin === 'ai_assisted') {
    return (
      <Badge variant="outline" className="bg-orange-50 text-orange-900 border-orange-300">
        {section.review_state === 'reviewed' ? 'AI-assisted draft — clinician reviewed' : 'AI-assisted draft — review required'}
      </Badge>
    );
  }
  return <Badge variant="outline" className="bg-blue-50 text-blue-800 border-blue-200">Clinician-authored</Badge>;
}

export function ReviewStateBadge({ state }) {
  const map = {
    not_started: ['Not started', 'bg-slate-50 text-slate-500 border-slate-200'],
    in_progress: ['In progress', 'bg-amber-50 text-amber-900 border-amber-200'],
    reviewed: ['Reviewed', 'bg-emerald-50 text-emerald-800 border-emerald-200'],
    not_applicable: ['Not applicable', 'bg-slate-50 text-slate-500 border-slate-200'],
  };
  const [label, className] = map[state] || [state, ''];
  return <Badge variant="outline" className={className}>{label}</Badge>;
}
