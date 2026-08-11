<!--capability-notice
notice_id: 20260812-transcription-enabled
date: 2026-08-12
flags: TRANSCRIPTION_ENABLED, GENERAL_CLINICAL_LLM_ENABLED
direction: restores
release: v32
surfaces_affected: 33
owner_acknowledgement: "ALL AUTHORISATION IS GRANTED AND CORRIDORS GIVEN." — Maxwell Vidler mission order, 12 August 2026
expected_duration: Indefinite candidate posture; transcription remains deliberately off only in compatibility rollback.
capability-notice-->

# Production transcription enabled with capped provider usage

## User-visible effect

The production candidate enables SOAP-note audio transcription and transcript-to-SOAP dissection. Calls use the real provider under the production posture, are admitted through the durable per-user API usage ledger, and fail closed when the provider or accounting control is unavailable. The compatibility rollback keeps transcription off because its retained image predates that ledger. General clinical AI stays enabled in both candidate and rollback, preserving the live-v31 posture.

## Surfaces affected

The SOAP note's saved-recording **Transcribe** control and transcript **Dissect to SOAP** control are restored in production. The rollback correction also preserves the existing general clinical AI family across its 32 registered client call sites.

## Detection and monitoring

`server/tests/transcription-provider-contract.test.mjs` pins the real-provider, missing-key, cap-refusal, MIME, 20 MiB, model, settlement and labelled-selftest paths. `server/tests/rollback-compatibility.test.mjs` pins candidate transcription on, rollback transcription off, and general clinical AI on in both configurations. Both suites are registered in `server/tests/run-assurance.mjs`.

## Restoration criteria

If the forward release is rolled back, transcription stays unavailable until a forward image with the durable per-user usage ledger is redeployed and its production checks pass. A missing provider key, an unavailable ledger, or a user cap refusal never authorises a mock or an unaccounted provider call in production.
