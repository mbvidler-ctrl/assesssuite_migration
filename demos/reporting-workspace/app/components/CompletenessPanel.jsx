import React from 'react';

import { RequirementStateBadge } from './StatusBadge';

/**
 * Requirement-based evidence panel. Each requirement shows its state, the
 * reason, and the source ids it relied on. A populated field is reported as
 * present, never as verified.
 */
export default function CompletenessPanel({ completeness, onSelectSource = null, compact = false }) {
  if (!completeness) {
    return <p className="text-sm text-slate-500">Evidence has not been assembled for this request yet.</p>;
  }
  return (
    <div className="space-y-2" data-testid="completeness-panel">
      {!compact ? (
        <p className="text-xs text-slate-500">
          Assessed against template {completeness.template_version}{completeness.assessed_at ? ` at ${completeness.assessed_at}` : ''}. Present means a record exists; it does not mean the record has been verified.
        </p>
      ) : null}
      <ul className="divide-y divide-slate-100 rounded-md border border-slate-200 bg-white">
        {completeness.requirements.map((requirement) => (
          <li key={requirement.key} className="flex flex-col gap-1 p-2 text-sm" data-requirement={requirement.key}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-slate-800">{requirement.label}</span>
              <RequirementStateBadge state={requirement.state} />
            </div>
            <p className="text-xs text-slate-600">{requirement.reason}</p>
            {requirement.evidence.length > 0 && !compact ? (
              <div className="flex flex-wrap gap-1">
                {requirement.evidence.map((sourceId) => (
                  <button
                    key={sourceId}
                    type="button"
                    className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-600 hover:bg-slate-100"
                    onClick={() => onSelectSource && onSelectSource(sourceId)}
                    title={sourceId}
                  >
                    {sourceId.length > 42 ? `${sourceId.slice(0, 40)}…` : sourceId}
                  </button>
                ))}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
