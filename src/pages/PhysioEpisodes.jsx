import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { getProfession } from '../../packages/profession-config/index.mjs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Toaster, toast } from 'sonner';
import {
  Activity, ArrowRight, CalendarDays, CheckCircle2, ClipboardList, Dumbbell,
  FileCheck2, FileHeart, Flag, HeartPulse, History, Loader2, Plus, Save,
  Stethoscope, Target, Trash2,
} from 'lucide-react';
import {
  CareEpisodeSection, EmptyState, Field, StatusBadge,
} from '@/components/physio/CareEpisodeSection';
import InitialAssessmentWorkspace from '@/components/physio/InitialAssessmentWorkspace';
import PhysioAiWorkspace from '@/components/physio/PhysioAiWorkspace';
import ClientSOAPNotes from '@/components/client/ClientSOAPNotes';
import SavedReports from '@/components/client/SavedReports';
import ClientDocuments from '@/components/client/ClientDocuments';
import {
  completeDischarge,
  createEpisodeDraft,
  deriveEncounters,
  deriveOutcomeMeasures,
  localEpisodeId as uid,
  normalizeEpisode,
  prepareEpisodePayload,
  reopenEpisode,
  transitionEpisodeStatus,
} from '@/lib/physio/careEpisode';
import {
  episodeLinkedQuery,
  labelLegacyUnassignedRecord,
  legacyUnassignedQuery,
  withEpisodeLink,
} from '@/lib/physio/episodeLinkage';
import { physioAiDraftDestination } from '@/lib/physio/aiDraft';

const activeProfession = getProfession(import.meta.env.VITE_PROFESSION);

const today = () => new Date().toISOString().slice(0, 10);
const displayDate = (value) => value
  ? new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))
  : 'Not recorded';
const labelize = (value) => String(value || '').replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase());

function CompactInput({ label, value, onChange, type = 'text', placeholder = '', min = undefined, max = undefined }) {
  return (
    <div>
      <Label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</Label>
      <Input aria-label={label} type={type} value={value ?? ''} min={min} max={max} placeholder={placeholder} onChange={(event) => onChange(type === 'number' ? event.target.value : event.target.value)} />
    </div>
  );
}

function CompactSelect({ label, value, onChange, options }) {
  return (
    <div>
      <Label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</Label>
      <select aria-label={label} value={value || ''} onChange={(event) => onChange(event.target.value)} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20">
        {options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}
      </select>
    </div>
  );
}

export default function PhysioEpisodes() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [clients, setClients] = useState([]);
  const [episodes, setEpisodes] = useState([]);
  const [draft, setDraft] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lifecycleReason, setLifecycleReason] = useState('');
  const [orgId, setOrgId] = useState('');
  const [currentUserId, setCurrentUserId] = useState('');
  const [sourceData, setSourceData] = useState({
    assessments: [],
    notes: [],
    reports: [],
    documents: [],
    catalogue: [],
    unassignedRecords: [],
  });
  const [loadError, setLoadError] = useState('');
  const clientId = searchParams.get('client_id') || '';
  const episodeId = searchParams.get('episode_id') || '';

  const client = useMemo(() => clients.find((item) => item.id === clientId) || clients[0], [clients, clientId]);

  useEffect(() => {
    if (activeProfession.id !== 'physio') return;
    async function loadPatients() {
      setIsLoading(true);
      setLoadError('');
      try {
        const me = await base44.auth.me();
        const memberships = await base44.entities.OrganizationMember.filter({ user_email: me.email });
        const selectedOrgId = (memberships.find((item) => item.is_primary) || memberships[0])?.org_id;
        if (!selectedOrgId) throw new Error('No organisation membership found');
        const patientRows = await base44.entities.Client.filter({ org_id: selectedOrgId });
        setOrgId(selectedOrgId);
        setCurrentUserId(me.id || '');
        setClients(patientRows.filter((item) => !item.is_archived));
        if (!clientId && patientRows[0]) setSearchParams({ client_id: patientRows[0].id }, { replace: true });
      } catch (error) {
        console.error(error);
        setLoadError(error?.message || 'The physiotherapy workspace could not load clients.');
        toast.error('The physiotherapy workspace could not load patients.');
      } finally {
        setIsLoading(false);
      }
    }
    loadPatients();
  }, []);

  useEffect(() => {
    if (!client?.id || !orgId) return;
    async function loadEpisodeWorkspace() {
      setIsLoading(true);
      setLoadError('');
      try {
        const [episodeRows, catalogue] = await Promise.all([
          base44.entities.PhysioCareEpisode.filter({ client_id: client.id, org_id: orgId }),
          base44.entities.Assessment.list(),
        ]);
        const sortedEpisodes = episodeRows.sort((a, b) => Number(b.episode_number || 0) - Number(a.episode_number || 0));
        const normalizedEpisodes = sortedEpisodes.map((episode) => normalizeEpisode(episode));
        const selected = normalizedEpisodes.find((item) => item.id === episodeId) || normalizedEpisodes[0];
        const linkedQuery = selected?.id
          ? episodeLinkedQuery({ clientId: client.id, episodeId: selected.id })
          : null;
        const unassignedQuery = legacyUnassignedQuery({ clientId: client.id });
        const [
          assessments,
          notes,
          savedReports,
          clientReports,
          documents,
          unassignedAssessments,
          unassignedNotes,
          unassignedSavedReports,
          unassignedClientReports,
          unassignedDocuments,
        ] = await Promise.all([
          linkedQuery ? base44.entities.ClientAssessment.filter(linkedQuery) : [],
          linkedQuery ? base44.entities.SOAPNote.filter(linkedQuery) : [],
          linkedQuery ? base44.entities.SavedReport.filter(linkedQuery).catch(() => []) : [],
          linkedQuery ? base44.entities.ClientReport.filter(linkedQuery).catch(() => []) : [],
          linkedQuery ? base44.entities.ClientDocument.filter(linkedQuery).catch(() => []) : [],
          base44.entities.ClientAssessment.filter(unassignedQuery),
          base44.entities.SOAPNote.filter(unassignedQuery),
          base44.entities.SavedReport.filter(unassignedQuery).catch(() => []),
          base44.entities.ClientReport.filter(unassignedQuery).catch(() => []),
          base44.entities.ClientDocument.filter(unassignedQuery).catch(() => []),
        ]);
        const reports = [...(savedReports || []), ...(clientReports || [])];
        const unassignedRecords = [
          ...(unassignedAssessments || []).map((record) => ({ entityName: 'ClientAssessment', record })),
          ...(unassignedNotes || []).map((record) => ({ entityName: 'SOAPNote', record })),
          ...(unassignedSavedReports || []).map((record) => ({ entityName: 'SavedReport', record })),
          ...(unassignedClientReports || []).map((record) => ({ entityName: 'ClientReport', record })),
          ...(unassignedDocuments || []).map((record) => ({ entityName: 'ClientDocument', record })),
        ];
        setEpisodes(normalizedEpisodes);
        setSourceData({ assessments, notes, reports, documents, catalogue, unassignedRecords });
        setDraft(selected ? normalizeEpisode({
          ...selected,
          outcome_measures: deriveOutcomeMeasures(assessments, catalogue),
          encounters: deriveEncounters(notes),
        }) : createEpisodeDraft({
          client,
          episodeNumber: 1,
          clientAssessments: [],
          catalogue,
          notes: [],
          reports: [],
          orgId,
          primaryPractitionerId: currentUserId,
        }));
        if (selected && selected.id !== episodeId) {
          setSearchParams({ client_id: client.id, episode_id: selected.id }, { replace: true });
        }
      } catch (error) {
        console.error(error);
        setLoadError(error?.message || 'The care episode could not be loaded.');
        toast.error('The care episode could not be loaded.');
      } finally {
        setIsLoading(false);
      }
    }
    loadEpisodeWorkspace();
  }, [client?.id, episodeId, orgId, currentUserId]);

  if (activeProfession.id !== 'physio') return <Navigate to="/Dashboard" replace />;

  const setRoot = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
  const setNested = (group, key, value) => setDraft((current) => ({
    ...current,
    [group]: { ...(current[group] || {}), [key]: value },
  }));
  const setArrayItem = (group, id, key, value) => setDraft((current) => ({
    ...current,
    [group]: (current[group] || []).map((item) => item.id === id ? { ...item, [key]: value } : item),
  }));
  const removeArrayItem = (group, id) => setDraft((current) => ({
    ...current,
    [group]: (current[group] || []).filter((item) => item.id !== id),
  }));

  const saveEpisode = async (episodeToSave = draft, { notify = true } = {}) => {
    if (!episodeToSave || !client || !orgId) return null;
    setIsSaving(true);
    try {
      const payload = prepareEpisodePayload(episodeToSave, {
        orgId,
        clientId: client.id,
      });
      const saved = episodeToSave.id
        ? await base44.entities.PhysioCareEpisode.update(episodeToSave.id, payload)
        : await base44.entities.PhysioCareEpisode.create(payload);
      const normalizedSaved = normalizeEpisode(saved);
      setDraft(normalizedSaved);
      setEpisodes((current) => [normalizedSaved, ...current.filter((item) => item.id !== normalizedSaved.id)]
        .sort((a, b) => Number(b.episode_number || 0) - Number(a.episode_number || 0)));
      setSearchParams({ client_id: client.id, episode_id: saved.id }, { replace: true });
      if (notify) toast.success(episodeToSave.id ? 'Care episode saved.' : 'Care episode started.');
      return normalizedSaved;
    } catch (error) {
      console.error(error);
      if (notify) toast.error('The care episode could not be saved.');
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  const saveAiDraftToClinicalRecord = async ({
    taskType,
    draft: editedDraft,
    careEpisodeId,
    careEpisodeUpdatedDate,
    generationId,
  }) => {
    if (!careEpisodeId || careEpisodeId !== draft?.id) {
      throw new Error('This AI draft belongs to a different care episode. Regenerate it in the selected episode.');
    }
    if (!careEpisodeUpdatedDate || careEpisodeUpdatedDate !== draft.updated_date) {
      throw new Error('The care episode changed after this AI draft was generated. Save it and regenerate the draft.');
    }

    const response = await base44.functions.invoke('savePhysioAiGeneration', {
      generation_id: generationId,
      edited_output: editedDraft,
      save_request_id: `physio-save-${generationId}`,
      expected_episode_updated_date: careEpisodeUpdatedDate,
    });
    const receipt = response?.data ?? response;
    const destination = physioAiDraftDestination(taskType);
    const linkedRecord = receipt?.linked_record;
    const savedEpisode = receipt?.care_episode;
    if (!linkedRecord?.id || !savedEpisode?.id || savedEpisode.id !== careEpisodeId) {
      throw new Error('The server did not confirm the atomic AI draft save. Reload before retrying.');
    }
    const normalizedSaved = normalizeEpisode(savedEpisode);
    setDraft(normalizedSaved);
    setEpisodes((current) => [normalizedSaved, ...current.filter((item) => item.id !== normalizedSaved.id)]
      .sort((a, b) => Number(b.episode_number || 0) - Number(a.episode_number || 0)));

    setSourceData((current) => destination === 'soap_note'
      ? { ...current, notes: [linkedRecord, ...current.notes] }
      : { ...current, reports: [linkedRecord, ...current.reports] });
    toast.success(destination === 'soap_note'
      ? 'AI draft saved to the episode and a SOAP note draft.'
      : 'AI draft saved to the episode and a report draft.');
    return {
      aiDraftId: normalizedSaved.reporting?.latest_ai_draft?.id,
      linkedEntity: receipt.linked_entity,
      linkedRecordId: linkedRecord.id,
      episodeId: savedEpisode.id,
    };
  };

  const startNewEpisode = () => {
    const next = Math.max(0, ...episodes.map((item) => Number(item.episode_number || 0))) + 1;
    setSourceData((current) => ({
      ...current,
      assessments: [],
      notes: [],
      reports: [],
      documents: [],
    }));
    setDraft(createEpisodeDraft({
      client,
      episodeNumber: next,
      clientAssessments: [],
      catalogue: sourceData.catalogue,
      notes: [],
      reports: [],
      orgId,
      primaryPractitionerId: currentUserId,
    }));
    setSearchParams({ client_id: client.id });
  };

  const assignLegacyRecord = async (entityName, record) => {
    if (!draft?.id) {
      toast.error('Save this care episode before assigning an older patient record.');
      return;
    }
    try {
      const linked = await base44.entities[entityName].update(
        record.id,
        withEpisodeLink(
          { expected_updated_date: record.updated_date },
          draft.id,
        ),
      );
      setSourceData((current) => {
        const next = {
          ...current,
          unassignedRecords: current.unassignedRecords.filter((item) => !(
            item.entityName === entityName && item.record.id === record.id
          )),
        };
        if (entityName === 'ClientAssessment') next.assessments = [linked, ...current.assessments];
        else if (entityName === 'SOAPNote') next.notes = [linked, ...current.notes];
        else if (entityName === 'ClientDocument') next.documents = [linked, ...current.documents];
        else next.reports = [linked, ...current.reports];
        return next;
      });
      setDraft((current) => normalizeEpisode({
        ...current,
        ...(entityName === 'ClientAssessment'
          ? { outcome_measures: deriveOutcomeMeasures([linked, ...sourceData.assessments], sourceData.catalogue) }
          : {}),
        ...(entityName === 'SOAPNote'
          ? { encounters: deriveEncounters([linked, ...sourceData.notes]) }
          : {}),
      }));
      toast.success('Older record assigned to this care episode.');
    } catch (error) {
      console.error(error);
      toast.error(error?.message || 'The older record could not be assigned.');
    }
  };

  const openEpisodeAssessmentLibrary = () => {
    if (!draft?.id) {
      toast.error('Save this care episode before starting an assessment.');
      return;
    }
    const returnTo = `${window.location.origin}${createPageUrl(`PhysioEpisodes?client_id=${client.id}&episode_id=${draft.id}`)}`;
    navigate(createPageUrl(
      `AssessmentLibrary?mode=run&clientId=${client.id}&careEpisodeId=${draft.id}&returnTo=${encodeURIComponent(returnTo)}`,
    ));
  };

  const applyLifecycleTransition = async (target) => {
    try {
      const transitioned = target === 'discharged'
        ? completeDischarge(draft, { reason: lifecycleReason })
        : target === 'active' && ['discharged', 'cancelled'].includes(draft.status)
          ? reopenEpisode(draft, { reason: lifecycleReason })
          : transitionEpisodeStatus(draft, target, { reason: lifecycleReason });
      const saved = await saveEpisode(transitioned);
      if (saved) setLifecycleReason('');
    } catch (error) {
      toast.error(error?.message || 'The episode status could not be changed.');
    }
  };

  if (isLoading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-teal-600" /></div>;
  }

  if (!client) {
    return <div className="mx-auto max-w-2xl p-10"><EmptyState>{loadError || 'No clients are available. Add a client before starting an episode of care.'}</EmptyState></div>;
  }

  if (!draft) {
    return <div className="mx-auto max-w-2xl p-10"><EmptyState>{loadError || 'The episode workspace could not be prepared.'}</EmptyState></div>;
  }

  const referral = draft.referral || {};
  const findings = draft.initial_findings || {};
  const reporting = draft.reporting || {};
  const sessionLimit = Number(referral.approved_sessions || 0);
  const sessionUsage = sessionLimit ? Math.min(100, (Number(referral.sessions_used || 0) / sessionLimit) * 100) : 0;
  const lifecycleActions = {
    draft: [['active', 'Activate episode'], ['cancelled', 'Cancel episode']],
    active: [['on_hold', 'Put on hold'], ['cancelled', 'Cancel episode'], ['discharged', 'Complete discharge']],
    on_hold: [['active', 'Resume episode'], ['cancelled', 'Cancel episode'], ['discharged', 'Complete discharge']],
    discharged: [['active', 'Reopen episode']],
    cancelled: [['active', 'Reopen episode']],
  }[draft.status] || [];

  return (
    <div className="min-h-screen bg-slate-50/60">
      <Toaster position="top-right" richColors />
      <div className="border-b border-slate-200 bg-gradient-to-r from-teal-950 via-teal-900 to-slate-900 text-white">
        <div className="mx-auto max-w-[1500px] px-5 py-7 lg:px-8">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-teal-200"><HeartPulse className="h-4 w-4" /> Physiotherapy workspace</div>
              <h1 className="text-3xl font-semibold tracking-tight">{client.full_name}</h1>
              <p className="mt-1 text-sm text-teal-100/80">One clinical thread from referral and first findings through treatment, outcomes and discharge.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-[240px_220px_auto]">
              <select aria-label="Patient" value={client.id} onChange={(event) => setSearchParams({ client_id: event.target.value })} className="h-10 rounded-lg border border-white/20 bg-white/10 px-3 text-sm text-white outline-none backdrop-blur [&>option]:text-slate-900">
                {clients.map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}
              </select>
              <select aria-label="Episode of care" value={draft.id || ''} onChange={(event) => { const selectedEpisode = episodes.find((item) => item.id === event.target.value); if (selectedEpisode) { setDraft(normalizeEpisode(selectedEpisode)); setSearchParams({ client_id: client.id, episode_id: selectedEpisode.id }); } }} disabled={!episodes.length} className="h-10 rounded-lg border border-white/20 bg-white/10 px-3 text-sm text-white outline-none disabled:opacity-50 [&>option]:text-slate-900">
                {!episodes.length && <option value="">Unsaved episode 1</option>}
                {episodes.map((item) => <option key={item.id} value={item.id}>Episode {item.episode_number}: {item.title || 'Untitled'}</option>)}
              </select>
              <Button onClick={startNewEpisode} className="bg-white text-teal-900 hover:bg-teal-50"><Plus className="mr-2 h-4 w-4" />New episode</Button>
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto grid max-w-[1500px] gap-6 px-5 py-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:px-8">
        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Episode {draft.episode_number}</p><h2 className="mt-1 text-lg font-semibold text-slate-900">{draft.title || 'Untitled episode'}</h2></div>
              <StatusBadge status={draft.status} />
            </div>
            <div className="mt-5 space-y-4">
              <Field label="Started" value={displayDate(draft.episode_start_date)} />
              <Field label="Funding" value={labelize(referral.funding_source)} />
              <Field label="Consultations" value={`${referral.sessions_used || draft.encounters?.length || 0}${referral.approved_sessions ? ` of ${referral.approved_sessions}` : ''}`} />
              <Field label="Next referrer update" value={displayDate(reporting.referrer_update_due)} />
            </div>
            {sessionLimit > 0 && <div className="mt-4"><Progress value={sessionUsage} className="h-2" /><p className="mt-1 text-xs text-slate-500">{Math.max(0, sessionLimit - Number(referral.sessions_used || 0))} approved consultations remaining</p></div>}
            <Button onClick={() => saveEpisode()} disabled={isSaving} className="mt-5 w-full bg-teal-700 hover:bg-teal-800">
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}{draft.id ? 'Save episode' : 'Start and save episode'}
            </Button>
          </div>
          <div className="rounded-2xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-900">
            <div className="flex gap-3"><FileHeart className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-semibold">Source-linked workspace</p><p className="mt-1 text-teal-800/80">Outcome measures, consultation notes and reports are composed from the patient record. Episode-only planning fields are saved here.</p></div></div>
          </div>
        </aside>

        <div className="space-y-5">
          <CareEpisodeSection icon={Activity} title="Episode overview" description="Working diagnosis, presentation and expected course.">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <CompactInput label="Episode title" value={draft.title} onChange={(value) => setRoot('title', value)} placeholder="e.g. Right ACL rehabilitation" />
              <div><Label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Status</Label><div className="flex h-10 items-center rounded-md border border-slate-200 bg-slate-50 px-3"><StatusBadge status={draft.status} /></div></div>
              <CompactInput label="Body region" value={draft.body_region} onChange={(value) => setRoot('body_region', value)} placeholder="e.g. Right knee" />
              <CompactInput label="Episode started" type="date" value={draft.episode_start_date} onChange={(value) => setRoot('episode_start_date', value)} />
              <div className="md:col-span-2 xl:col-span-3"><Label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Presenting problem</Label><Textarea value={draft.presenting_problem || ''} onChange={(event) => setRoot('presenting_problem', event.target.value)} className="min-h-20" /></div>
              <div className="space-y-4"><CompactInput label="Onset date" type="date" value={draft.onset_date} onChange={(value) => setRoot('onset_date', value)} /><CompactInput label="Target discharge" type="date" value={draft.target_discharge_date} onChange={(value) => setRoot('target_discharge_date', value)} /></div>
            </div>
          </CareEpisodeSection>

          <CareEpisodeSection icon={ClipboardList} title="Referral and funding" description="Payer, authorisation and referrer information for this episode." tone="violet">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <CompactSelect label="Referral source" value={referral.source} onChange={(value) => setNested('referral', 'source', value)} options={[["self_referral", "Self referral"], ["gp", "General practitioner"], ["specialist", "Specialist"], ["case_manager", "Case manager"], ["other", "Other"]]} />
              <CompactInput label="Referrer" value={referral.referrer_name} onChange={(value) => setNested('referral', 'referrer_name', value)} />
              <CompactInput label="Referral date" type="date" value={referral.referral_date} onChange={(value) => setNested('referral', 'referral_date', value)} />
              <CompactSelect label="Funding" value={referral.funding_source} onChange={(value) => setNested('referral', 'funding_source', value)} options={[["self_funded", "Self funded"], ["private_health", "Private health"], ["medicare", "Medicare CDM"], ["workcover_qld", "WorkCover"], ["dva", "DVA"], ["ndis", "NDIS"], ["other", "Other"]]} />
              <div className="md:col-span-2"><CompactInput label="Referral reason" value={referral.reason} onChange={(value) => setNested('referral', 'reason', value)} /></div>
              <CompactInput label="Claim / plan number" value={referral.claim_or_plan_number} onChange={(value) => setNested('referral', 'claim_or_plan_number', value)} />
              <CompactInput label="Authorisation expiry" type="date" value={referral.authorization_expiry} onChange={(value) => setNested('referral', 'authorization_expiry', value)} />
              <CompactInput label="Approved consultations" type="number" min="0" value={referral.approved_sessions} onChange={(value) => setNested('referral', 'approved_sessions', value)} />
              <CompactInput label="Consultations used" type="number" min="0" value={referral.sessions_used} onChange={(value) => setNested('referral', 'sessions_used', value)} />
            </div>
          </CareEpisodeSection>

          <InitialAssessmentWorkspace
            episode={draft}
            onChange={setDraft}
            onPersist={saveEpisode}
            isSaving={isSaving}
          />

          <CareEpisodeSection icon={Stethoscope} title="Initial findings snapshot" description="The clinically meaningful baseline captured when this episode opened.">
            <div className="grid gap-4 md:grid-cols-2">
              <div><Label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Subjective summary</Label><Textarea value={findings.subjective_summary || ''} onChange={(event) => setNested('initial_findings', 'subjective_summary', event.target.value)} className="min-h-28" /></div>
              <div><Label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Objective summary</Label><Textarea value={findings.objective_summary || ''} onChange={(event) => setNested('initial_findings', 'objective_summary', event.target.value)} className="min-h-28" /></div>
              <div><Label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Physiotherapy diagnosis / clinical impression</Label><Textarea value={findings.physiotherapy_diagnosis || ''} onChange={(event) => setNested('initial_findings', 'physiotherapy_diagnosis', event.target.value)} className="min-h-24" /></div>
              <div className="space-y-4"><CompactSelect label="Red flag screen" value={findings.red_flag_status} onChange={(value) => setNested('initial_findings', 'red_flag_status', value)} options={[["not_recorded", "Not recorded"], ["clear", "Clear"], ["managed", "Present — managed"], ["referred", "Present — referred"]]} /><CompactInput label="Precautions / treatment limits" value={findings.precautions} onChange={(value) => setNested('initial_findings', 'precautions', value)} /></div>
            </div>
          </CareEpisodeSection>

          <CareEpisodeSection icon={Target} title="Goals" description="Patient-centred, dated goals that guide progression." action={<Button variant="outline" size="sm" onClick={() => setRoot('goals', [...(draft.goals || []), { id: uid('goal'), description: '', target_date: '', status: 'planned' }])}><Plus className="mr-1.5 h-4 w-4" />Add goal</Button>}>
            {!draft.goals?.length ? <EmptyState>No episode goals yet.</EmptyState> : <div className="space-y-3">{draft.goals.map((goal) => <div key={goal.id} className="grid gap-3 rounded-xl border border-slate-200 p-4 md:grid-cols-[minmax(0,1fr)_160px_150px_auto] md:items-end"><CompactInput label="Functional goal" value={goal.description} onChange={(value) => setArrayItem('goals', goal.id, 'description', value)} /><CompactInput label="Target date" type="date" value={goal.target_date} onChange={(value) => setArrayItem('goals', goal.id, 'target_date', value)} /><CompactSelect label="Status" value={goal.status} onChange={(value) => setArrayItem('goals', goal.id, 'status', value)} options={[["planned", "Planned"], ["in_progress", "In progress"], ["achieved", "Achieved"], ["paused", "Paused"]]} /><Button variant="ghost" size="icon" aria-label="Remove goal" onClick={() => removeArrayItem('goals', goal.id)}><Trash2 className="h-4 w-4 text-slate-500" /></Button></div>)}</div>}
          </CareEpisodeSection>

          <CareEpisodeSection
            icon={History}
            title="Repeated measures and outcomes"
            description="Baseline-to-current change across measures recorded inside this care episode."
            tone="violet"
            action={(
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={openEpisodeAssessmentLibrary}>
                  <ClipboardList className="mr-1.5 h-4 w-4" />Run assessment
                </Button>
                <Button variant="outline" size="sm" onClick={() => setRoot('outcome_measures', [...(draft.outcome_measures || []), { id: uid('measure'), name: '', baseline_value: '', current_value: '', target_value: '', unit: '', last_measured_date: today() }])}>
                  <Plus className="mr-1.5 h-4 w-4" />Add manual measure
                </Button>
              </div>
            )}
          >
            {!draft.outcome_measures?.length ? <EmptyState>No completed outcome measures are linked to this episode yet.</EmptyState> : <div className="grid gap-3 xl:grid-cols-2">{draft.outcome_measures.map((measure) => {
              const hasPair = measure.baseline_value !== '' && measure.current_value !== '' && measure.baseline_value != null && measure.current_value != null; const baseline = Number(measure.baseline_value); const current = Number(measure.current_value); const change = hasPair && Number.isFinite(current - baseline) ? current - baseline : null;
              return <div key={measure.id} className="rounded-xl border border-slate-200 p-4"><div className="mb-3 flex items-start justify-between"><div><Input aria-label="Measure name" value={measure.name || ''} onChange={(event) => setArrayItem('outcome_measures', measure.id, 'name', event.target.value)} className="h-8 border-0 px-0 font-semibold shadow-none focus-visible:ring-0" /><p className="text-xs text-slate-500">Last measured {displayDate(measure.last_measured_date)}</p></div>{change !== null && <div className="rounded-lg bg-teal-50 px-2.5 py-1 text-sm font-semibold text-teal-700">{change > 0 ? '+' : ''}{change} {measure.unit}</div>}</div><div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><CompactInput label="Baseline" type="number" value={measure.baseline_value} onChange={(value) => setArrayItem('outcome_measures', measure.id, 'baseline_value', value)} /><CompactInput label="Current" type="number" value={measure.current_value} onChange={(value) => setArrayItem('outcome_measures', measure.id, 'current_value', value)} /><CompactInput label="Target" type="number" value={measure.target_value} onChange={(value) => setArrayItem('outcome_measures', measure.id, 'target_value', value)} /><CompactInput label="Unit" value={measure.unit} onChange={(value) => setArrayItem('outcome_measures', measure.id, 'unit', value)} /></div></div>;
            })}</div>}
          </CareEpisodeSection>

          <CareEpisodeSection icon={CalendarDays} title="Encounters and treatment" description="Consultations derived from SOAP notes, with episode-level treatment and response context." action={<Button variant="outline" size="sm" onClick={() => setRoot('encounters', [{ id: uid('encounter'), date: new Date().toISOString(), type: 'treatment', summary: '', treatments: [], response: '', next_plan: '' }, ...(draft.encounters || [])])}><Plus className="mr-1.5 h-4 w-4" />Add encounter</Button>}>
            {!draft.encounters?.length ? <EmptyState>No consultations linked to this episode.</EmptyState> : <div className="relative space-y-4 before:absolute before:bottom-4 before:left-[11px] before:top-4 before:w-px before:bg-slate-200">{draft.encounters.map((encounter) => <div key={encounter.id} className="relative grid grid-cols-[24px_minmax(0,1fr)] gap-3"><div className="z-10 mt-1 h-6 w-6 rounded-full border-4 border-white bg-teal-600" /><div className="rounded-xl border border-slate-200 p-4"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><StatusBadge status={encounter.type} /><span className="text-sm text-slate-500">{displayDate(encounter.date)}</span>{encounter.soap_note_id && <span className="text-xs text-teal-700">Linked SOAP note</span>}</div><Button variant="ghost" size="icon" aria-label="Remove encounter" onClick={() => removeArrayItem('encounters', encounter.id)}><Trash2 className="h-4 w-4 text-slate-400" /></Button></div><div className="grid gap-3 md:grid-cols-2"><CompactInput label="Clinical summary" value={encounter.summary} onChange={(value) => setArrayItem('encounters', encounter.id, 'summary', value)} /><CompactInput label="Treatment delivered" value={(encounter.treatments || []).join('; ')} onChange={(value) => setArrayItem('encounters', encounter.id, 'treatments', value.split(';').map((item) => item.trim()).filter(Boolean))} /><CompactInput label="Response" value={encounter.response} onChange={(value) => setArrayItem('encounters', encounter.id, 'response', value)} /><CompactInput label="Next plan" value={encounter.next_plan} onChange={(value) => setArrayItem('encounters', encounter.id, 'next_plan', value)} /></div></div></div>)}</div>}
          </CareEpisodeSection>

          <CareEpisodeSection
            icon={ClipboardList}
            title="Older unassigned patient records"
            description="Records created before care-episode linking are never included silently. Review each item and explicitly assign it to this episode only when it belongs here."
            tone="amber"
          >
            {!sourceData.unassignedRecords.length
              ? <EmptyState>No older unassigned assessments, notes, reports or documents.</EmptyState>
              : (
                <div className="space-y-2">
                  {sourceData.unassignedRecords.map(({ entityName, record }) => (
                    <div key={`${entityName}-${record.id}`} className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50/50 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{labelLegacyUnassignedRecord(entityName, record)}</p>
                        <p className="mt-1 text-xs text-slate-600">{labelize(entityName)} · Legacy unassigned · {displayDate(record.assessment_date || record.note_date || record.report_date || record.created_date)}</p>
                      </div>
                      <Button variant="outline" size="sm" disabled={!draft.id} onClick={() => assignLegacyRecord(entityName, record)}>
                        Assign to episode {draft.episode_number}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
          </CareEpisodeSection>

          <CareEpisodeSection icon={FileHeart} title="Clinical notes and report workspace" description="Create and review SOAP notes, saved reports and episode-linked correspondence in the client record." tone="violet">
            {!draft.id
              ? <EmptyState>Save this care episode before creating episode-linked notes, reports, documents or AI drafts.</EmptyState>
              : (
                <div className="space-y-4">
                  <ClientSOAPNotes key={`notes-${client.id}-${draft.id}-${sourceData.notes.length}`} client={client} careEpisodeId={draft.id} />
                  <SavedReports key={`reports-${client.id}-${draft.id}-${sourceData.reports.length}`} client={client} careEpisodeId={draft.id} />
                  <ClientDocuments key={`documents-${client.id}-${draft.id}-${sourceData.documents.length}`} clientId={client.id} client={client} careEpisodeId={draft.id} />
                  <PhysioAiWorkspace
                    client={client}
                    careEpisode={draft}
                    onSaveDraft={saveAiDraftToClinicalRecord}
                  />
                </div>
              )}
          </CareEpisodeSection>

          <CareEpisodeSection icon={Dumbbell} title="Home program prescriptions" description="The current patient-facing exercise or self-management plan." tone="amber" action={<Button variant="outline" size="sm" onClick={() => setRoot('home_programs', [...(draft.home_programs || []), { id: uid('program'), name: '', status: 'current', prescribed_date: today(), review_date: '', dosage: '', adherence: '', instructions: '' }])}><Plus className="mr-1.5 h-4 w-4" />Prescribe program</Button>}>
            {!draft.home_programs?.length ? <EmptyState>No home program has been prescribed for this episode.</EmptyState> : <div className="grid gap-3 xl:grid-cols-2">{draft.home_programs.map((program) => <div key={program.id} className="rounded-xl border border-slate-200 p-4"><div className="mb-4 flex justify-between"><StatusBadge status={program.status} /><Button variant="ghost" size="icon" aria-label="Remove home program" onClick={() => removeArrayItem('home_programs', program.id)}><Trash2 className="h-4 w-4 text-slate-400" /></Button></div><div className="grid gap-3 sm:grid-cols-2"><CompactInput label="Program name" value={program.name} onChange={(value) => setArrayItem('home_programs', program.id, 'name', value)} /><CompactSelect label="Status" value={program.status} onChange={(value) => setArrayItem('home_programs', program.id, 'status', value)} options={[["current", "Current"], ["superseded", "Superseded"], ["completed", "Completed"]]} /><CompactInput label="Dosage" value={program.dosage} onChange={(value) => setArrayItem('home_programs', program.id, 'dosage', value)} /><CompactInput label="Review date" type="date" value={program.review_date} onChange={(value) => setArrayItem('home_programs', program.id, 'review_date', value)} /><CompactInput label="Adherence" value={program.adherence} onChange={(value) => setArrayItem('home_programs', program.id, 'adherence', value)} /><CompactInput label="Instructions" value={program.instructions} onChange={(value) => setArrayItem('home_programs', program.id, 'instructions', value)} /></div></div>)}</div>}
          </CareEpisodeSection>

          <CareEpisodeSection icon={FileCheck2} title="Progress, reporting and discharge" description="Close the loop with the referrer and record readiness for discharge." tone="violet">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <CompactSelect label="Progress report" value={reporting.progress_report_status} onChange={(value) => setNested('reporting', 'progress_report_status', value)} options={[["not_due", "Not due"], ["due", "Due"], ["draft", "Draft"], ["ready_for_review", "Ready for review"], ["finalised", "Finalised"], ["sent", "Sent"]]} />
              <CompactInput label="Referrer update due" type="date" value={reporting.referrer_update_due} onChange={(value) => setNested('reporting', 'referrer_update_due', value)} />
              {draft.status === 'discharged'
                ? <Field label="Discharge readiness" value="Completed" />
                : <CompactSelect label="Discharge readiness" value={reporting.discharge_status} onChange={(value) => setNested('reporting', 'discharge_status', value)} options={[["not_ready", "Not ready"], ["planning", "Planning"], ["ready", "Ready"]]} />}
              <Field label="Discharge date" value={displayDate(reporting.discharge_date)} />
              <div className="md:col-span-2 xl:col-span-4"><Label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Discharge outcome and ongoing management</Label><Textarea value={reporting.discharge_outcome || ''} onChange={(event) => setNested('reporting', 'discharge_outcome', event.target.value)} className="min-h-24" /></div>
            </div>
            <div className="mt-4 space-y-4 rounded-xl bg-slate-50 p-4">
              <div className="flex gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-teal-600" /><div><p className="text-sm font-semibold text-slate-800">Episode lifecycle</p><p className="text-xs text-slate-500">Every status change is applied atomically and retained in an append-only clinical history.</p></div></div>
              <CompactInput label="Lifecycle reason" value={lifecycleReason} onChange={setLifecycleReason} placeholder={draft.status === 'discharged' ? 'Why is this episode being reopened?' : 'Reason for this status change'} />
              <div className="flex flex-wrap gap-2">
                {lifecycleActions.map(([target, label]) => <Button key={target} variant="outline" disabled={isSaving || !draft.id || !lifecycleReason.trim()} onClick={() => applyLifecycleTransition(target)}><Flag className="mr-2 h-4 w-4" />{label}{target === 'discharged' && <ArrowRight className="ml-2 h-4 w-4" />}</Button>)}
              </div>
              {!draft.id && <p className="text-xs text-amber-700">Save this episode before changing its lifecycle status.</p>}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Status history</p>
                {!draft.status_history?.length
                  ? <p className="text-sm text-slate-500">History will begin when this episode is saved.</p>
                  : <div className="space-y-2">{draft.status_history.slice().reverse().map((entry) => <div key={`${entry.sequence}-${entry.occurred_at}`} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium text-slate-800">{entry.from ? `${labelize(entry.from)} to ` : ''}{labelize(entry.to)}</span><span className="text-xs text-slate-500">{displayDate(entry.occurred_at)}</span></div><p className="mt-1 text-slate-600">{entry.reason}</p>{entry.prior_discharge?.discharge_date && <p className="mt-1 text-xs text-slate-500">Prior discharge archived: {displayDate(entry.prior_discharge.discharge_date)}</p>}</div>)}</div>}
              </div>
            </div>
          </CareEpisodeSection>
        </div>
      </main>
    </div>
  );
}
