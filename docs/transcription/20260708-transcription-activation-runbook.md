# Transcription activation runbook — SOAP-note session audio

Updated: 12 August 2026
Scope: `server/functions/transcribeSession.mjs`, `server/apiUsage.mjs`, `src/components/calendar/SOAPNoteModal.jsx`

## 1. Production behaviour

`TRANSCRIPTION_ENABLED=1` exposes two SOAP-note actions:

- **`transcribe`** resolves the authenticated tenant's registered audio upload and sends it to the OpenAI audio transcription endpoint. The model is pinned to `whisper-1`; the request asks for `verbose_json` so provider-reported duration can settle actual cost. Returned text passes through `deidentify()` before it reaches the browser.
- **`dissect_to_soap`** uses the existing clinical-scribe prompt and schema through `invokeLLMWithUsage()`. The same de-identification, model selection and JSON parsing used by the general LLM adapter remain in place, while token counts and provider request IDs are returned for settlement.

Each real provider call first writes a durable, user-bound usage reservation. A cap refusal, missing ledger, unpriced model or malformed estimate stops the request before provider egress. Successful calls settle actual duration/token cost; failed provider calls settle as failed and retain their conservative reservation so retries cannot bypass the cap.

## 2. Reviewed release posture

| Environment | General clinical AI | Transcription | Reason |
|---|---:|---:|---|
| Production candidate | `1` | `1` | Real, capped transcription enabled. |
| Compatibility rollback | `1` | `0` | The retained image predates the durable per-user usage ledger. |
| Hidden parity runtime | `0` | `0` | Deliberately offline synthetic fixture; no provider calls. |

Production also requires `LLM_REQUIRED=1`, `OPENAI_API_KEY` as an opaque secret and `OPENAI_TRANSCRIBE_MODEL="whisper-1"` as reviewed configuration. `scripts/check-production-secrets.mjs` forbids an opaque model or feature-switch override.

## 3. Audio contract

- Browser recording selects a supported WebM/Opus or MP4 MediaRecorder MIME type and names the uploaded file to match the actual container.
- Client and server both enforce a maximum of **20 MiB**.
- The function accepts registered direct-child uploads with WebM, WAV, MP3, MP4/M4A, OGG or FLAC extensions. An unsupported extension returns `415 unsupported_audio_type`; an oversized recording returns `413 audio_too_large` before usage admission or provider egress.
- Recording remains available when transcription is switched off. Only Transcribe and Dissect-to-SOAP follow the provider-aware capability posture.

## 4. Cost and cap basis

The in-repository price registry uses USD 0.006 per audio minute for `whisper-1`. The default reservation is deliberately conservative at USD 3.00 per transcription and USD 0.33 per SOAP dissection, then successful calls settle to provider-reported duration/token usage, including cached input tokens when reported. The default per-user rolling-24-hour guard is the earlier of USD 5.00 or 100 provider calls; the default project monthly circuit is USD 100.00. Reviewed environment variables in `server/apiUsage.mjs` can lower or raise those bounded values.

These are operational estimates and admission settings, not an invoice guarantee. Recheck provider pricing before changing a model or price-registry entry; an unpriced model fails closed.

## 5. Failure and simulation rules

Production never substitutes a mock for a real transcription or SOAP dissection:

- switch off: `403 transcription_disabled`;
- provider key missing: `503 transcription_provider_unconfigured`;
- accounting unavailable: `503 api_usage_accounting_unavailable` (or `api_usage_unavailable` if the bound service is absent);
- per-user/project cap reached: `429 api_usage_cap_reached`, including reset metadata;
- provider failure: `502 transcription_provider_failed`;
- missing transcript for production SOAP dissection: `400 transcript_required`.

`SELFTEST=1` remains fully offline and may return deterministic content with `simulated: true`. Non-production with `LLM_REQUIRED` unset may also use the same visibly labelled convenience fallback. Production bootstrap forbids `SELFTEST=1`.

## 6. Browser microphone permission

Media capture requires a secure context (`https://` or localhost). If microphone access was denied, re-enable it in the browser's site permissions. A browser that cannot produce an accepted WebM or MP4 recording receives a format-specific error before upload.

## 7. Lean verification

Run:

```powershell
node --test server/tests/transcription-provider-contract.test.mjs
node --test server/tests/soap-dissection-fail-closed.test.mjs
node --test server/tests/public-capabilities-contract.test.mjs
node --test server/tests/rollback-compatibility.test.mjs
```

For a manual production-candidate check: open an unlocked SOAP note, record a short synthetic session, save it, press **Transcribe**, then **Dissect to SOAP**. Confirm the transcript is real (`simulated: false` in the response), the four drafted fields are visibly marked as AI-assisted, and the API usage ledger contains succeeded `transcription` and `soap_dissection` rows for the authenticated user. Do not use patient data for a synthetic release check.

## 8. Assurance ownership

`server/tests/transcription-provider-contract.test.mjs` covers the switch, missing key, labelled self-test, MIME, 20 MiB limit, missing accounting, cap response, model pin, provider failure and both settlement paths. It is registered in `server/tests/run-assurance.mjs`. Hidden parity fixtures stay deliberately off; they are not evidence of a live transcription call.
