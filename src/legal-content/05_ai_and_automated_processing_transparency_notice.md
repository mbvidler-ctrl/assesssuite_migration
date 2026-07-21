# AssessSuite AI and Automated Processing Transparency Notice

**Release status:** APPROVED FOR PUBLICATION WITH THE 19 JULY 2026 RELEASE — FUNCTION ACTIVATION REMAINS SUBJECT TO THE GATES BELOW  
**Effective date:** 19 July 2026
**Publication authority:** Mission UM-AUTO-20260719-ASSESSSUITE-REFERRAL-SIGNUP-RELEASE, activated by Maxwell Vidler on 19 July 2026  
**Approved by:** Maxwell Vidler under mission UM-AUTO-20260719-ASSESSSUITE-REFERRAL-SIGNUP-RELEASE on 19 July 2026
**Version:** RC-2026.07.19
**Controlled revision:** 21 July 2026, revision 2026-07-21.2, authorised by mission UM-AUTO-20260720-ASSESSSUITE-REFERRAL-RECOVERY

**Change note:** Revision 2026-07-21.2 corrects the provider-call topology and review-time child gate. AssessSuite sends one separate Responses API request per selected file, up to four files, and deterministically merges independently validated results in the application only after every required file succeeds. At mandatory review, selecting an existing client whose reviewed date of birth shows an under-13 patient, or entering or correcting the proposed date of birth so it shows an under-13 patient, makes the create/update commit fail before any clinical write; every upload in that review becomes unavailable and remains blocked from provider retry. Revision 2026-07-21.1's categorical pre-provider gate, request-side retention minimisation, mandatory review, lifecycle, audit, snapshot, restore and patient-authority corrections remain in force. The revised bytes produce a new document fingerprint, so a prior receipt for this notice does not satisfy the current document-bound acceptance gate.

## 1. Why this notice exists

AssessSuite uses or proposes to use automated and AI-supported functions in a clinical workflow. This notice explains what those functions do, what information they may receive, their limits, the role of the practitioner, and how a person can question or correct an output.

It does not authorise a function that is marked disabled, test-only or awaiting TGA, privacy, security or clinical approval.

## 2. Feature register

The production release must publish and version a feature register in this form:

| Function | Typical input | Output or use | Human decision | Production status at RC-2026.07.19 |
|---|---|---|---|---|
| Referral/document extraction | Up to four raw PDF or image referrals, or bounded locally parsed CSV files; may identify an adult or child; each selected file is sent in a separate provider request | Independently validated per-file results deterministically merged by AssessSuite into proposed client-profile fields shown in an editable review step only after every required file succeeds | Practitioner compares every source, corrects the proposal and affirmatively creates or updates the record | Approved for activation only while authenticated tenant/file controls, the configured OpenAI arrangement, request-policy checks, the categorical 13-or-over gate, durable provider-output and review-time under-13 quarantine, upload lifecycle controls and release tests pass. A referral not categorically confirmed as 13 or older is blocked; provider processing known or suspected to concern under-13/applicable-digital-consent data remains unapproved unless the required Zero Data Retention control is verified. |
| Consultation transcription | Raw audio and session metadata | Draft transcript or note | Practitioner corrects and approves | Blocked pending recording consent and approved OpenAI/data flow |
| SOAP note assistance | Patient history, observations and note text | Draft assessment and plan text | Practitioner verifies, edits and signs | Blocked for real data pending TGA and clinical controls |
| Assessment interpretation | Measurements, scores, norms and patient context | Interpretation or recommendation | Practitioner selects and justifies use | Blocked pending feature-level TGA and evidence review |
| Treatment protocol assistance | Condition, goals, assessments and clinical context | Suggested protocol or exercise content | Practitioner independently decides | Blocked pending TGA, evidence and content-licence review |
| Medication considerations | Medication and clinical context | Interaction, precaution or consideration text | Practitioner verifies against authoritative Australian sources and refers as needed | Blocked pending safety and source validation |
| Report drafting | Referral, record, assessments and notes | Draft GP, funder or clinical report | Practitioner checks program rules, edits and signs | Documentation-only pathway may be approved after classification and data-flow review |
| Fixed calculations and established scores | Entered measurements | Deterministic result | Practitioner checks conditions and meaning | May be separately approvable after instrument licence and validation |

## 3. Information used

Depending on the function, information may include patient or child identity, date of birth, age, contact details, sex or gender data, health history, condition, medication, disability, referral and referrer details, funding and provider identifiers, goals, measurements, assessments, notes, recordings, funding context and practitioner instructions. Output, confidence or warning data, edits, approvals, model and prompt versions may also be retained for safety and audit.

Raw referral files, free text and audio must be treated as identifiable health information unless a validated process proves otherwise. Removing obvious contact details does not guarantee de-identification; names, rare conditions, dates, voices and combinations of facts may still identify a person. The referral/document-extraction path does not de-identify the source before transmission.

Referral extraction does not ask the practitioner to enter a separate date of birth before transmission. A date of birth may nevertheless appear in the referral itself and may be returned as a proposed field for practitioner review. The pre-transmission provider-age control records only the practitioner-attested category `13_or_over`, not a separately entered date of birth.

## 4. Providers, locations and retention

The referral/document-extraction provider is **OpenAI OpCo, LLC**, using the OpenAI API Responses service. This is an intentional disclosure for the bounded extraction purpose. For up to four selected files, AssessSuite sends one separate request per file: the raw PDF/image is sent inline as base64 input, while CSV is sent as bounded locally parsed text. AssessSuite independently validates every per-file result and, only after every required file succeeds, deterministically merges the results in selected-file order inside the application. It does not bundle all selected files into one provider request, create an OpenAI File, conversation, Assistant, thread or vector store, or report partial success if any file fails.

Before any provider call, AssessSuite constructs and checks each per-file request against a retention-minimising policy: `store: false`, `background: false`, `prompt_cache_retention: in_memory`, no tools, no prior Response or conversation state, and inline source content only. If any required request control is absent, the whole selected set fails closed. These request-side controls limit the processing path chosen by AssessSuite; they do not amount to a Zero Data Retention promise or displace the provider retention and exceptional-access qualifications below.

`store: false` prevents AssessSuite from asking OpenAI to retain the Response object. It is not a zero-retention promise. OpenAI’s published controls state that non-Zero-Data-Retention Responses requests may cache encrypted derived key/value tensors in GPU-local application state. AssessSuite requests the shortest documented in-memory policy supported by the selected pre-GPT-5.6 model; cached prefixes generally remain active for 5–10 minutes of inactivity and may remain for up to one hour. A model or project that does not honour the required request field is treated as a provider failure. Default abuse-monitoring logs may contain input, output and derived metadata for up to 30 days, with possible longer retention where required by law or reasonably necessary to protect the service or a third party. File and image inputs are scanned for child sexual abuse material; a potential match may be retained for manual review even if Zero Data Retention or Modified Abuse Monitoring applies.

OpenAI states that API content is not used to train or improve its models unless the customer expressly opts in. AssessSuite does not opt referral extraction into training, evaluation, feedback or data-sharing programmes and prohibits sale, research, marketing, product improvement and other secondary use of the referral or extracted health information.

OpenAI OpCo, LLC is located in the United States. Its published API subprocessor list includes infrastructure processing in the United States and other countries, content delivery at a data centre near the requester, and limited moderation/support processing in published locations. The current schedule does not assert Australian-only inference or storage. Support processing is initiated only if AssessSuite opens a case and supplies content; raw referrals must not be supplied to a support case without separate authority.

No person ordinarily reads a referral to generate the output. Limited human access may occur for flagged abuse/safety review, an AssessSuite-initiated support case, or legal compulsion. Maxwell Vidler attested for this release that the AssessSuite account has an account-specific arrangement authorising intentional sensitive-data transfer; its confidential contents were not requested or recorded. OpenAI’s current Under 18 API Guidance separately requires Zero Data Retention before processing personal data of a child under 13 or the applicable age of digital consent. The approved pre-provider path therefore blocks any referral not categorically confirmed as 13 or older, and processing known or suspected to concern that category remains unapproved until the relevant project control is verified.

## 5. How output is used

AI output is a draft or decision-support input. It must not make the final clinical, treatment, referral, funding, eligibility or safety decision. An appropriately qualified practitioner must review the source data and output, consider patient-specific risks and alternatives, correct errors, and affirmatively sign the final record.

For referral extraction, the proposed values remain unverified until the practitioner compares them with every submitted document. Extraction alone must not create or amend a client, referral, assessment or other clinical record. If any required file or per-file provider request fails, the whole selected set fails and the product must not silently exclude it or report complete or partial success. If any independently extracted proposed date of birth contradicts the pre-provider 13-or-over category, the application returns no merged clinical proposal, creates a durable content-free no-retry quarantine marker for the whole selected set, immediately revokes application access to every selected upload and schedules physical cleanup. After extraction enters mandatory review, the create/update commit also fails before any clinical write if the practitioner's selected existing client has a reviewed date of birth showing an under-13 patient or the practitioner enters or corrects the proposed date of birth to such a value. Every upload in that review then becomes unavailable to the application and remains blocked from provider retry. The durable marker must prevent a later provider call even if a related database quarantine update does not complete.

Before source bytes are written, AssessSuite creates a tenant- and purpose-bound upload registration and content-free authority audit receipt. An unbound source then receives an original live-storage cap no later than 24 hours after creation. Immediately before provider contact, its live expiry is durably reduced to the earlier of the existing expiry and one hour after processing starts. Successful extraction may restore only the time remaining under the original creation-plus-24-hour cap while mandatory review is pending. Closing, cancelling, rejecting or expiring review revokes ordinary application use and schedules cleanup; provider-output or mandatory-review under-13 quarantine immediately revokes application access to every upload in the selected set under the preceding paragraph. Physical removal occurs only when cleanup succeeds. If it does not, the source is isolated, removed from recurring minute-by-minute cleanup selection and placed in a review-required disposition process. A source leaves this temporary lifecycle only when the practitioner affirmatively creates or updates the clinical record and the application binds the source to that record. Routine production retention of content-free upload and extraction audit receipts is exactly 730 days; incident, complaint or legal-hold evidence may be preserved separately as required.

Revision 2026-07-21.2 becomes production-effective only if the trusted deployment verifies the live Sydney Fly source volume's encryption state, identifies the exact automatic scheduled-snapshot configuration and resulting snapshot evidence, pins retention to five days, and retains Fly provider assurance that snapshots and backups capture encrypted volume block devices without decrypting them. Fly exposes no separate per-snapshot encryption field, and this control does not claim one. After that gate passes, live-volume deletion does not retroactively purge bytes already captured in an unexpired snapshot. Snapshot bytes are not available through ordinary application access. Any restore requires separate administrative authority and a separate off-traffic volume; registration-state, expired, deleted and disposition-controlled uploads must be reconciled and database/file integrity checked before any separately authorised traffic switch. AssessSuite does not represent guaranteed restoration or a completed independent restoration exercise.

Human review is a necessary safety control, but it does not make an opaque or otherwise regulated product exempt from therapeutic-goods law.

## 6. Material limitations

An output may:

- be incomplete, incorrect, inconsistent or fabricated;
- omit text, misread handwriting or image quality, merge people or fields incorrectly, or assign a value to the wrong schema field;
- rely on an inappropriate population, threshold or source;
- miss a contraindication, red flag, medication issue or scope boundary;
- reflect bias in source data or modelling;
- confuse a funding or jurisdictional rule;
- expose information if input, tenant or access controls fail;
- change after a provider, prompt, source or model update.

AssessSuite must show material limitations at the point of use, not only in this notice.

## 7. Choice, consent and alternatives

Where recording, transcription or AI processing is optional, the patient must be offered a genuine non-AI or non-recorded alternative without loss of clinically necessary care. Consent must be specific to the function and may be withdrawn prospectively. The treating practice must record and honour that choice through its clinical process; this release does not represent that AssessSuite stores or administers the underlying patient consent or withdrawal record.

Where a practice or AssessSuite proposes to rely on another legal basis for a necessary function, a signed function-level authority record must identify each collector/holder, the sensitive information, necessity, APP 3/5 position, use/disclosure, provider, countries and retention. Until that record is approved, the function remains disabled or uses valid specific consent and a genuine alternative. A broad platform or treatment consent is not permission for future model training, sale, research, marketing or unrelated analytics.

Referral extraction may concern an adult or a child; paediatric care is within the scope of AssessSuite. The treating practice must assess capacity, verify any representative authority, involve the patient appropriately, give the applicable collection notice, document any required consent or other authority, and record and act on an objection, withdrawal or change in authority. AssessSuite does not store or verify those underlying patient-level records in this release. When the authenticated practitioner starts extraction, the action records only content-free evidence of a categorical attestation that the practice holds the required notice, consent or other function-specific authority and that the patient is 13 or older; no separately entered date of birth is required for the provider gate. A date of birth may be extracted as an unverified proposed value, and an under-13 contradiction triggers the fail-closed no-retry quarantine described in section 5. Provider processing known or suspected to concern a child under 13 or the applicable age of digital consent remains unapproved unless separately enabled after Zero Data Retention is verified for the relevant production project and the corresponding release gate is approved.

## 8. Review, correction and contestability

A patient may ask the treating practice to explain, review or correct a clinical output. They may also contact AssessSuite about the system, provenance or personal information we control. The practice and AssessSuite must cooperate so a person is not sent in circles.

For referral extraction, the product retains content-free provenance identifying the upload integrity hash, practice and initiating practitioner, function, selected model, prompt/schema versions, provider status class and time. The source is bound to a clinical entity only after the practitioner affirmatively creates or updates that record. Practitioner edits and final clinical approval remain evidenced by the resulting clinical record and its available amendment history; AssessSuite does not represent that this release stores a field-by-field AI-edit replay. Signed records are corrected by an auditable amendment.

## 9. Automated decisions from 10 December 2026

If a computer program makes or does something substantially and directly related to a decision that could significantly affect a person’s rights or interests, the Privacy Policy must describe the kinds of personal information and decisions covered by APP 1.7–1.9.

AssessSuite’s intended position is that final clinical and funding decisions are made by a practitioner or authorised program decision-maker. Because AI recommendations may still be substantially related to those decisions, we will assess and disclose them rather than relying on the presence of a human as a blanket exclusion.

## 10. Safety incidents and changes

Users and patients may report an unsafe, discriminatory, inexplicable or privacy-affecting output to admin@assesssuite.com or 1800 317 553. Urgent clinical concerns must also follow the treating practice’s emergency pathway.

AssessSuite will assess patterns, suspend an affected function where necessary, preserve evidence, notify relevant customers and regulators where required, and document corrective action and rollback. A material provider, model, intended-purpose or data-use change triggers renewed assessment, notice and, where required, consent or contract acceptance.

This RC-2026.07.19 notice, as controlled-revised on 21 July 2026, materially changes the disclosed data flow. Existing practitioners must complete document-bound re-acceptance for each practice membership before clinical access continues. The event records this notice’s identifier, title, suite version, exact current content fingerprint and practice context; it does not state that the patient consented or that direct customer email notice occurred.
