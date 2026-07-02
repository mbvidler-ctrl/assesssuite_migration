// MOCK — this function is absent from the captured base44/functions/
// source (docs/source-capture). It is invoked by
// src/components/calendar/SOAPNoteModal.jsx (transcribeAudio around line
// 557, dissectToSOAP around line 576) via `base44.functions.invoke`, whose
// response is the raw (not-unwrapped) axios response object per the
// functions client contract — but both call sites destructure fields
// (`result?.transcript`, `result?.success`) directly off that value rather
// than off `result.data`, which is inconsistent with every other
// functions.invoke call site in this app (see AdminApprovals.jsx,
// PaymentRequired.jsx, which correctly read `response.data`). This mock
// implements the wire contract precisely as specified (JSON body matching
// the shapes SOAPNoteModal.jsx reads); the mismatch between that body and
// how SOAPNoteModal.jsx consumes the SDK's response envelope is a
// pre-existing call-site quirk in the captured source, not something a
// server-side mock can correct.
//
// Two actions, dispatched on body.action:
//   - 'transcribe'    : { audio_url } -> { transcript }
//   - 'dissect_to_soap': { transcript } -> { success, subjective, objective,
//                          assessment, plan }

export default async function transcribeSession(ctx) {
  const { body, respond } = ctx;
  const { action } = body || {};

  if (action === 'transcribe') {
    const { audio_url } = body || {};
    const label = audio_url ? audio_url.split('/').pop() : 'session recording';
    const transcript =
      `[Mock transcript for ${label}]\n\n` +
      `Clinician: How has your pain been since the last session?\n` +
      `Client: A little better, still stiff in the mornings.\n` +
      `Clinician: Let's run through today's exercises and reassess your range of motion.\n\n` +
      `(This is placeholder text produced by the local transcribeSession mock — no real audio ` +
      `transcription has occurred. transcribeSession is absent from the captured Base44 backend ` +
      `source and is implemented here as a deterministic stand-in.)`;
    return respond(200, { transcript });
  }

  if (action === 'dissect_to_soap') {
    const { transcript } = body || {};
    const hasTranscript = typeof transcript === 'string' && transcript.trim().length > 0;
    return respond(200, {
      success: true,
      subjective: hasTranscript
        ? 'Client reports improved pain levels since last session, with residual morning stiffness.'
        : 'Client reports as discussed during the session.',
      objective: 'Range of motion and exercise tolerance reassessed during today\'s session.',
      assessment: 'Client demonstrates continued progress consistent with the current treatment plan.',
      plan: 'Continue current exercise programme; reassess at next scheduled session.',
    });
  }

  return respond(400, { error: `Unknown action: ${action}` });
}
