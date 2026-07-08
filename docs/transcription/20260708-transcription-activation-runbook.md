# Transcription activation runbook — SOAP-note session audio

Date: 8 July 2026
Scope: `server/functions/transcribeSession.mjs` (backend), `src/components/calendar/SOAPNoteModal.jsx` (frontend)

## 1. What changed

The `transcribeSession` function is no longer a pure mock. It now has a real, env-gated path for both of its actions:

- **`transcribe`** — loads the uploaded recording from `server/uploads/` (mapped safely from the `/uploads/<name>` URL, with path-traversal rejected) and posts it to the OpenAI audio transcriptions endpoint (`https://api.openai.com/v1/audio/transcriptions`) using Node 24 built-ins only (`fetch`, `FormData`, `Blob` — no new dependencies). The returned transcript is passed through the de-identification middleware in `server/llm.mjs` before it is returned to the browser.
- **`dissect_to_soap`** — calls `invokeLLM()` from `server/llm.mjs` with a clinical-scribe prompt and a `{success, subjective, objective, assessment, plan}` JSON schema. De-identification, model selection and JSON handling are supplied by `llm.mjs` as for every other LLM feature.

The frontend defect that produced the original complaint is also fixed: `SOAPNoteModal.jsx` contained complete `transcribeAudio` and `dissectToSOAP` handlers that were never wired to any control. Each saved recording now carries a **Transcribe** button, and a transcript panel with a **Dissect to SOAP** button appears once transcription starts.

## 2. Activation — nothing further is required

The real path activates automatically wherever `OPENAI_API_KEY` is present in the environment:

- **Locally** — the key is already set in `.env.local`, which `server/index.mjs` loads on start (set-if-absent, so real environment variables always win).
- **On Fly** — the key is already set as a Fly secret. Deploying the current code is sufficient.

No new secret, flag or migration is needed.

## 3. Model selection

| Variable | Default | Notes |
|---|---|---|
| `OPENAI_TRANSCRIBE_MODEL` | `whisper-1` | Dedicated audio-transcription model. Set to `gpt-4o-mini-transcribe` for a cheaper alternative; no code change is required. |

The `dissect_to_soap` step uses the chat models already configured for the platform (`OPENAI_MODEL_FAST`, default `gpt-4.1-mini`; `OPENAI_MODEL_QUALITY`, default `gpt-4.1`) via `server/llm.mjs`.

## 4. Expected cost

`whisper-1` is priced at approximately USD 0.006 per minute of audio (about USD 0.36 per hour). A typical two-minute demo recording therefore costs of the order of one cent to transcribe, plus a fraction of a cent for the dissection call. Nothing in the repository documentation records a contrary figure; confirm the current rate on the OpenAI pricing page if precision matters, as prices change.

## 5. Fallback behaviour

The deterministic mock remains in place and is served whenever any of the following holds:

- `OPENAI_API_KEY` is not set;
- the process is a self-test run (`SELFTEST=1` — the self-test never makes a network call);
- the `audio_url` does not resolve safely to a file inside `server/uploads/`;
- the uploaded file is missing;
- the OpenAI call fails or times out (120 seconds for transcription; 45 seconds for dissection via `llm.mjs`).

The fallback transcript is clearly labelled as placeholder output ("Fallback transcript ... no real audio transcription has occurred"), so a fallback can never be mistaken for a real transcript. Failures are logged to the server console with a `[transcribeSession]` prefix.

## 6. Browser microphone permission

Recording uses `navigator.mediaDevices.getUserMedia`, which browsers expose only in a **secure context**:

- `https://` origins work — the Fly deployment (`*.fly.dev`) is served over HTTPS and is fine;
- `http://localhost` is treated as secure by all major browsers, so local development works;
- any other plain-`http` origin will not offer the microphone at all.

The browser prompts for microphone permission on first use per origin. If the demo machine has previously denied permission, re-enable it from the padlock icon in the address bar; the modal shows "Failed to start recording. Check microphone permissions." in that state.

## 7. Sixty-second manual test

1. Start the server and open the app (locally: `npm run dev`, or use the Fly URL).
2. Sign in, open the calendar, and open a session's SOAP note (a seeded appointment is fine).
3. In **Session Audio Recording**, press **Record**, grant the microphone prompt, and speak for ten to fifteen seconds — for example: "The client reports their knee pain has improved since last week but remains stiff in the mornings. Today we reassessed range of motion at one hundred and ten degrees of flexion and completed three sets of sit-to-stand. The plan is to progress resistance next session."
4. Press **Stop** and wait for "Recording saved!" (the file uploads to `/uploads/` at this point).
5. Press **Transcribe** on the saved recording. The transcript panel opens; within roughly ten to thirty seconds the real transcript appears. If the text begins "[Fallback transcript ...]" the real path did not run — check the server log for the `[transcribeSession]` failure reason.
6. Press **Dissect to SOAP**. The Subjective, Objective, Assessment and Plan fields populate from the transcript content (appended to any existing text).
7. Save the note.

## 8. Verification notes

- `SELFTEST=1` exercises only the mock path; the existing self-test (`server/selftest.mjs`) posts `{action: 'transcribe', audio_url: '/uploads/probe.webm'}` and continues to pass without live calls.
- The path guard rejects traversal (`..`, separators, encoded traversal, absolute paths, NUL) and anything not resolving to a direct child of `server/uploads/`.
