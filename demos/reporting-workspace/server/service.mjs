// Reporting service: admission, context loading, command dispatch and
// persistence around the pure domain workflow.
//
// The browser never writes entity rows. It calls named commands; the service
// resolves the principal, proves organisation and episode ownership, loads
// the episode context server-side, applies the domain command inside a
// transaction and persists the result. Snapshot rows are written once and
// never updated (the store refuses updates to ReportDocumentSnapshot).

import { randomUUID } from 'node:crypto';

import {
  assertCanApprove,
  assertCanAuthor,
  assertCanRequest,
  assertEpisodeAccess,
  assertOrgMember,
  assertRequestAccess,
} from '../domain/admission.mjs';
import { createSectionDraftTask, REPORT_DRAFT_SECTION_TASK } from '../domain/aiTasks.mjs';
import { buildEvidenceCatalogue, assessCompleteness } from '../domain/evidence.mjs';
import { REPORT_TYPES, STATUS_LABELS, getReportType } from '../domain/reportTypes.mjs';
import { detectSourceChanges, sourceSetManifest } from '../domain/sourceSet.mjs';
import { WorkflowError, assertKnownKeys, dateOnly, isPlainObject, requireString } from '../domain/util.mjs';
import * as workflow from '../domain/workflow.mjs';

const COMMAND_ADMISSION = Object.freeze({
  assembleEvidence: 'author',
  startDraft: 'author',
  saveDraft: 'author',
  importAiDraftSection: 'author',
  submitForReview: 'author',
  approve: 'approve',
  refreshSources: 'author',
  openAmendment: 'author',
  recordDelivery: 'member',
  recordExport: 'member',
  cancel: 'member',
});

function summariseUser(user) {
  return user ? { id: user.id, display_name: user.full_name, role: user.role } : null;
}

export function createReportingService({
  store,
  clock = () => new Date().toISOString(),
  idFactory = (prefix) => `${prefix}-${randomUUID()}`,
  aiAdapter = null,
  synthetic = true,
} = {}) {
  if (!store) throw new Error('A store is required.');
  const draftSectionTask = createSectionDraftTask({ adapter: aiAdapter, now: clock, idFactory });

  function userById(userId) {
    return store.repo('User').getById(userId);
  }

  function resolvePrincipal(token) {
    const userId = store.sessions.resolve(token);
    if (!userId) return null;
    const user = userById(userId);
    if (!user) return null;
    const memberships = store.repo('OrganizationMember').filter({ user_id: user.id });
    const orgIds = memberships.map((entry) => entry.org_id);
    return {
      user_id: user.id,
      display_name: user.full_name,
      email: user.email,
      role: user.role,
      can_approve_reports: user.can_approve_reports === true,
      account_status: user.account_status,
      org_id: memberships.find((entry) => entry.is_primary)?.org_id || orgIds[0] || null,
      org_ids: orgIds,
    };
  }

  function loadEpisodeContext(orgId, episodeId) {
    const episode = store.repo('PhysioCareEpisode').getById(episodeId);
    assertEpisodeAccess({ episode, orgId });
    const client = store.repo('Client').getById(episode.client_id);
    if (!client || client.org_id !== orgId) {
      throw new WorkflowError(409, 'care_episode_patient_mismatch', 'The care episode does not resolve to one patient in this organisation.');
    }
    const scoped = { org_id: orgId, client_id: client.id, physio_care_episode_id: episode.id };
    const assessments = store.repo('ClientAssessment').filter(scoped);
    const catalogueIds = new Set(assessments.map((row) => row.assessment_id));
    return {
      client,
      episode,
      assessments,
      catalogue: store.repo('Assessment').listAll().filter((row) => catalogueIds.has(row.id)),
      soapNotes: store.repo('SOAPNote').filter(scoped),
      savedReports: store.repo('SavedReport').filter(scoped),
      documents: store.repo('ClientDocument').filter(scoped),
    };
  }

  function loadCatalogue(orgId, episodeId) {
    return buildEvidenceCatalogue(loadEpisodeContext(orgId, episodeId));
  }

  function requestSummary(request, { today }) {
    const reportType = getReportType(request.report_type);
    const client = store.repo('Client').getById(request.client_id);
    const owner = userById(request.owner_user_id);
    const open = !['approved', 'sent', 'cancelled'].includes(request.status);
    return {
      id: request.id,
      org_id: request.org_id,
      client_id: request.client_id,
      client_display_name: client?.full_name || 'Patient',
      physio_care_episode_id: request.physio_care_episode_id,
      report_type: request.report_type,
      report_label: reportType?.label || request.report_type,
      purpose: request.purpose,
      recipient: request.recipient,
      owner: summariseUser(owner),
      due_date: request.due_date,
      is_overdue: open && request.due_date < today,
      status: request.status,
      status_label: STATUS_LABELS[request.status] || request.status,
      version: request.version,
      completeness_summary: request.completeness?.summary || null,
      blocking_gaps: request.completeness?.blocking_gaps || [],
      current_snapshot_id: request.current_snapshot_id,
      snapshot_count: request.snapshot_ids.length,
      created_at: request.created_at,
      updated_at: request.updated_at,
    };
  }

  function persistResult(requestId, result, { now }) {
    if (result.replayed) return result;
    store.transaction(() => {
      store.repo('ReportOutputRequest').replace(requestId, result.request, { now });
      if (result.snapshot) {
        store.repo('ReportDocumentSnapshot').create(result.snapshot, result.snapshot.approved_by_user_id, { now, id: result.snapshot.id });
      }
    });
    return result;
  }

  function loadRequest(principal, requestId) {
    const request = store.repo('ReportOutputRequest').getById(requestId);
    assertRequestAccess({ request, principal });
    return request;
  }

  const service = {
    resolvePrincipal,

    listIdentities() {
      return store.repo('User').listAll().map((user) => ({
        key: user.key,
        display_name: user.full_name,
        role: user.role,
        can_approve_reports: user.can_approve_reports === true,
        account_status: user.account_status,
        organisation: store.repo('OrganizationMember').filter({ user_id: user.id }).map((entry) => store.repo('Organization').getById(entry.org_id)?.name).filter(Boolean)[0] || null,
      }));
    },

    openSession(identityKey) {
      const user = store.repo('User').filter({ key: identityKey })[0];
      if (!user) throw new WorkflowError(404, 'identity_not_found', 'Unknown demo identity.');
      const token = store.sessions.create(user.id, { now: clock() });
      return { token, principal: resolvePrincipal(token) };
    },

    reportTypes() {
      return Object.values(REPORT_TYPES).map((type) => ({
        id: type.id,
        label: type.label,
        description: type.description,
        template_version: type.template_version,
        audiences: [...type.audiences],
        requirements: [...type.requirements],
        sections: type.sections.map((section) => ({ ...section })),
      }));
    },

    listEpisodes(principal) {
      assertOrgMember(principal, principal.org_id);
      const orgId = principal.org_id;
      const requests = store.repo('ReportOutputRequest').filter({ org_id: orgId });
      return store.repo('PhysioCareEpisode').filter({ org_id: orgId }).map((episode) => {
        const client = store.repo('Client').getById(episode.client_id);
        const episodeRequests = requests.filter((entry) => entry.physio_care_episode_id === episode.id);
        return {
          id: episode.id,
          client_id: episode.client_id,
          client_display_name: client?.full_name || 'Patient',
          synthetic: client?.synthetic === true,
          title: episode.title,
          status: episode.status,
          presenting_problem: episode.presenting_problem,
          body_region: episode.body_region,
          episode_start_date: episode.episode_start_date,
          updated_date: episode.updated_date,
          request_count: episodeRequests.length,
          open_request_count: episodeRequests.filter((entry) => !['approved', 'sent', 'cancelled'].includes(entry.status)).length,
          approved_request_count: episodeRequests.filter((entry) => ['approved', 'sent'].includes(entry.status)).length,
        };
      });
    },

    getEpisodeWorkspace(principal, episodeId) {
      assertOrgMember(principal, principal.org_id);
      const orgId = principal.org_id;
      const context = loadEpisodeContext(orgId, episodeId);
      const catalogue = buildEvidenceCatalogue(context);
      const today = dateOnly(clock());
      const requests = store.repo('ReportOutputRequest').filter({ org_id: orgId, physio_care_episode_id: episodeId }).map((request) => requestSummary(request, { today }));
      return {
        episode: {
          id: context.episode.id,
          title: context.episode.title,
          status: context.episode.status,
          presenting_problem: context.episode.presenting_problem,
          body_region: context.episode.body_region,
          episode_start_date: context.episode.episode_start_date,
          updated_date: context.episode.updated_date,
          referral: context.episode.referral || {},
          reporting: context.episode.reporting || {},
        },
        client: {
          id: context.client.id,
          display_name: context.client.full_name,
          synthetic: context.client.synthetic === true,
          funding_source: context.client.funding_source,
        },
        evidence: catalogue.items.map((entry) => ({
          source_id: entry.source_id,
          category: entry.category,
          entity: entry.entity,
          record_id: entry.record_id,
          path: entry.path,
          label: entry.label,
          recorded_at: entry.recorded_at,
          record_version: entry.record_version,
          content_sha256: entry.content_sha256,
          ai_assisted: entry.ai_assisted,
          flags: entry.flags,
          content: entry.content,
        })),
        completeness_by_type: Object.fromEntries(Object.keys(REPORT_TYPES).map((typeId) => [typeId, assessCompleteness({ reportTypeId: typeId, catalogue })])),
        requests,
        clinicians: store.repo('User').listAll()
          .filter((user) => user.account_status === 'active' && store.repo('OrganizationMember').filter({ user_id: user.id, org_id: orgId }).length > 0)
          .map((user) => ({ id: user.id, display_name: user.full_name, role: user.role, can_approve_reports: user.can_approve_reports === true })),
      };
    },

    listRequests(principal, { status = null, episodeId = null } = {}) {
      assertOrgMember(principal, principal.org_id);
      const today = dateOnly(clock());
      return store.repo('ReportOutputRequest')
        .filter({ org_id: principal.org_id, ...(status ? { status } : {}), ...(episodeId ? { physio_care_episode_id: episodeId } : {}) })
        .map((request) => requestSummary(request, { today }))
        .sort((a, b) => (a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : a.id.localeCompare(b.id)));
    },

    createRequest(principal, payload) {
      if (!isPlainObject(payload)) throw new WorkflowError(400, 'invalid_request', 'A request body is required.');
      const orgId = principal.org_id;
      assertCanRequest(principal, orgId);
      if (payload.org_id !== undefined && payload.org_id !== orgId) {
        throw new WorkflowError(403, 'organization_access_denied', 'A report request must belong to your organisation.');
      }
      const episodeId = requireString(payload.physio_care_episode_id, 'physio_care_episode_id', { max: 200 });
      const episode = store.repo('PhysioCareEpisode').getById(episodeId);
      assertEpisodeAccess({ episode, orgId, clientId: payload.client_id || null });
      const ownerId = requireString(payload.owner_user_id, 'owner_user_id', { max: 200 });
      const owner = userById(ownerId);
      const ownerMember = owner && store.repo('OrganizationMember').filter({ user_id: owner.id, org_id: orgId }).length > 0;
      if (!ownerMember || owner.account_status !== 'active') {
        throw new WorkflowError(400, 'owner_not_member', 'The report owner must be an active member of this organisation.');
      }
      const now = clock();
      const request = workflow.createOutputRequest(
        { ...payload, org_id: orgId, client_id: episode.client_id, physio_care_episode_id: episode.id },
        { now, idFactory, actor: principal },
      );
      const existing = payload.command_id
        ? store.repo('ReportOutputRequest').filter({ org_id: orgId }).find((row) => row.processed_commands.some((entry) => entry.command_id === payload.command_id))
        : null;
      if (existing) return { request: existing, replayed: true };
      store.transaction(() => {
        store.repo('ReportOutputRequest').create(request, principal.user_id, { now, id: request.id });
      });
      return { request, replayed: false };
    },

    getRequest(principal, requestId) {
      const request = loadRequest(principal, requestId);
      const today = dateOnly(clock());
      const revision = request.draft_revisions.find((entry) => entry.id === request.current_revision_id) || null;
      const sourceSet = request.source_sets.find((entry) => entry.id === request.current_source_set_id) || null;
      let staleness = null;
      if (sourceSet) {
        const catalogue = loadCatalogue(request.org_id, request.physio_care_episode_id);
        staleness = detectSourceChanges({ sourceSet, catalogue, reportTypeId: request.report_type });
      }
      const snapshots = request.snapshot_ids.map((snapshotId) => {
        const snapshot = store.repo('ReportDocumentSnapshot').getById(snapshotId);
        const chain = request.snapshot_chain.find((entry) => entry.snapshot_id === snapshotId) || {};
        return snapshot ? {
          id: snapshot.id,
          sequence: snapshot.sequence,
          approved_at: snapshot.approved_at,
          approved_by_name: snapshot.approved_by_name,
          content_sha256: snapshot.content_sha256,
          document_sha256: snapshot.document_sha256,
          manifest_sha256: snapshot.manifest_sha256,
          source_set_id: snapshot.source_set_id,
          source_set_version: snapshot.source_set_version,
          revision_number: snapshot.revision_number,
          stale_sources_acknowledged: snapshot.stale_sources_acknowledged,
          supersedes_snapshot_id: snapshot.supersedes_snapshot_id,
          superseded_by_snapshot_id: chain.superseded_by_snapshot_id || null,
          supersession_reason: chain.supersession_reason || null,
          amendment: snapshot.amendment,
        } : null;
      }).filter(Boolean);
      const { processed_commands: _processed, source_sets: _sets, draft_revisions: _revisions, ...core } = request;
      return {
        summary: requestSummary(request, { today }),
        request: core,
        report_type: getReportType(request.report_type),
        current_revision: revision,
        revision_count: request.draft_revisions.length,
        current_source_set: sourceSet ? sourceSetManifest(sourceSet) : null,
        pinned_sources: sourceSet ? sourceSet.items : [],
        staleness,
        snapshots,
        ai_drafting: {
          task: REPORT_DRAFT_SECTION_TASK.id,
          task_version: REPORT_DRAFT_SECTION_TASK.version,
          available: typeof aiAdapter === 'function',
          state: typeof aiAdapter === 'function' ? 'configured' : 'unavailable',
          message: typeof aiAdapter === 'function'
            ? 'A provider adapter is configured for the named section-draft task.'
            : 'AI drafting is not configured in this workspace. No provider request will be made.',
        },
        permissions: {
          can_author: ['clinician', 'senior_clinician'].includes(principal.role),
          can_approve: principal.can_approve_reports === true && ['clinician', 'senior_clinician'].includes(principal.role),
        },
      };
    },

    runCommand(principal, requestId, commandName, payload = {}) {
      const command = workflow.COMMANDS[commandName];
      if (!command) throw new WorkflowError(404, 'unknown_command', `Unknown command ${commandName}.`);
      const request = loadRequest(principal, requestId);
      const admission = COMMAND_ADMISSION[commandName];
      if (admission === 'author') assertCanAuthor(principal, request.org_id);
      else if (admission === 'approve') assertCanApprove(principal, request.org_id);
      else assertOrgMember(principal, request.org_id);
      const now = clock();
      const ctx = { now, idFactory, actor: principal, synthetic };
      if (['assembleEvidence', 'approve', 'refreshSources'].includes(commandName)) {
        ctx.catalogue = loadCatalogue(request.org_id, request.physio_care_episode_id);
      }
      if (commandName === 'approve') {
        ctx.ownerName = userById(request.owner_user_id)?.full_name || request.owner_user_id;
      }
      if (commandName === 'openAmendment') {
        ctx.snapshot = store.repo('ReportDocumentSnapshot').getById(request.current_snapshot_id);
      }
      const result = command(request, isPlainObject(payload) ? payload : {}, ctx);
      return persistResult(requestId, result, { now });
    },

    async requestAiSectionDraft(principal, requestId, payload = {}) {
      assertKnownKeys(payload, new Set(['section_key', 'expected_version', 'command_id']), 'ai draft');
      const request = loadRequest(principal, requestId);
      assertCanAuthor(principal, request.org_id);
      const sourceSet = request.source_sets.find((entry) => entry.id === request.current_source_set_id);
      if (!sourceSet) throw new WorkflowError(409, 'source_set_required', 'Assemble evidence before requesting an AI-assisted draft.');
      const sectionKey = requireString(payload.section_key, 'section_key', { max: 80 });
      const generation = await draftSectionTask({ request, sourceSet, sectionKey });
      const now = clock();
      const result = workflow.applyAiSectionDraft(
        request,
        { expected_version: payload.expected_version, command_id: payload.command_id, section_key: sectionKey, generation },
        { now, idFactory, actor: principal, synthetic },
      );
      return persistResult(requestId, result, { now });
    },

    getPreview(principal, requestId) {
      const request = loadRequest(principal, requestId);
      const owner = userById(request.owner_user_id);
      return workflow.renderDraftPreview(request, { ownerName: owner?.full_name || request.owner_user_id, synthetic });
    },

    getSnapshot(principal, snapshotId) {
      const snapshot = store.repo('ReportDocumentSnapshot').getById(snapshotId);
      if (!snapshot) throw new WorkflowError(404, 'snapshot_not_found', 'The snapshot was not found.');
      assertOrgMember(principal, snapshot.org_id);
      return snapshot;
    },

    /** Demo-only control: mutate source records to show staleness detection. */
    simulateSourceChange(principal, payload = {}) {
      assertKnownKeys(payload, new Set(['episode_id', 'change']), 'simulate');
      const episodeId = requireString(payload.episode_id, 'episode_id', { max: 200 });
      const change = requireString(payload.change, 'change', { max: 60 });
      const orgId = principal.org_id;
      assertCanAuthor(principal, orgId);
      const episodeRepo = store.repo('PhysioCareEpisode');
      const episode = episodeRepo.getById(episodeId);
      assertEpisodeAccess({ episode, orgId });
      const now = clock();
      const today = dateOnly(now);
      return store.transaction(() => {
        if (change === 'add_reassessment') {
          const assessments = store.repo('ClientAssessment').filter({ org_id: orgId, physio_care_episode_id: episodeId, status: 'completed' });
          const latest = assessments.sort((a, b) => String(a.assessment_date).localeCompare(String(b.assessment_date))).at(-1);
          if (!latest) throw new WorkflowError(409, 'no_measure_to_repeat', 'The episode has no completed measure to repeat.');
          const definition = store.repo('Assessment').getById(latest.assessment_id);
          const direction = definition?.normative_direction;
          const delta = direction === 'higher_better' ? 4 : -1;
          const created = store.repo('ClientAssessment').create({
            org_id: orgId,
            client_id: episode.client_id,
            physio_care_episode_id: episodeId,
            assessment_id: latest.assessment_id,
            status: 'completed',
            result_value: Number(latest.result_value) + delta,
            assessment_date: today,
            source: 'live',
            notes: 'Synthetic demo reassessment added through the demo control.',
          }, principal.email, { now });
          episodeRepo.update(episodeId, { last_reviewed_at: now }, { now });
          return { change, record: { entity: 'ClientAssessment', id: created.id, assessment_id: created.assessment_id, result_value: created.result_value, assessment_date: created.assessment_date } };
        }
        if (change === 'achieve_first_goal') {
          const goals = Array.isArray(episode.goals) ? episode.goals : [];
          if (goals.length === 0) throw new WorkflowError(409, 'no_goal_to_update', 'The episode has no goals to update.');
          const updatedGoals = goals.map((goal, index) => (index === 0 ? { ...goal, status: 'achieved' } : goal));
          episodeRepo.update(episodeId, { goals: updatedGoals, last_reviewed_at: now }, { now });
          return { change, record: { entity: 'PhysioCareEpisode', id: episodeId, path: `goals[${goals[0].id}]`, status: 'achieved' } };
        }
        if (change === 'record_adherence') {
          const programs = Array.isArray(episode.home_programs) ? episode.home_programs : [];
          if (programs.length === 0) {
            const updated = [{ id: `hp-demo-${today}`, name: 'Synthetic demo home program', status: 'current', prescribed_date: today, review_date: '', dosage: 'Daily, two sets of ten repetitions', adherence: 'Reported four of seven days (self-report)', instructions: 'Synthetic demo exercise prescription.' }];
            episodeRepo.update(episodeId, { home_programs: updated, last_reviewed_at: now }, { now });
            return { change, record: { entity: 'PhysioCareEpisode', id: episodeId, path: `home_programs[${updated[0].id}]` } };
          }
          const updated = programs.map((program, index) => (index === 0 ? { ...program, adherence: `Reported adherence updated on ${today} (self-report)` } : program));
          episodeRepo.update(episodeId, { home_programs: updated, last_reviewed_at: now }, { now });
          return { change, record: { entity: 'PhysioCareEpisode', id: episodeId, path: `home_programs[${programs[0].id}]` } };
        }
        throw new WorkflowError(400, 'unknown_change', 'Unknown demo change. Supported: add_reassessment, achieve_first_goal, record_adherence.');
      });
    },
  };

  return service;
}
