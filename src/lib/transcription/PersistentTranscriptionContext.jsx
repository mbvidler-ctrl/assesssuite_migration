import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { base44 } from '@/api/base44Client';
import { uploadTenantFile } from '@/lib/fileIntegrations';
import { appParams } from '@/lib/app-params';
import { useAuth } from '@/lib/AuthContext';
import { recordLegalEvent } from '@/lib/legal/recordAcceptance';
import { EVENT_TYPES } from '@/lib/legal/documentRegistry';
import {
  deleteLocalTranscriptionPart,
  deleteLocalTranscriptionSession,
  findLatestLocalTranscriptionSession,
  getLocalTranscriptionSession,
  groupLocalTranscriptionParts,
  listLocalTranscriptionChunks,
  saveLocalTranscriptionChunk,
  saveLocalTranscriptionSession,
} from './localTranscriptionStore';

const PersistentTranscriptionContext = createContext(null);
const PART_DURATION_MS = 4 * 60 * 1000;
const CHUNK_TIMESLICE_MS = 5 * 1000;
const MAX_SEGMENT_BYTES = 18 * 1024 * 1024;
const MIN_RECORDING_STORAGE_BYTES = 64 * 1024 * 1024;
const MIME_CANDIDATES = Object.freeze([
  'audio/webm;codecs=opus',
  'audio/mp4;codecs=mp4a.40.2',
  'audio/mp4',
  'audio/webm',
]);

function unwrap(response) {
  return response?.data ?? response;
}

function preferredMimeType() {
  if (typeof MediaRecorder === 'undefined') return null;
  if (typeof MediaRecorder.isTypeSupported !== 'function') return '';
  return MIME_CANDIDATES.find((candidate) => MediaRecorder.isTypeSupported(candidate)) || '';
}

function fileFormat(mimeType) {
  const base = String(mimeType || '').split(';', 1)[0].toLowerCase();
  if (base === 'audio/webm' || base === 'video/webm') return { extension: 'webm', mimeType: 'audio/webm' };
  if (['audio/mp4', 'audio/x-m4a', 'video/mp4'].includes(base)) return { extension: 'mp4', mimeType: 'audio/mp4' };
  return null;
}

function friendlyError(error) {
  return error?.response?.data?.message
    || error?.response?.data?.error
    || error?.message
    || 'Persistent transcription could not complete this action.';
}

function ownerKey(appId, user) {
  return `${appId}:${String(user?.id || user?.email || '').toLowerCase()}`;
}

async function ensureRecordingStorageCapacity({ requestPersistence = false } = {}) {
  if (!navigator.storage?.estimate) return;
  try {
    if (requestPersistence) await navigator.storage.persist?.();
    const estimate = await navigator.storage.estimate();
    const quota = Number(estimate?.quota);
    const usage = Number(estimate?.usage);
    if (Number.isFinite(quota) && Number.isFinite(usage)
        && quota - usage < MIN_RECORDING_STORAGE_BYTES) {
      throw new Error('This device has less than 64 MiB available for recoverable recording. Free browser storage before starting.');
    }
  } catch (error) {
    if (/less than 64 MiB/.test(String(error?.message || ''))) throw error;
    // Storage estimation is advisory. IndexedDB remains the source of truth
    // and will stop capture explicitly if a write later fails.
  }
}

async function primaryOrganization(user) {
  const memberships = await base44.entities.OrganizationMember.filter({ user_email: user.email });
  return memberships.find((entry) => entry.is_primary === true) || memberships[0] || null;
}

export function PersistentTranscriptionProvider({ children }) {
  const { isAuthenticated, isLoadingAuth } = useAuth();
  const [state, setState] = useState({
    phase: 'idle',
    session: null,
    elapsedSeconds: 0,
    error: null,
    localRecovery: false,
  });
  const [dockOpenRequest, setDockOpenRequest] = useState(0);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const rotationTimerRef = useRef(null);
  const elapsedTimerRef = useRef(null);
  const partIndexRef = useRef(0);
  const chunkIndexRef = useRef(0);
  const stopReasonRef = useRef(null);
  const localRef = useRef(null);
  const userRef = useRef(null);
  const partFlushPromiseRef = useRef(Promise.resolve());
  const retryInFlightRef = useRef(null);
  const storagePersistenceRequestedRef = useRef(false);

  const openDock = useCallback(() => {
    setDockOpenRequest((value) => value + 1);
  }, []);

  const updateLocal = useCallback(async (patch) => {
    if (!localRef.current) return null;
    localRef.current = await saveLocalTranscriptionSession({ ...localRef.current, ...patch });
    return localRef.current;
  }, []);

  const refreshSession = useCallback(async (sessionId) => {
    const payload = unwrap(await base44.functions.invoke('manageTranscriptionSession', {
      action: 'get', session_id: sessionId,
    }));
    if (payload?.session) {
      setState((current) => ({ ...current, session: payload.session }));
      return payload.session;
    }
    return null;
  }, []);

  const uploadAndTranscribePart = useCallback(async (sessionId, partIndex) => {
    const chunks = await listLocalTranscriptionChunks(sessionId, partIndex);
    if (chunks.length === 0) return null;
    const format = fileFormat(chunks[0].mimeType);
    if (!format) throw new Error('This browser produced an unsupported recording format.');
    const blob = new Blob(chunks.map((chunk) => chunk.blob), { type: format.mimeType });
    if (!blob.size) throw new Error('The recovered recording segment is empty.');
    if (blob.size > MAX_SEGMENT_BYTES) {
      throw new Error('A recovered recording segment exceeded 18 MiB. It remains saved locally for recovery.');
    }
    let serverSession = await refreshSession(sessionId);
    let serverSegment = serverSession?.segments?.find((segment) => segment.sequence === partIndex);
    if (!serverSegment) {
      const file = new File([blob], `consultation-${sessionId}-${partIndex}.${format.extension}`, { type: format.mimeType });
      const uploaded = await uploadTenantFile({
        file,
        org_id: localRef.current.orgId,
        purpose: 'audio-transcription',
      });
      const appended = unwrap(await base44.functions.invoke('manageTranscriptionSession', {
        action: 'append_segment',
        org_id: localRef.current.orgId,
        session_id: sessionId,
        sequence: partIndex,
        upload_id: uploaded.upload_id,
        audio_url: uploaded.file_url,
        duration_seconds: Math.max(1, Math.round((chunks.length * CHUNK_TIMESLICE_MS) / 1000)),
      }));
      serverSegment = appended?.segment;
    }
    if (!serverSegment) throw new Error('The recording segment could not be registered.');
    if (serverSegment.status !== 'ready') {
      await base44.functions.invoke('transcribeSession', {
        action: 'transcribe_segment',
        org_id: localRef.current.orgId,
        persistent_session_id: sessionId,
        sequence: partIndex,
        audio_url: serverSegment.audio_url,
      });
    }
    await deleteLocalTranscriptionPart(sessionId, partIndex);
    await updateLocal({ lastUploadedPart: Math.max(localRef.current.lastUploadedPart ?? -1, partIndex) });
    return refreshSession(sessionId);
  }, [refreshSession, updateLocal]);

  const flushPendingParts = useCallback(async (sessionId) => {
    const groups = groupLocalTranscriptionParts(await listLocalTranscriptionChunks(sessionId));
    let latest = null;
    for (const group of groups) {
      // Each independently restarted MediaRecorder part is a valid bounded file.
      // eslint-disable-next-line no-await-in-loop
      latest = await uploadAndTranscribePart(sessionId, group.partIndex);
    }
    return latest;
  }, [uploadAndTranscribePart]);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const clearTimers = useCallback(() => {
    if (rotationTimerRef.current) clearTimeout(rotationTimerRef.current);
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    rotationTimerRef.current = null;
    elapsedTimerRef.current = null;
  }, []);

  const startRecorderPart = useCallback((stream) => {
    const mime = preferredMimeType();
    const recorder = mime
      ? new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 64_000 })
      : new MediaRecorder(stream, { audioBitsPerSecond: 64_000 });
    const currentPart = partIndexRef.current;
    const pendingWrites = [];
    chunkIndexRef.current = 0;
    recorderRef.current = recorder;
    recorder.ondataavailable = (event) => {
      if (!event.data?.size || !localRef.current) return;
      const chunkIndex = chunkIndexRef.current;
      chunkIndexRef.current += 1;
      const write = saveLocalTranscriptionChunk({
        sessionId: localRef.current.sessionId,
        partIndex: currentPart,
        chunkIndex,
        blob: event.data,
        mimeType: recorder.mimeType || mime,
      }).then(() => updateLocal({ lastChunkAt: new Date().toISOString(), status: 'recording' }))
        .catch((error) => {
          stopReasonRef.current = 'storage_error';
          if (rotationTimerRef.current) clearTimeout(rotationTimerRef.current);
          rotationTimerRef.current = null;
          if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
          elapsedTimerRef.current = null;
          if (recorder.state !== 'inactive') recorder.stop();
          streamRef.current?.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
          updateLocal({ status: 'recoverable', lastError: friendlyError(error) }).catch(() => {});
          setState((value) => ({ ...value, phase: 'error', error: friendlyError(error), localRecovery: true }));
          toast.error('Capture paused because local storage failed. Earlier checkpoints remain saved.');
        });
      pendingWrites.push(write);
    };
    recorder.onstop = () => {
      if (rotationTimerRef.current) clearTimeout(rotationTimerRef.current);
      const reason = stopReasonRef.current || 'rotate';
      stopReasonRef.current = null;
      if (reason === 'rotate' && streamRef.current?.active) {
        partIndexRef.current += 1;
        startRecorderPart(streamRef.current);
      }
      const priorFlush = partFlushPromiseRef.current;
      partFlushPromiseRef.current = priorFlush.catch(() => {}).then(async () => {
        await Promise.allSettled(pendingWrites);
        try {
          await uploadAndTranscribePart(localRef.current.sessionId, currentPart);
        } catch (error) {
          await updateLocal({ status: 'recoverable', lastError: friendlyError(error) });
          setState((value) => ({
            ...value,
            // A failed background upload must not claim that capture stopped:
            // the next bounded part may already be recording locally.
            phase: recorderRef.current?.state === 'recording' ? 'recording' : 'recoverable',
            error: friendlyError(error),
            localRecovery: true,
          }));
          toast.error('This recording part remains saved and can be retried.');
        }
      });
    };
    recorder.start(CHUNK_TIMESLICE_MS);
    rotationTimerRef.current = setTimeout(() => {
      if (recorder.state !== 'inactive') {
        stopReasonRef.current = 'rotate';
        recorder.stop();
      }
    }, PART_DURATION_MS);
  }, [updateLocal, uploadAndTranscribePart]);

  const prepareCaptureStream = useCallback(async () => {
    const requestPersistence = !storagePersistenceRequestedRef.current;
    storagePersistenceRequestedRef.current = true;
    await ensureRecordingStorageCapacity({ requestPersistence });
    return navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
    });
  }, []);

  const beginCapture = useCallback(async (preparedStream = null) => {
    const stream = preparedStream || await prepareCaptureStream();
    streamRef.current = stream;
    clearTimers();
    startRecorderPart(stream);
    elapsedTimerRef.current = setInterval(() => {
      setState((value) => ({ ...value, elapsedSeconds: value.elapsedSeconds + 1 }));
    }, 1000);
    setState((value) => ({ ...value, phase: 'recording', error: null, localRecovery: true }));
  }, [clearTimers, prepareCaptureStream, startRecorderPart]);

  const start = useCallback(async ({ label = '', consentConfirmed = false, clientId = null, appointmentId = null, careEpisodeId = null } = {}) => {
    if (!consentConfirmed) throw new Error('Confirm recording consent before starting.');
    if (state.phase !== 'idle') throw new Error('A transcription session is already active.');
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      throw new Error('This browser does not support persistent audio capture.');
    }
    setState((value) => ({ ...value, phase: 'starting', error: null }));
    let preparedStream = null;
    let createdSession = null;
    try {
      const user = await base44.auth.me();
      const membership = await primaryOrganization(user);
      if (!membership?.org_id) throw new Error('A primary practice is required for transcription.');
      userRef.current = user;
      const consentContext = `persistent-${crypto.randomUUID()}`;
      await recordLegalEvent({
        eventType: EVENT_TYPES.RECORDING_CONSENT,
        userEmail: user.email,
        orgId: membership.org_id,
        actorCapacity: 'clinician',
        sessionContext: consentContext,
      });
      // Prove local storage and microphone access before creating durable
      // server state. A declined permission or low-storage refusal therefore
      // cannot strand an active session that the current page cannot recover.
      preparedStream = await prepareCaptureStream();
      const created = unwrap(await base44.functions.invoke('manageTranscriptionSession', {
        action: 'create',
        org_id: membership.org_id,
        label,
        client_id: clientId,
        appointment_id: appointmentId,
        care_episode_id: careEpisodeId,
      }));
      if (!created?.session) throw new Error('The persistent transcription session was not created.');
      createdSession = created.session;
      const local = {
        sessionId: created.session.id,
        ownerKey: ownerKey(appParams.appId, user),
        orgId: membership.org_id,
        status: 'recording',
        label: created.session.label,
        startedAt: created.session.started_at,
        lastUploadedPart: -1,
      };
      localRef.current = await saveLocalTranscriptionSession(local);
      partIndexRef.current = 0;
      setState({ phase: 'starting', session: created.session, elapsedSeconds: 0, error: null, localRecovery: true });
      await beginCapture(preparedStream);
      preparedStream = null;
      openDock();
      toast.success('Persistent transcription started. It will continue while you move through AssessSuite.');
      return created.session;
    } catch (error) {
      preparedStream?.getTracks().forEach((track) => track.stop());
      stopTracks();
      clearTimers();
      if (createdSession?.id) {
        try {
          await base44.functions.invoke('manageTranscriptionSession', {
            action: 'discard',
            session_id: createdSession.id,
            org_id: createdSession.org_id,
          });
          await deleteLocalTranscriptionSession(createdSession.id);
          if (localRef.current?.sessionId === createdSession.id) localRef.current = null;
        } catch {
          // A server-side cleanup failure is recoverable on the next provider
          // mount; preserve the original capture error for the clinician.
        }
      }
      setState((value) => ({ ...value, phase: 'idle', error: friendlyError(error) }));
      throw error;
    }
  }, [beginCapture, clearTimers, openDock, prepareCaptureStream, state.phase, stopTracks]);

  const stopCurrentRecorder = useCallback(async (reason) => {
    clearTimers();
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      stopReasonRef.current = reason;
      recorder.requestData();
      recorder.stop();
      await new Promise((resolve) => {
        const deadline = setTimeout(resolve, 3000);
        recorder.addEventListener('stop', () => { clearTimeout(deadline); resolve(); }, { once: true });
      });
      await partFlushPromiseRef.current;
    }
    recorderRef.current = null;
    stopTracks();
  }, [clearTimers, stopTracks]);

  const pause = useCallback(async () => {
    if (!localRef.current || state.phase !== 'recording') return;
    setState((value) => ({ ...value, phase: 'finalising' }));
    await stopCurrentRecorder('pause');
    await base44.functions.invoke('manageTranscriptionSession', {
      action: 'pause', session_id: localRef.current.sessionId, org_id: localRef.current.orgId,
    });
    await updateLocal({ status: 'paused' });
    const session = await refreshSession(localRef.current.sessionId);
    setState((value) => ({ ...value, phase: 'paused', session, error: null }));
  }, [refreshSession, state.phase, stopCurrentRecorder, updateLocal]);

  const resume = useCallback(async () => {
    if (!localRef.current || !['paused', 'recoverable', 'error'].includes(state.phase)) return;
    setState((value) => ({ ...value, phase: 'starting', error: null }));
    try {
      await flushPendingParts(localRef.current.sessionId);
      const chunks = await listLocalTranscriptionChunks(localRef.current.sessionId);
      partIndexRef.current = Math.max(localRef.current.lastUploadedPart ?? -1, ...chunks.map((entry) => entry.partIndex), -1) + 1;
      await base44.functions.invoke('manageTranscriptionSession', {
        action: 'resume', session_id: localRef.current.sessionId, org_id: localRef.current.orgId,
      });
      await updateLocal({ status: 'recording', lastError: null });
      await beginCapture();
    } catch (error) {
      setState((value) => ({ ...value, phase: 'recoverable', error: friendlyError(error), localRecovery: true }));
      throw error;
    }
  }, [beginCapture, flushPendingParts, state.phase, updateLocal]);

  const finish = useCallback(async () => {
    if (!localRef.current || !['recording', 'paused', 'recoverable', 'error'].includes(state.phase)) return;
    const sessionId = localRef.current.sessionId;
    setState((value) => ({ ...value, phase: 'finalising', error: null }));
    try {
      if (state.phase === 'recording') await stopCurrentRecorder('finish');
      await flushPendingParts(sessionId);
      await base44.functions.invoke('manageTranscriptionSession', {
        action: 'finish', session_id: sessionId, org_id: localRef.current.orgId,
      });
      const structured = unwrap(await base44.functions.invoke('transcribeSession', {
        action: 'structure_transcript',
        org_id: localRef.current.orgId,
        persistent_session_id: sessionId,
      }));
      const session = await refreshSession(sessionId);
      await updateLocal({ status: 'ready', completedAt: new Date().toISOString() });
      setState((value) => ({
        ...value,
        phase: 'ready',
        session: { ...session, artifacts: structured?.artifacts || session?.artifacts },
        error: null,
        localRecovery: false,
      }));
      await deleteLocalTranscriptionSession(sessionId);
      localRef.current = null;
      toast.success('Transcription and clinical workspace are ready.');
    } catch (error) {
      await updateLocal({ status: 'recoverable', lastError: friendlyError(error) });
      setState((value) => ({ ...value, phase: 'recoverable', error: friendlyError(error), localRecovery: true }));
      toast.error('The recording remains saved. Use Retry or Resume when the service is available.');
    }
  }, [flushPendingParts, refreshSession, state.phase, stopCurrentRecorder, updateLocal]);

  const retry = useCallback(async () => {
    if (!localRef.current) return;
    if (retryInFlightRef.current) return retryInFlightRef.current;
    const sessionId = localRef.current.sessionId;
    const operation = (async () => {
      setState((value) => ({ ...value, phase: 'finalising', error: null }));
      try {
        await flushPendingParts(sessionId);
        const session = await refreshSession(sessionId);
        setState((value) => ({ ...value, phase: session?.status === 'ready' ? 'ready' : 'paused', session, error: null }));
      } catch (error) {
        setState((value) => ({ ...value, phase: 'recoverable', error: friendlyError(error), localRecovery: true }));
      }
    })();
    retryInFlightRef.current = operation;
    try {
      await operation;
    } finally {
      if (retryInFlightRef.current === operation) retryInFlightRef.current = null;
    }
  }, [flushPendingParts, refreshSession]);

  const discard = useCallback(async () => {
    if (!localRef.current) {
      setState({ phase: 'idle', session: null, elapsedSeconds: 0, error: null, localRecovery: false });
      return;
    }
    const { sessionId, orgId } = localRef.current;
    await stopCurrentRecorder('discard');
    await base44.functions.invoke('manageTranscriptionSession', {
      action: 'discard', session_id: sessionId, org_id: orgId,
    });
    await deleteLocalTranscriptionSession(sessionId);
    localRef.current = null;
    setState({ phase: 'idle', session: null, elapsedSeconds: 0, error: null, localRecovery: false });
  }, [stopCurrentRecorder]);

  const reset = useCallback(() => {
    setState({ phase: 'idle', session: null, elapsedSeconds: 0, error: null, localRecovery: false });
  }, []);

  useEffect(() => {
    if (isLoadingAuth || !isAuthenticated) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const user = await base44.auth.me();
        userRef.current = user;
        const key = ownerKey(appParams.appId, user);
        const local = await findLatestLocalTranscriptionSession(key);
        const recovered = unwrap(await base44.functions.invoke('manageTranscriptionSession', { action: 'recover' }));
        if (cancelled || !recovered?.active_session) return;
        localRef.current = local?.sessionId === recovered.active_session.id
          ? local
          : await saveLocalTranscriptionSession({
            sessionId: recovered.active_session.id,
            ownerKey: key,
            orgId: recovered.active_session.org_id || local?.orgId,
            status: 'recoverable',
            label: recovered.active_session.label,
            startedAt: recovered.active_session.started_at,
            lastUploadedPart: Math.max(-1, ...(recovered.active_session.segments || []).map((entry) => entry.sequence)),
          });
        const elapsed = Math.max(0, Math.round((Date.now() - new Date(recovered.active_session.started_at).getTime()) / 1000));
        setState({
          phase: recovered.active_session.status === 'paused' ? 'paused' : 'recoverable',
          session: recovered.active_session,
          elapsedSeconds: elapsed,
          error: recovered.active_session.last_error_code ? 'This saved transcription needs attention.' : null,
          localRecovery: true,
        });
      } catch {
        // Authentication and ordinary page loading must remain available when
        // transcription recovery is temporarily unreachable.
      }
    })();
    return () => { cancelled = true; };
  }, [isAuthenticated, isLoadingAuth]);

  useEffect(() => {
    if (!['paused', 'recoverable', 'error'].includes(state.phase)) return undefined;
    const retryWhenOnline = () => {
      if (!localRef.current) return;
      retry().catch(() => {});
    };
    window.addEventListener('online', retryWhenOnline);
    return () => window.removeEventListener('online', retryWhenOnline);
  }, [retry, state.phase]);

  useEffect(() => {
    const checkpointBufferedAudio = () => {
      const recorder = recorderRef.current;
      if (recorder?.state === 'recording') {
        try { recorder.requestData(); } catch { /* the next five-second checkpoint remains available */ }
      }
    };
    window.addEventListener('pagehide', checkpointBufferedAudio);
    document.addEventListener('visibilitychange', checkpointBufferedAudio);
    return () => {
      window.removeEventListener('pagehide', checkpointBufferedAudio);
      document.removeEventListener('visibilitychange', checkpointBufferedAudio);
    };
  }, []);

  useEffect(() => () => {
    clearTimers();
    // Do not deliberately stop an active recording on route changes: this
    // provider sits above the router and only unmounts when the app itself exits.
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, [clearTimers]);

  const value = useMemo(() => ({
    ...state,
    start,
    pause,
    resume,
    finish,
    retry,
    discard,
    reset,
    dockOpenRequest,
    openDock,
    refresh: () => state.session?.id ? refreshSession(state.session.id) : null,
  }), [discard, dockOpenRequest, finish, openDock, pause, refreshSession, reset, resume, retry, start, state]);

  return <PersistentTranscriptionContext.Provider value={value}>{children}</PersistentTranscriptionContext.Provider>;
}

export function usePersistentTranscription() {
  const value = useContext(PersistentTranscriptionContext);
  if (!value) throw new Error('usePersistentTranscription must be used within PersistentTranscriptionProvider');
  return value;
}
