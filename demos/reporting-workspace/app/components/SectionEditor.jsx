import React from 'react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

import { OriginBadge, ReviewStateBadge } from './StatusBadge';

function FactBlock({ block }) {
  const title = block.title ? <h4 className="mt-2 text-xs font-semibold text-slate-700">{block.title}</h4> : null;
  if (block.type === 'paragraph') return <>{title}<p className="text-sm text-slate-700">{block.text}</p></>;
  if (block.type === 'notice') return <>{title}<p className="text-sm italic text-slate-500">{block.text}</p></>;
  if (block.type === 'list') {
    return <>{title}<ul className="list-disc pl-5 text-sm text-slate-700">{block.items.map((item, index) => <li key={index}>{item}</li>)}</ul></>;
  }
  if (block.type === 'key_values') {
    return (
      <>
        {title}
        <table className="demo-kv w-full">
          <tbody>
            {block.entries.map(([key, value]) => (
              <tr key={key}><th>{key}</th><td className={value === 'Not recorded' ? 'italic text-slate-400' : ''}>{value}</td></tr>
            ))}
          </tbody>
        </table>
      </>
    );
  }
  if (block.type === 'table') {
    return (
      <>
        {title}
        <div className="overflow-x-auto">
          <table className="demo-facts-table w-full">
            <thead><tr>{block.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
            <tbody>
              {block.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
        {block.note ? <p className="text-[11px] text-slate-500">{block.note}</p> : null}
      </>
    );
  }
  return null;
}

function SourceChips({ refs, onSelectSource }) {
  if (!refs || refs.length === 0) return <p className="text-[11px] text-slate-400">No source references.</p>;
  return (
    <div className="flex flex-wrap gap-1" data-testid="source-chips">
      {refs.map((sourceId) => (
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
  );
}

/**
 * One report section. Facts sections are read-only structured renderings of
 * the pinned sources; narrative sections are editable by a clinician and
 * carry their origin (clinician or AI-assisted) and review state.
 */
export default function SectionEditor({
  section,
  definition,
  editable,
  value,
  onChange,
  onMarkReviewed,
  onMarkNotApplicable,
  onImportAiDraft,
  onRequestAiDraft,
  aiDrafting,
  aiDraftSources = [],
  onSelectSource,
}) {
  const isFacts = section.kind === 'facts';
  return (
    <section id={`section-${section.key}`} className="rounded-lg border border-slate-200 bg-white p-4" data-section={section.key}>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-slate-900">{section.title}</h3>
          <div className="mt-1 flex flex-wrap gap-1">
            <OriginBadge section={section} />
            {!isFacts ? <ReviewStateBadge state={section.review_state} /> : null}
            {definition?.required === false ? <span className="text-[11px] text-slate-500">Optional</span> : null}
          </div>
        </div>
      </header>
      {isFacts ? (
        <div className="mt-3 space-y-1">
          <p className="text-[11px] text-slate-500">Generated deterministically from the pinned source set. Not editable as free text; refresh the sources to update it.</p>
          {(section.blocks || []).map((block, index) => <FactBlock key={index} block={block} />)}
          <div className="pt-2"><SourceChips refs={section.source_refs} onSelectSource={onSelectSource} /></div>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {definition?.guidance ? <p className="text-xs text-slate-500">{definition.guidance}</p> : null}
          {section.refresh_note ? <p className="rounded bg-amber-50 p-2 text-xs text-amber-900">{section.refresh_note}</p> : null}
          {section.origin === 'ai_assisted' && section.ai_attribution ? (
            <p className="rounded bg-orange-50 p-2 text-xs text-orange-900" data-testid="ai-attribution">
              AI attribution: generation {section.ai_attribution.generation_id || 'unknown'}, task {section.ai_attribution.task_type || 'unknown'}, model {section.ai_attribution.model || 'unknown'}
              {section.ai_attribution.field ? `, imported from field "${section.ai_attribution.field}"` : ''}
              {section.ai_attribution.edited_after_import ? ', edited after import' : ', unedited'}. The clinician must review this text before approval.
            </p>
          ) : null}
          {section.review_state === 'not_applicable' ? (
            <p className="text-sm italic text-slate-500">Not applicable: {section.not_applicable_reason}</p>
          ) : (
            <Textarea
              value={value}
              onChange={(event) => onChange(event.target.value)}
              disabled={!editable}
              rows={6}
              aria-label={`${section.title} text`}
              data-testid={`narrative-${section.key}`}
              placeholder={editable ? 'Clinician-authored text. Facts, dates and scores belong in the generated sections above; write the interpretation here.' : 'No text.'}
            />
          )}
          <SourceChips refs={section.source_refs} onSelectSource={onSelectSource} />
          {editable ? (
            <div className="flex flex-wrap gap-2 pt-1">
              {section.origin === 'ai_assisted' && section.review_state !== 'reviewed' ? (
                <Button size="sm" variant="secondary" onClick={onMarkReviewed} data-testid={`mark-reviewed-${section.key}`}>Mark AI-assisted text as reviewed</Button>
              ) : null}
              {definition?.ai_allowed && aiDraftSources.length > 0 ? (
                aiDraftSources.map((source) => (
                  <Button key={source.source_id} size="sm" variant="outline" onClick={() => onImportAiDraft(source)} data-testid={`import-ai-${section.key}`}>
                    Use pinned AI-assisted draft ({source.label})
                  </Button>
                ))
              ) : null}
              {definition?.ai_allowed ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onRequestAiDraft}
                  title={aiDrafting?.message || ''}
                  data-testid={`ai-draft-${section.key}`}
                >
                  Draft with AI ({aiDrafting?.state === 'configured' ? 'configured' : 'unavailable — fails closed'})
                </Button>
              ) : null}
              {section.review_state !== 'not_applicable' ? (
                <Button size="sm" variant="ghost" onClick={onMarkNotApplicable} data-testid={`not-applicable-${section.key}`}>Mark not applicable…</Button>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
