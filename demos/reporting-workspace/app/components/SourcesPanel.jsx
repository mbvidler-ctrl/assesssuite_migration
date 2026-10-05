import React, { useState } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { categoryLabel, formatDate, formatDateTime } from '../lib/format';

function SourceContent({ content }) {
  const entries = Object.entries(content || {}).filter(([, value]) => value !== '' && value !== null && value !== undefined);
  if (entries.length === 0) return <p className="text-xs text-slate-500">No recorded values.</p>;
  return (
    <table className="demo-kv w-full">
      <tbody>
        {entries.map(([key, value]) => (
          <tr key={key}>
            <th>{key.replace(/_/g, ' ')}</th>
            <td className="whitespace-pre-wrap break-words">{typeof value === 'object' ? JSON.stringify(value, null, 1) : String(value)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Pinned SourceSet manifest with staleness reporting. A changed source is
 * reported, never applied: the clinician must refresh explicitly.
 */
export default function SourcesPanel({ sourceSet, pinnedSources = [], staleness, canRefresh, onRefresh, busy, highlightedSource = '' }) {
  const [open, setOpen] = useState(() => new Set(highlightedSource ? [highlightedSource] : []));
  const toggle = (sourceId) => {
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(sourceId)) next.delete(sourceId);
      else next.add(sourceId);
      return next;
    });
  };
  if (!sourceSet) {
    return <p className="text-sm text-slate-500">No source set has been pinned yet.</p>;
  }
  const contentById = new Map(pinnedSources.map((entry) => [entry.source_id, entry.content]));
  return (
    <div className="space-y-3" data-testid="sources-panel">
      {staleness?.is_stale ? (
        <Alert className="border-amber-300 bg-amber-50 text-amber-900" data-testid="staleness-alert">
          <AlertTitle>New evidence available — this draft still uses the pinned sources</AlertTitle>
          <AlertDescription>
            <ul className="mt-1 list-disc pl-5 text-xs">
              {staleness.changed.map((entry) => <li key={`c-${entry.source_id}`}>Changed: {entry.label} ({entry.source_id})</li>)}
              {staleness.added.map((entry) => <li key={`a-${entry.source_id}`}>New: {entry.label} ({entry.source_id})</li>)}
              {staleness.removed.map((entry) => <li key={`r-${entry.source_id}`}>Removed: {entry.label} ({entry.source_id})</li>)}
            </ul>
            {canRefresh ? (
              <Button size="sm" className="mt-2" onClick={onRefresh} disabled={busy} data-testid="refresh-sources">Refresh sources into a new revision</Button>
            ) : (
              <p className="mt-2 text-xs">Refreshing requires an editable draft. An approved report is never changed by a source update; open an amendment instead.</p>
            )}
          </AlertDescription>
        </Alert>
      ) : (
        <p className="text-xs text-emerald-700">Pinned sources match the current records.</p>
      )}
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <dt className="text-slate-500">Source set</dt><dd className="font-mono">{sourceSet.id} (v{sourceSet.version})</dd>
        <dt className="text-slate-500">Pinned</dt><dd>{formatDateTime(sourceSet.created_at)}</dd>
        <dt className="text-slate-500">Manifest hash</dt><dd className="break-all font-mono">{sourceSet.manifest_sha256}</dd>
        <dt className="text-slate-500">Template</dt><dd className="font-mono">{sourceSet.template_version}</dd>
        <dt className="text-slate-500">Generator</dt><dd className="font-mono">{sourceSet.generator_version}</dd>
        <dt className="text-slate-500">Episode version</dt><dd className="font-mono">{sourceSet.episode_version || '—'}</dd>
      </dl>
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Selection rules</h4>
        <ul className="list-disc pl-5 text-xs text-slate-600">
          {sourceSet.selection_rules.map((rule) => <li key={rule}>{rule}</li>)}
        </ul>
      </div>
      {sourceSet.measure_definitions.length > 0 ? (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Measure definitions pinned</h4>
          <ul className="text-xs text-slate-600">
            {sourceSet.measure_definitions.map((definition) => (
              <li key={definition.assessment_id || definition.name}>{definition.name}: {definition.unit || 'no unit'}, {definition.direction}, {definition.scoring_version}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pinned sources ({sourceSet.items.length})</h4>
        <ul className="mt-1 divide-y divide-slate-100 rounded-md border border-slate-200 bg-white">
          {sourceSet.items.map((entry) => (
            <li key={entry.source_id} className={`p-2 text-xs ${highlightedSource === entry.source_id ? 'bg-yellow-50' : ''}`} data-source-id={entry.source_id}>
              <button type="button" className="flex w-full items-start justify-between gap-2 text-left" onClick={() => toggle(entry.source_id)}>
                <span>
                  <span className="font-medium text-slate-800">{entry.label}</span>
                  <span className="ml-1 text-slate-500">{categoryLabel(entry.category)}{entry.recorded_at ? `, ${formatDate(entry.recorded_at)}` : ''}</span>
                  {entry.ai_assisted ? <Badge variant="outline" className="ml-1 border-orange-300 bg-orange-50 text-orange-900">AI-assisted</Badge> : null}
                  {entry.flags.includes('unpublished_note') ? <Badge variant="outline" className="ml-1">Unpublished</Badge> : null}
                </span>
                <span className="font-mono text-[10px] text-slate-400">{entry.content_sha256.slice(0, 10)}</span>
              </button>
              {open.has(entry.source_id) ? (
                <div className="mt-2 rounded bg-slate-50 p-2">
                  <p className="mb-1 font-mono text-[10px] text-slate-500">{entry.source_id} · {entry.entity}{entry.path ? ` · ${entry.path}` : ''} · version {entry.record_version || 'n/a'}</p>
                  <SourceContent content={contentById.get(entry.source_id)} />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
