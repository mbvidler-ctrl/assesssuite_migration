import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  Clipboard,
  FileHeart,
  Loader2,
  Mic,
  Pause,
  Play,
  RotateCcw,
  Square,
  Trash2,
  Waves,
} from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAiCapability } from '@/hooks/useAiCapability';
import { usePersistentTranscription } from '@/lib/transcription/PersistentTranscriptionContext';

function formatDuration(seconds) {
  const value = Math.max(0, Number(seconds) || 0);
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const secs = value % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    : `${minutes}:${String(secs).padStart(2, '0')}`;
}

function phaseLabel(phase) {
  return ({
    idle: 'Ready',
    starting: 'Starting',
    recording: 'Recording',
    paused: 'Paused',
    finalising: 'Saving and transcribing',
    recoverable: 'Saved — attention needed',
    ready: 'Clinical workspace ready',
    error: 'Recording storage error',
  })[phase] || phase;
}

function copyText(value, successMessage) {
  if (!value) return;
  navigator.clipboard.writeText(value).then(() => toast.success(successMessage));
}

export default function PersistentTranscriptionDock() {
  const transcriptionCapability = useAiCapability('transcription');
  const transcription = usePersistentTranscription();
  const [expanded, setExpanded] = useState(false);
  const [label, setLabel] = useState('');
  const [consent, setConsent] = useState(false);
  const [starting, setStarting] = useState(false);
  const active = transcription.phase !== 'idle';
  const open = expanded;

  useEffect(() => {
    if (transcription.dockOpenRequest > 0) setExpanded(true);
  }, [transcription.dockOpenRequest]);

  const soapText = useMemo(() => {
    const soap = transcription.session?.artifacts?.soap;
    if (!soap) return '';
    return [
      `Subjective\n${soap.subjective || ''}`,
      `Objective\n${soap.objective || ''}`,
      `Assessment\n${soap.assessment || ''}`,
      `Plan\n${soap.plan || ''}`,
    ].join('\n\n');
  }, [transcription.session?.artifacts]);
  const homeProgramText = useMemo(() => (
    (transcription.session?.artifacts?.home_program_actions || []).map((item) => `- ${item}`).join('\n')
  ), [transcription.session?.artifacts]);

  if (!transcriptionCapability.available) return null;

  const begin = async () => {
    setStarting(true);
    try {
      await transcription.start({ label, consentConfirmed: consent });
      setConsent(false);
      setLabel('');
      setExpanded(true);
    } catch (error) {
      toast.error(error?.message || 'Persistent transcription could not start.');
    } finally {
      setStarting(false);
    }
  };

  if (!open) {
    return (
      <Button
        type="button"
        aria-label={active ? `Open persistent transcription — ${phaseLabel(transcription.phase)}` : 'Open persistent transcription'}
        className="fixed bottom-3 right-3 z-40 h-12 w-12 rounded-full bg-teal-800 p-0 shadow-xl hover:bg-teal-900 sm:bottom-5 sm:right-5 sm:w-auto sm:px-5"
        onClick={() => setExpanded(true)}
      >
        <Mic className={`h-5 w-5 sm:mr-2 ${transcription.phase === 'recording' ? 'animate-pulse text-red-200' : ''}`} />
        <span className="hidden sm:inline">Persistent transcription{active ? ` · ${formatDuration(transcription.elapsedSeconds)}` : ''}</span>
      </Button>
    );
  }

  return (
    <Card className="fixed bottom-3 right-3 z-40 w-[min(430px,calc(100vw-1.5rem))] border-teal-200 bg-white/95 shadow-2xl backdrop-blur sm:bottom-4 sm:right-4 sm:w-[min(430px,calc(100vw-2rem))]">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base"><Waves className={`h-5 w-5 ${transcription.phase === 'recording' ? 'animate-pulse text-red-600' : 'text-teal-700'}`} />Persistent transcription</CardTitle>
            <div className="mt-2 flex flex-wrap items-center gap-2"><Badge variant="outline">{phaseLabel(transcription.phase)}</Badge>{active && <span className="font-mono text-sm font-semibold">{formatDuration(transcription.elapsedSeconds)}</span>}</div>
          </div>
          <Button type="button" size="icon" variant="ghost" aria-label="Collapse transcription" onClick={() => setExpanded(false)}><ChevronDown className="h-4 w-4" /></Button>
        </div>
      </CardHeader>
      <CardContent className="max-h-[70vh] space-y-4 overflow-y-auto">
        {transcription.phase === 'idle' && (
          <>
            <div className="rounded-lg border border-teal-100 bg-teal-50 p-3 text-xs text-teal-900">
              Recording continues while you move between AssessSuite sections. Audio is checkpointed locally every five seconds and uploaded in bounded parts, so a failed final upload does not erase the consultation.
            </div>
            <div className="space-y-2"><Label htmlFor="persistent-transcription-label">Session label</Label><Input id="persistent-transcription-label" value={label} onChange={(event) => setLabel(event.target.value)} placeholder="e.g. Initial assessment — optional" /></div>
            <div className="flex items-start gap-3 rounded-lg border border-slate-200 p-3">
              <Checkbox id="persistent-transcription-consent" checked={consent} onCheckedChange={(value) => setConsent(value === true)} />
              <Label htmlFor="persistent-transcription-consent" className="text-xs font-normal leading-relaxed">I have confirmed that recording and transcription may begin for this consultation.</Label>
            </div>
            <Button className="w-full bg-teal-800 hover:bg-teal-900" disabled={!consent || starting} onClick={begin}>{starting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mic className="mr-2 h-4 w-4" />}Start persistent transcription</Button>
          </>
        )}

        {active && (
          <>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-semibold text-slate-900">{transcription.session?.label || 'Consultation transcription'}</p>
              <p className="mt-1 text-xs text-slate-600">{transcription.localRecovery ? 'Recovery checkpoints active' : 'Server record active'} · {(transcription.session?.segments || []).length} saved part(s)</p>
            </div>
            {transcription.error && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">{transcription.error}</div>}
            <div className="flex flex-wrap gap-2">
              {transcription.phase === 'recording' && <Button type="button" variant="outline" onClick={transcription.pause}><Pause className="mr-2 h-4 w-4" />Pause safely</Button>}
              {['paused', 'recoverable', 'error'].includes(transcription.phase) && <Button type="button" variant="outline" onClick={transcription.resume}><Play className="mr-2 h-4 w-4" />Resume recording</Button>}
              {['recoverable', 'error'].includes(transcription.phase) && <Button type="button" variant="outline" onClick={transcription.retry}><RotateCcw className="mr-2 h-4 w-4" />Retry saved parts</Button>}
              {['recording', 'paused', 'recoverable', 'error'].includes(transcription.phase) && <Button type="button" className="bg-teal-800 hover:bg-teal-900" onClick={transcription.finish}><Square className="mr-2 h-4 w-4" />Finish &amp; prepare note</Button>}
              {transcription.phase === 'finalising' && <Button disabled><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving every part</Button>}
              {!['starting', 'finalising'].includes(transcription.phase) && <Button type="button" variant="ghost" className="text-red-700" onClick={transcription.discard}><Trash2 className="mr-2 h-4 w-4" />Discard</Button>}
            </div>
          </>
        )}

        {transcription.session?.transcript && (
          <div className="space-y-2 rounded-lg border border-slate-200 p-3">
            <div className="flex items-center justify-between"><p className="text-sm font-semibold">Verbatim transcript</p><Button type="button" size="sm" variant="ghost" onClick={() => copyText(transcription.session.transcript, 'Transcript copied.')}><Clipboard className="mr-1 h-3.5 w-3.5" />Copy</Button></div>
            <p className="max-h-32 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-slate-700">{transcription.session.transcript}</p>
          </div>
        )}

        {transcription.session?.artifacts && (
          <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
            <div className="flex items-center justify-between"><p className="flex items-center gap-2 text-sm font-semibold"><FileHeart className="h-4 w-4 text-emerald-700" />Clinical workspace</p><Check className="h-4 w-4 text-emerald-700" /></div>
            <p className="text-xs leading-relaxed text-slate-700">{transcription.session.artifacts.concise_summary}</p>
            {(transcription.session.artifacts.unresolved_clinical_questions || []).length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                <p className="font-semibold">Confirm before using</p>
                <ul className="mt-1 list-disc space-y-1 pl-4">{transcription.session.artifacts.unresolved_clinical_questions.map((item) => <li key={item}>{item}</li>)}</ul>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => copyText(soapText, 'SOAP draft copied for clinician review.')}><Clipboard className="mr-1 h-3.5 w-3.5" />Copy SOAP draft</Button>
              {transcription.session.artifacts.patient_facing_summary && <Button type="button" size="sm" variant="outline" onClick={() => copyText(transcription.session.artifacts.patient_facing_summary, 'Patient summary copied.')}><Clipboard className="mr-1 h-3.5 w-3.5" />Patient summary</Button>}
              {transcription.session.artifacts.referrer_update && <Button type="button" size="sm" variant="outline" onClick={() => copyText(transcription.session.artifacts.referrer_update, 'Referrer update copied.')}><Clipboard className="mr-1 h-3.5 w-3.5" />Referrer update</Button>}
              {homeProgramText && <Button type="button" size="sm" variant="outline" onClick={() => copyText(homeProgramText, 'Home-program actions copied.')}><Clipboard className="mr-1 h-3.5 w-3.5" />Home programme</Button>}
              <Button type="button" size="sm" variant="ghost" onClick={transcription.reset}>Close completed session</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
