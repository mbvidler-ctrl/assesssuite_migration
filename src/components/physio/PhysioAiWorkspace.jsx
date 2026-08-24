import React, { useEffect, useMemo, useState } from 'react';
import {
  Bot, Check, Clipboard, Download, Loader2, Printer, RefreshCw, Save,
  Sparkles, TriangleAlert,
} from 'lucide-react';

import { base44 } from '@/api/base44Client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAiCapability } from '@/hooks/useAiCapability';
import { AI_COPY, aiErrorMessage } from '@/lib/aiCapabilities';
import {
  aiDraftFilename,
  createAiDraftExportEnvelope,
  formatAiDraftJson,
  parseAiDraftJson,
  PHYSIO_AI_DRAFT_TASKS,
  physioAiDraftDestination,
} from '@/lib/physio/aiDraft';
import { escapeHtmlText, renderSafeHtmlDocument } from '@/lib/safeHtml';

function humanise(key) {
  return String(key)
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function DraftValue({ value }) {
  if (Array.isArray(value)) {
    if (value.length === 0) return <p className="text-sm italic text-slate-500">None recorded in this draft.</p>;
    return (
      <ul className="space-y-2 pl-5 text-sm text-slate-700">
        {value.map((entry, index) => (
          <li key={index} className="list-disc pl-1">
            {entry && typeof entry === 'object' ? <DraftObject value={entry} compact /> : String(entry)}
          </li>
        ))}
      </ul>
    );
  }
  if (value && typeof value === 'object') return <DraftObject value={value} compact />;
  return <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{String(value ?? '')}</p>;
}

function DraftObject({ value, compact = false }) {
  return (
    <div className={compact ? 'space-y-2' : 'space-y-5'}>
      {Object.entries(value || {}).map(([key, entry]) => (
        <section key={key} className={compact ? '' : 'border-b border-slate-100 pb-5 last:border-0 last:pb-0'}>
          <h4 className={`${compact ? 'text-xs' : 'text-sm'} mb-1.5 font-semibold text-slate-900`}>{humanise(key)}</h4>
          <DraftValue value={entry} />
        </section>
      ))}
    </div>
  );
}

export function PhysioAiWorkspace({
  client,
  careEpisode,
  onDraftGenerated = null,
  onSaveDraft = null,
}) {
  const ai = useAiCapability('physio_ai_tasks');
  const [taskType, setTaskType] = useState('physio.initial_assessment_summary.v1');
  const [additionalContext, setAdditionalContext] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [draftError, setDraftError] = useState('');
  const [result, setResult] = useState(null);
  const [editableJson, setEditableJson] = useState('');
  const [generatedJson, setGeneratedJson] = useState('');
  const [saveReceipt, setSaveReceipt] = useState(null);
  const [generationRequest, setGenerationRequest] = useState(
    /** @type {{ canonicalRequest: string, id: string } | null} */ (null),
  );
  const [copied, setCopied] = useState(false);

  const selectedTask = useMemo(
    () => PHYSIO_AI_DRAFT_TASKS.find((task) => task.id === taskType) || PHYSIO_AI_DRAFT_TASKS[0],
    [taskType],
  );
  const orgId = careEpisode?.org_id || client?.org_id || '';
  const resultTask = useMemo(
    () => PHYSIO_AI_DRAFT_TASKS.find((task) => task.id === result?.taskType) || selectedTask,
    [result?.taskType, selectedTask],
  );
  const destination = result?.taskType ? physioAiDraftDestination(result.taskType) : null;

  useEffect(() => {
    setResult(null);
    setEditableJson('');
    setGeneratedJson('');
    setSaveReceipt(null);
    setGenerationRequest(null);
    setDraftError('');
    setErrorMessage('');
    setCopied(false);
  }, [careEpisode?.id]);

  const readEditedDraft = () => {
    try {
      const parsed = parseAiDraftJson(editableJson);
      setDraftError('');
      return parsed;
    } catch (error) {
      setDraftError(error?.message || 'The edited draft could not be read.');
      return null;
    }
  };

  const selectTask = (nextTaskType) => {
    if (nextTaskType === taskType) return;
    const hasUnsavedEdits = result && !saveReceipt && editableJson !== generatedJson;
    if (hasUnsavedEdits && !window.confirm('Discard the unsaved edits and choose another AI draft?')) return;
    setTaskType(nextTaskType);
    setResult(null);
    setEditableJson('');
    setGeneratedJson('');
    setSaveReceipt(null);
    setGenerationRequest(null);
    setDraftError('');
    setErrorMessage('');
    setCopied(false);
  };

  const generate = async () => {
    const requestedCareEpisodeId = careEpisode?.id;
    const requestedCareEpisodeUpdatedDate = careEpisode?.updated_date;
    if (!orgId || !requestedCareEpisodeId || !requestedCareEpisodeUpdatedDate || !ai.canTrigger || isGenerating) return;
    setIsGenerating(true);
    setErrorMessage('');
    setDraftError('');
    setCopied(false);
    setSaveReceipt(null);
    const canonicalRequest = JSON.stringify({
      careEpisodeId: requestedCareEpisodeId,
      careEpisodeUpdatedDate: requestedCareEpisodeUpdatedDate,
      taskType,
      clinicianContext: additionalContext.trim(),
    });
    const generationRequestId = generationRequest?.canonicalRequest === canonicalRequest
      ? generationRequest.id
      : window.crypto.randomUUID();
    setGenerationRequest({ canonicalRequest, id: generationRequestId });
    try {
      const response = await base44.functions.invoke('physioAiTask', {
        task: taskType,
        org_id: orgId,
        care_episode_id: requestedCareEpisodeId,
        generation_request_id: generationRequestId,
        context: additionalContext.trim()
          ? { clinician_context: additionalContext.trim() }
          : {},
      });
      const payload = response?.data ?? response;
      if (
        !payload?.output ||
        payload?.output_state !== 'ai_draft_unreviewed' ||
        payload?.care_episode_id !== requestedCareEpisodeId ||
        payload?.care_episode_updated_date !== requestedCareEpisodeUpdatedDate ||
        typeof payload?.generation_id !== 'string' ||
        !payload.generation_id
      ) {
        throw new Error('The AI service returned an incomplete draft.');
      }
      const generatedDraftJson = formatAiDraftJson(payload.output);
      setResult({
        ...payload,
        taskType,
        taskLabel: selectedTask.label,
        careEpisodeSnapshot: JSON.stringify(careEpisode),
      });
      setEditableJson(generatedDraftJson);
      setGeneratedJson(generatedDraftJson);
      setGenerationRequest(null);
      onDraftGenerated?.({
        taskType,
        draft: payload.output,
        outputState: payload.output_state,
        ...(payload.provenance ? { provenance: payload.provenance } : {}),
      });
    } catch (error) {
      console.error('Physiotherapy AI task failed:', error);
      const kind = ai.reportError(error);
      setErrorMessage(aiErrorMessage(kind));
    } finally {
      setIsGenerating(false);
    }
  };

  const copyDraft = async () => {
    if (!result?.output) return;
    const editedDraft = readEditedDraft();
    if (!editedDraft) return;
    try {
      await navigator.clipboard.writeText(formatAiDraftJson(editedDraft));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setErrorMessage('The draft could not be copied. Select the text and copy it manually.');
    }
  };

  const buildExport = () => {
    if (!result?.provenance) {
      setDraftError('Generation provenance is missing. This draft cannot be saved or exported.');
      return null;
    }
    const editedDraft = readEditedDraft();
    if (!editedDraft) return null;
    return createAiDraftExportEnvelope({
      taskType: result.taskType,
      draft: editedDraft,
      provenance: result.provenance,
      outputState: result.output_state,
      generatedAt: result.provenance.generated_at,
    });
  };

  const saveDraft = async () => {
    const exportEnvelope = buildExport();
    if (!exportEnvelope || isSaving) return;
    if (typeof onSaveDraft !== 'function') {
      setDraftError('This AI workspace is not connected to a clinical-record save path.');
      return;
    }
    if (JSON.stringify(careEpisode) !== result?.careEpisodeSnapshot) {
      setDraftError('The care episode has unsaved or newer changes. Save it and regenerate this AI draft before review.');
      return;
    }
    setIsSaving(true);
    setDraftError('');
    try {
      const receipt = await onSaveDraft({
        taskType: result.taskType,
        taskLabel: resultTask.label,
        draft: exportEnvelope.draft,
        provenance: result.provenance,
        outputState: result.output_state,
        wasEdited: editableJson !== generatedJson,
        careEpisodeId: result.care_episode_id,
        careEpisodeUpdatedDate: result.care_episode_updated_date,
        generationId: result.generation_id,
      });
      if (!receipt) throw new Error('The clinical record did not confirm the save.');
      setSaveReceipt(receipt);
    } catch (error) {
      console.error('Physiotherapy AI draft save failed:', error);
      setDraftError(error?.message || 'The AI draft could not be saved to the clinical record.');
    } finally {
      setIsSaving(false);
    }
  };

  const downloadDraft = () => {
    const exportEnvelope = buildExport();
    if (!exportEnvelope) return;
    try {
      const blob = new Blob([JSON.stringify(exportEnvelope, null, 2)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = aiDraftFilename(result.taskType, result.provenance?.generated_at);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch {
      setDraftError('The edited draft could not be downloaded. Copy the JSON instead.');
    }
  };

  const printDraft = () => {
    const exportEnvelope = buildExport();
    if (!exportEnvelope) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setDraftError('The print window was blocked. Allow pop-ups for this page and try again.');
      return;
    }
    const printableJson = escapeHtmlText(JSON.stringify(exportEnvelope, null, 2));
    const title = `${resultTask.label} — AI-assisted draft`;
    const rendered = renderSafeHtmlDocument(printWindow, `<!doctype html><html><head><title>${escapeHtmlText(title)}</title><style>body{font-family:Arial,sans-serif;color:#0f172a;padding:32px}h1{font-size:22px;margin:0 0 6px}.meta{color:#64748b;font-size:12px;margin-bottom:22px}pre{white-space:pre-wrap;overflow-wrap:anywhere;border:1px solid #e2e8f0;border-radius:8px;padding:18px;background:#f8fafc;font:12px/1.55 Consolas,monospace}</style></head><body><h1>${escapeHtmlText(title)}</h1><p class="meta">Unreviewed AI output exported with immutable generation provenance. Clinical review remains required.</p><pre>${printableJson}</pre></body></html>`, { title });
    if (!rendered) {
      printWindow.close();
      setDraftError('The edited draft could not be prepared for printing.');
      return;
    }
    window.setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 150);
  };

  return (
    <Card className="border-violet-200/80 bg-gradient-to-br from-white via-white to-violet-50/50 shadow-sm">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-xl border border-violet-200 bg-violet-50 p-2 text-violet-700">
              <Bot className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <CardTitle className="text-base text-slate-900">Physiotherapy AI workspace</CardTitle>
              <CardDescription className="mt-1 max-w-3xl">
                Generate a structured draft from the current care episode and assessment record. Nothing is saved or sent automatically.
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="w-fit border-violet-200 bg-violet-50 text-violet-700">
            <Sparkles className="mr-1 h-3 w-3" aria-hidden="true" />
            AI-assisted draft
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-slate-900">Choose a draft</legend>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {PHYSIO_AI_DRAFT_TASKS.map((task) => {
              const selected = task.id === taskType;
              return (
                <button
                  key={task.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => selectTask(task.id)}
                  className={`rounded-xl border p-3 text-left transition-colors ${
                    selected
                      ? 'border-violet-400 bg-violet-50 ring-1 ring-violet-300'
                      : 'border-slate-200 bg-white hover:border-violet-200 hover:bg-violet-50/40'
                  }`}
                >
                  <span className="block text-sm font-semibold text-slate-900">{task.label}</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">{task.description}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="space-y-2">
          <Label htmlFor="physio-ai-additional-context">Additional clinician context (optional)</Label>
          <Textarea
            id="physio-ai-additional-context"
            value={additionalContext}
            onChange={(event) => {
              setAdditionalContext(event.target.value.slice(0, 16_000));
              setGenerationRequest(null);
            }}
            rows={4}
            placeholder={`Add facts that are not yet represented in the episode record for this ${selectedTask.label.toLowerCase()}.`}
          />
          <p className="text-xs text-slate-500">The server combines this with the episode and assessment data shown on this page.</p>
        </div>

        {!orgId && (
          <Alert variant="destructive">
            <TriangleAlert className="h-4 w-4" />
            <AlertTitle>Organisation required</AlertTitle>
            <AlertDescription>This care episode must belong to an organisation before an AI draft can be generated.</AlertDescription>
          </Alert>
        )}

        {!ai.canTrigger && (
          <Alert>
            <TriangleAlert className="h-4 w-4" />
            <AlertTitle>{AI_COPY.featureName} unavailable</AlertTitle>
            <AlertDescription>{ai.unavailableMessage}</AlertDescription>
          </Alert>
        )}

        {errorMessage && (
          <Alert variant="destructive">
            <TriangleAlert className="h-4 w-4" />
            <AlertTitle>AI operation failed</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        {draftError && (
          <Alert variant="destructive">
            <TriangleAlert className="h-4 w-4" />
            <AlertTitle>Draft action blocked</AlertTitle>
            <AlertDescription>{draftError}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={generate} disabled={!orgId || !ai.canTrigger || isGenerating}>
            {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : result ? <RefreshCw className="mr-2 h-4 w-4" /> : <Sparkles className="mr-2 h-4 w-4" />}
            {isGenerating ? 'Generating…' : result ? `Regenerate ${selectedTask.label}` : `Generate ${selectedTask.label}`}
          </Button>
          <p className="text-xs text-slate-500">Review and edit the result before adding it to the clinical record or using it externally.</p>
        </div>

        {result?.output && (
          <div className="rounded-xl border border-violet-200 bg-white">
            <div className="flex flex-col gap-3 border-b border-violet-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-slate-900">{resultTask.label}</h3>
                  <Badge variant="outline" className={saveReceipt ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}>
                    {saveReceipt ? 'Saved draft' : 'Unreviewed draft'}
                  </Badge>
                </div>
                {result.provenance && (
                  <p className="mt-1 text-xs text-slate-500">
                    Generated {new Date(result.provenance.generated_at).toLocaleString()} · {result.provenance.provider} · {result.provenance.model}
                  </p>
                )}
              </div>
            </div>
            <div className="space-y-5 p-4 sm:p-5">
              <div className="space-y-2">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <Label htmlFor="physio-ai-editable-draft">Edit structured draft</Label>
                    <p className="mt-1 text-xs text-slate-500">Edit any generated field below. The JSON must remain valid before save, copy, download or print.</p>
                  </div>
                  {editableJson !== generatedJson && <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">Clinician edited</Badge>}
                </div>
                <Textarea
                  id="physio-ai-editable-draft"
                  aria-label="Editable AI draft JSON"
                  value={editableJson}
                  onChange={(event) => {
                    setEditableJson(event.target.value);
                    setSaveReceipt(null);
                    if (draftError) setDraftError('');
                  }}
                  onBlur={readEditedDraft}
                  rows={18}
                  spellCheck={false}
                  className="min-h-[26rem] font-mono text-xs leading-5"
                />
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <h4 className="mb-3 text-sm font-semibold text-slate-900">Structured preview</h4>
                {(() => {
                  try {
                    return <DraftObject value={parseAiDraftJson(editableJson)} />;
                  } catch {
                    return <p className="text-sm text-rose-700">Correct the JSON above to restore the structured preview.</p>;
                  }
                })()}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={saveDraft} disabled={isSaving} className="bg-teal-700 hover:bg-teal-800">
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  {isSaving
                    ? 'Saving draft…'
                    : destination === 'soap_note'
                      ? 'Save as SOAP note draft'
                      : 'Save as report draft'}
                </Button>
                <Button type="button" variant="outline" onClick={copyDraft}>
                  {copied ? <Check className="mr-2 h-4 w-4" /> : <Clipboard className="mr-2 h-4 w-4" />}
                  {copied ? 'Copied' : 'Copy edited JSON'}
                </Button>
                <Button type="button" variant="outline" onClick={downloadDraft}>
                  <Download className="mr-2 h-4 w-4" />Download JSON
                </Button>
                <Button type="button" variant="outline" onClick={printDraft}>
                  <Printer className="mr-2 h-4 w-4" />Print draft
                </Button>
              </div>

              {saveReceipt && (
                <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900">
                  <Check className="h-4 w-4" />
                  <AlertTitle>Draft saved to the clinical record</AlertTitle>
                  <AlertDescription>
                    The edited output and generation provenance were saved to this care episode and linked {saveReceipt.linkedEntity === 'SOAPNote' ? 'SOAP note' : 'report'} draft.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default PhysioAiWorkspace;
