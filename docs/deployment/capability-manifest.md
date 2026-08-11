<!-- GENERATED — Generated from server/capabilityFlags.mjs by scripts/flag-manifest.mjs. Do not edit by hand. Regenerate: npm run flags:write -->

# AssessSuite production capability switches

## What this page is for

This page lists every runtime switch that changes what the AssessSuite production deployment can do, in plain English. It is generated directly from the engineering registry (server/capabilityFlags.mjs), so it cannot drift silently out of date the way a hand-maintained runbook can. Read the "At a glance" table for the current posture, and the per-capability sections below it for exactly what a clinician or client sees when a switch is off.

## At a glance

| Capability | Switch | Production now | Rollback config | Self-test bypass | What the clinic loses when it is off |
|---|---|---|---|---|---|
| Self-service sign-up | `ALLOW_OPEN_REGISTRATION` | `1` | `1` | SELFTEST=1 treats it as on | The public sign-up, email-verification and resend-code pages return a plain "self-registration is disabled" error; existing accounts are unaffected. |
| Referral document extraction | `DOCUMENT_EXTRACTION_ENABLED` | `1` | `0` | none | Referral upload continues to accept and store the file, but automated field extraction refuses with "Document extraction is currently unavailable." — practitioners must key the referral details in by hand. |
| Under-13 document extraction | `DOCUMENT_EXTRACTION_UNDER_13_ENABLED` | `0` | `0` | none | Extraction of an under-13 (or age-unknown) referral document is refused with a privacy-review message; the practitioner keys the referral details in by hand instead. |
| Legacy general clinical AI drafting | `GENERAL_CLINICAL_LLM_ENABLED` | `1` | `1` | none | None of those AI-assisted actions can run; the exact user-visible effect (a disabled and labelled control, a labelled non-AI fallback, or — on the report surfaces not yet migrated to the capability hook — a plain error message) differs by surface, see the client-surfaces table. |
| Fail-loud AI provider posture | `LLM_REQUIRED` | `1` | `1` | none | A missing or failing AI provider falls back to the deterministic mock instead of failing loudly. This is a safety posture, not a feature switch: it does not change whether AI drafting is offered, only what happens when the real provider is unavailable. |
| Real transactional email delivery | `OUTBOUND_EMAIL_ENABLED` | `1` | `1` | SELFTEST/parity assurance force it off | Email is still written to the SQLite outbox (nothing is lost), but no real message is sent — recipients receive nothing, so a real inbox never sees the OTP code or notification. |
| Real SMS delivery | `OUTBOUND_SMS_ENABLED` | `0` | `0` | SELFTEST/parity assurance force it off | No change: SMS is outbox-only in every posture until a separately reviewed adapter and provider credential are implemented. |
| Real Stripe billing | `PAYMENTS_ENABLED` | `1` | `1` | SELFTEST/parity assurance force it off | Checkout, the billing portal, webhook handling and subscription sync all run against the deterministic mock instead of real Stripe; no real card charge or subscription can occur. |
| SOAP note transcription and dissection | `TRANSCRIPTION_ENABLED` | `1` | `0` | SELFTEST=1 treats it as on | The Transcribe/Dissect controls hide in the SOAP note UI, and the server refuses the underlying call with 403 transcription_disabled if it is somehow reached. |
| Upload audit legal hold | `UPLOAD_AUDIT_LEGAL_HOLD` | (absent) | (absent) | none | No change from the normal posture: upload-audit metadata is subject to the ordinary retention-driven cleanup schedule. |

## What a rollback would change today

| Capability | Switch | Production | Rollback |
|---|---|---|---|
| Referral document extraction | `DOCUMENT_EXTRACTION_ENABLED` | `1` | `0` |
| SOAP note transcription and dissection | `TRANSCRIPTION_ENABLED` | `1` | `0` |

## Per-capability detail

### Self-service sign-up (`ALLOW_OPEN_REGISTRATION`)

Controls whether a new practitioner can create their own account without an existing admin inviting them.

**When off:** The public sign-up, email-verification and resend-code pages return a plain "self-registration is disabled" error; existing accounts are unaffected.

**Server gates:**

| File | Route | Effect when off |
|---|---|---|
| `server/index.mjs` | POST /api/apps/:appId/auth/register | 403 "self-registration is disabled for this deployment" |
| `server/index.mjs` | POST /api/apps/:appId/auth/verify-otp | 403 "account verification is disabled for this deployment" |
| `server/index.mjs` | POST /api/apps/:appId/auth/resend-otp | 403 "account verification is disabled for this deployment" |

_No client-side detector: Registration is a full-page auth flow rather than an InvokeLLM/ExtractDataFromUploadedFile call site; a marker-based client detector would find nothing meaningful to count. The server-gate table above is the complete blast-radius record for this flag._

### Referral document extraction (`DOCUMENT_EXTRACTION_ENABLED`)

Controls whether an uploaded referral document is automatically read by the extraction provider to pre-fill the intake form.

**When off:** Referral upload continues to accept and store the file, but automated field extraction refuses with "Document extraction is currently unavailable." — practitioners must key the referral details in by hand.

**Server gates:**

| File | Route | Effect when off |
|---|---|---|
| `server/index.mjs` | (boot-time invariant, not a per-request route) | No boot-time throw; the rollback-only LEGAL_COMPATIBILITY_ACCEPTED_VERSIONS allowlist may be set safely. When this flag is "1", setting that allowlist throws at start-up instead. |
| `server/documentExtraction.mjs` | POST /integration-endpoints/Core/ExtractDataFromUploadedFile | 503 extraction_disabled "Document extraction is currently unavailable." |
| `server/capabilities.mjs` | GET /api/apps/public/prod/public-settings/by-id/:appId (publication of the enforced posture) | public_settings.capabilities.document_extraction is published as { available: false, reason: "switched_off" }. |

_No client-side detector: ExtractDataFromUploadedFile( occurs in exactly one src/ file (src/lib/fileIntegrations.js, the SDK wrapper), so a marker-based detector would yield no useful surface set. The upload UI always offers the file picker; only the automated extraction step is gated server-side, so there is no client conditional to detect._

**Reported to the browser via:** GET /api/apps/public/prod/public-settings/by-id/:appId → public_settings.capabilities.document_extraction

### Under-13 document extraction (`DOCUMENT_EXTRACTION_UNDER_13_ENABLED`)

Additional fail-closed gate for referral documents whose subject is under 13 or whose age is unknown; must stay off until independently verified zero-data-retention evidence is recorded for the exact production provider project.

**When off:** Extraction of an under-13 (or age-unknown) referral document is refused with a privacy-review message; the practitioner keys the referral details in by hand instead.

**Server gates:**

| File | Route | Effect when off |
|---|---|---|
| `server/documentExtraction.mjs` | POST /integration-endpoints/Core/ExtractDataFromUploadedFile (subject under 13 or age unknown) | 409 under_13_review_required "This referral requires a privacy review before automated extraction can be used." |

_No client-side detector: Same reasoning as DOCUMENT_EXTRACTION_ENABLED: no InvokeLLM/ExtractDataFromUploadedFile-shaped client surface exists to detect; the gate is entirely server-side._

### Legacy general clinical AI drafting (`GENERAL_CLINICAL_LLM_ENABLED`)

The single switch behind every non-referral AI-assisted drafting action across the product: SOAP note assist, treatment protocols, nutrition advice, medication alerts, assessment recommendations, assessment audit, and the whole report suite (GP summary, DVA, private health, Form 32, custom reports).

**When off:** None of those AI-assisted actions can run; the exact user-visible effect (a disabled and labelled control, a labelled non-AI fallback, or — on the report surfaces not yet migrated to the capability hook — a plain error message) differs by surface, see the client-surfaces table.

**Server gates:**

| File | Route | Effect when off |
|---|---|---|
| `server/integrations.mjs` | POST /integration-endpoints/Core/InvokeLLM | 503 ai_capability_disabled "General AI generation is disabled on this server." |
| `server/capabilities.mjs` | GET /api/apps/public/prod/public-settings/by-id/:appId (publication of the enforced posture) | public_settings.capabilities.general_clinical_llm is published as { available: false, reason: "switched_off" }, which is what lets each client surface disable and label its control instead of failing when pressed. |

**Client surfaces (32 call site(s) across 15 file(s)):**

| File | Call sites | What the clinic sees | Detail |
|---|---|---|---|
| `src/components/calendar/SOAPNoteModal.jsx` | 2 | the control stays visible but is disabled and labelled as unavailable | The AI drafting assist inside a SOAP note is disabled and labelled as unavailable; the clinician writes the note unaided and sees no error. |
| `src/components/client/AssessmentRecommendations.jsx` | 1 | a non-AI substitute runs and is labelled as such | The panel falls back to catalogue keyword matching, but it is badged "Rule-based" and carries an explanation, so the substitution is stated rather than silent. |
| `src/components/client/MedicationAlerts.jsx` | 1 | the control stays visible but is disabled and labelled as unavailable | The card no longer attempts the AI considerations and says AI writing assistance is unavailable; the authoritative openFDA and RxNorm label data still renders. |
| `src/components/client/NutritionPlanCreator.jsx` | 1 | the control stays visible but is disabled and labelled as unavailable | The control that drafts nutrition plan advice is disabled and labelled as unavailable; none of the three advice fields populate and no error is shown. |
| `src/components/reports/CustomReportGenerator.jsx` | 2 | an error message where the text should be | Generating a custom report section fails with an error message where the drafted text should appear. |
| `src/components/reports/DVAPatientCarePlan.jsx` | 4 | an error message where the text should be | Generating any section of the DVA care plan report fails with an error message where the drafted text should appear. |
| `src/components/reports/Form32Generator.jsx` | 1 | an error message where the text should be | Generating the Form 32 report fails with an error message where the drafted text should appear. |
| `src/components/reports/GPSummary.jsx` | 4 | an error message where the text should be | Generating any section of the GP summary report fails with an error message where the drafted text should appear. |
| `src/components/reports/PDFFormFiller.jsx` | 2 | the feature is unreachable | No user-visible effect: this tree is orphaned/unreachable legacy code, flagged in the 21 July 2026 change for a human removal decision that has not yet been made. |
| `src/components/reports/PrivateHealthInitialAssessment.jsx` | 3 | an error message where the text should be | Generating any section of the private health initial assessment report fails with an error message where the drafted text should appear. |
| `src/components/reports/PrivateHealthProgressReport.jsx` | 4 | an error message where the text should be | Generating any section of the private health progress report fails with an error message where the drafted text should appear. |
| `src/components/reports/wizard-steps/SectionEditor.jsx` | 3 | the control stays visible but is disabled and labelled as unavailable | Generate, Regenerate and Tidy stay visible on every report wizard section but are disabled and labelled as unavailable, rather than failing when pressed. |
| `src/pages/AssessmentAudit.jsx` | 2 | the control stays visible but is disabled and labelled as unavailable | The controls that draft the AI-authored contraindications, scoring and instructions text are disabled and labelled as unavailable. |
| `src/pages/ClientConditions.jsx` | 1 | the control stays visible but is disabled and labelled as unavailable | Condition-based assessment suggestions are disabled and labelled as unavailable; a failed attempt reports its error state instead of rendering an empty panel. |
| `src/pages/TreatmentProtocols.jsx` | 1 | the control stays visible but is disabled and labelled as unavailable | Generating a custom (non-catalogue) treatment protocol is disabled and labelled as unavailable; the reviewed catalogue lookup is unaffected and remains available. |

**Reported to the browser via:** GET /api/apps/public/prod/public-settings/by-id/:appId → public_settings.capabilities.general_clinical_llm (tri-state: available, switched_off, unconfigured)

**Caveats:**

- The self-test mock carve-out compares against `undefined`. Exporting the variable as an empty string defeats it; this is current, deliberate behaviour, recorded rather than changed.

### Fail-loud AI provider posture (`LLM_REQUIRED`)

When on, InvokeLLM never silently substitutes mock clinical content: a real-model failure returns a loud 502 and a missing provider key returns 503, instead of quietly serving placeholder text.

**When off:** A missing or failing AI provider falls back to the deterministic mock instead of failing loudly. This is a safety posture, not a feature switch: it does not change whether AI drafting is offered, only what happens when the real provider is unavailable.

**Server gates:**

| File | Route | Effect when off |
|---|---|---|
| `server/integrations.mjs` | POST /integration-endpoints/Core/InvokeLLM (and every internal caller of invokeLLM) | A missing key or a provider failure returns the deterministic placeholder mock content instead of a 502/503. |
| `server/functions/transcribeSession.mjs` | POST /functions/transcribeSession (action: dissect_to_soap) | A missing key or a failed dissection falls through to the mock SOAP note (always carrying simulated: true) instead of returning 503/502. |
| `server/capabilities.mjs` | GET /api/apps/public/prod/public-settings/by-id/:appId (publication of the enforced posture) | A switched-on capability with no provider configured is published as available rather than { available: false, reason: "unconfigured" }, matching the mock-fallback the endpoint would actually serve. |

_No client-side detector: LLM_REQUIRED governs server-side failure behaviour only; it does not gate any client call site, so a marker-based detector has nothing to find._

### Real transactional email delivery (`OUTBOUND_EMAIL_ENABLED`)

Controls whether transactional email (OTP codes, password resets, admin notifications) is actually sent via Resend, as opposed to being recorded to the outbox only.

**When off:** Email is still written to the SQLite outbox (nothing is lost), but no real message is sent — recipients receive nothing, so a real inbox never sees the OTP code or notification.

**Server gates:**

| File | Route | Effect when off |
|---|---|---|
| `server/email.mjs` | (internal — every sendEmail() call site, including OTP and admin notifications) | sendEmail() records to the outbox and returns { recorded: true, sent: false } without a network call. |
| `server/index.mjs` | (internal — startup/health posture only) | Reports that transactional email delivery is not required/live for this run. |

_No client-side detector: Email delivery is a server-side egress switch with no client-side conditional to detect; the outbox path is identical from the browser’s point of view either way._

### Real SMS delivery (`OUTBOUND_SMS_ENABLED`)

Explicit future capability gate for a real SMS adapter. No real SMS transport exists yet — the SendSMS implementation remains outbox-only regardless of this value, so this switch documents the no-egress posture rather than currently changing behaviour.

**When off:** No change: SMS is outbox-only in every posture until a separately reviewed adapter and provider credential are implemented.

**Server gates:**

| File | Route | Effect when off |
|---|---|---|
| `server/email.mjs` | (internal — reserved for a future real-SMS adapter; SendSMS is outbox-only today regardless) | No behaviour change today; the outbox-only SendSMS implementation does not branch on this value. |

_No client-side detector: No real SMS adapter exists yet, so there is no client-side conditional this flag could gate._

### Real Stripe billing (`PAYMENTS_ENABLED`)

Controls whether the four billing functions (checkout, portal, webhook, subscription sync) call the real Stripe API, as opposed to the deterministic mock.

**When off:** Checkout, the billing portal, webhook handling and subscription sync all run against the deterministic mock instead of real Stripe; no real card charge or subscription can occur.

**Server gates:**

| File | Route | Effect when off |
|---|---|---|
| `server/stripeGateway.mjs` | the four billing functions (createCheckoutSession, createPortalSession, stripeWebhook, syncStripeSubscription) | Every gated Stripe function uses server/mocks/stripe.mjs instead of a real network call. |

_No client-side detector: Payment mode selection is a server-side switch with no client-side conditional to detect; the billing UI is identical either way._

### SOAP note transcription and dissection (`TRANSCRIPTION_ENABLED`)

Controls whether a clinician can turn a recorded consult into a draft SOAP note via Whisper transcription and AI dissection. Audio recording itself always stays available; only the Transcribe/Dissect step is gated.

**When off:** The Transcribe/Dissect controls hide in the SOAP note UI, and the server refuses the underlying call with 403 transcription_disabled if it is somehow reached.

**Server gates:**

| File | Route | Effect when off |
|---|---|---|
| `server/functions/transcribeSession.mjs` | POST /functions/transcribeSession | 403 transcription_disabled "Transcription is not enabled on this deployment." |
| `server/capabilities.mjs` | GET /api/apps/public/prod/public-settings/by-id/:appId (publication of the enforced posture) | public_settings.capabilities.transcription is published as { available: false, reason: "switched_off" }, and the legacy public_settings.transcription_enabled boolean reports false. |

**Client surfaces (1 call site(s) across 1 file(s)):**

| File | Call sites | What the clinic sees | Detail |
|---|---|---|---|
| `src/components/calendar/SOAPNoteModal.jsx` | 1 | the feature is unreachable | The Transcribe and Dissect-to-SOAP controls are hidden entirely; recording remains available. |

**Reported to the browser via:** GET /api/apps/public/prod/public-settings/by-id/:appId → public_settings.capabilities.transcription (implied-on, mirrors the server gate) and the legacy public_settings.transcription_enabled boolean (strict/configured)

**Caveats:**

- `dissect_to_soap` used to return an unlabelled mock SOAP note with `success: true` on provider failure even when `LLM_REQUIRED=1` (Phase A finding A3). That path now fails closed — 502 on a failed real dissection, 503 when no provider is configured — and any mock it is still allowed to serve carries `simulated: true`. This switch never governed that behaviour; `LLM_REQUIRED` does.
- The legacy `public_settings.transcription_enabled` boolean reports the strict/configured value, while the server gate and the `public_settings.capabilities.transcription` entry are implied-on (they honour SELFTEST=1). The divergence is deliberate: the legacy alias keeps its pre-existing meaning for bundles built before the capabilities block existed.

### Upload audit legal hold (`UPLOAD_AUDIT_LEGAL_HOLD`)

When on, suspends the routine deletion of upload-audit metadata records that scheduled retention cleanup would otherwise remove.

**When off:** No change from the normal posture: upload-audit metadata is subject to the ordinary retention-driven cleanup schedule.

**Server gates:**

| File | Route | Effect when off |
|---|---|---|
| `server/uploadRegistry.mjs` | (internal — scheduled upload-audit retention cleanup) | Retention cleanup proceeds normally; audit rows are not exempted from deletion. |

_No client-side detector: This posture governs a scheduled server-side cleanup job with no client-side conditional to detect._

## Change history

- [`20260812-transcription-enabled.md`](notices/20260812-transcription-enabled.md)
- [`20260728-general-clinical-llm-restored.md`](notices/20260728-general-clinical-llm-restored.md)
- [`20260721-general-clinical-llm-disabled.md`](notices/20260721-general-clinical-llm-disabled.md)
