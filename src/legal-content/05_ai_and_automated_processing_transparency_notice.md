# AssessSuite AI and Automated Processing Transparency Notice

**Release status:** APPROVED FOR PUBLICATION WITH THE 19 JULY 2026 RELEASE — FUNCTION ACTIVATION REMAINS SUBJECT TO THE GATES BELOW  
**Effective date:** Effective on verified deployment; deployment date recorded in the release manifest  
**Publication authority:** Mission UM-AUTO-20260719-ASSESSSUITE-REFERRAL-SIGNUP-RELEASE, activated by Maxwell Vidler on 19 July 2026  
**Approved by:** Maxwell Vidler under the activated mission authority
**Version:** RC-2026.07.19

## 1. Why this notice exists

AssessSuite uses or proposes to use automated and AI-supported functions in a clinical workflow. This notice explains what those functions do, what information they may receive, their limits, the role of the practitioner, and how a person can question or correct an output.

It does not authorise a function that is marked disabled, test-only or awaiting TGA, privacy, security or clinical approval.

## 2. Feature register

The production release must publish and version a feature register in this form:

| Function | Typical input | Output or use | Human decision | Production status at RC-2026.07.19 |
|---|---|---|---|---|
| Referral/document extraction | Raw PDF or image referral, or bounded locally parsed CSV text; may identify an adult or child | Proposed client-profile fields shown in an editable review step | Practitioner compares every source, corrects the proposal and affirmatively creates or updates the record | Approved only after the authenticated tenant/file controls, OpenAI contract and retention controls, child-data gate and release tests pass |
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

## 4. Providers, locations and retention

The referral/document-extraction provider is **OpenAI OpCo, LLC**, using the OpenAI API Responses service. AssessSuite sends the raw PDF/image inline as base64 input, or sends bounded locally parsed text for CSV, in a single request with `store: false`. It does not create an OpenAI File, conversation, Assistant, thread or vector store and does not use background mode, web search or an external tool for this function.

`store: false` prevents AssessSuite from asking OpenAI to retain the Response object. It is not a zero-retention promise. OpenAI’s published controls state that non-Zero-Data-Retention Responses requests may cache encrypted derived key/value tensors in GPU-local application state. AssessSuite requests the shortest documented in-memory policy supported by the selected pre-GPT-5.6 model; cached prefixes generally remain active for 5–10 minutes of inactivity and may remain for up to one hour. A model or project that does not honour that request is treated as a provider failure. Default abuse-monitoring logs may contain input, output and derived metadata for up to 30 days, with possible longer retention where required by law or reasonably necessary to protect the service or a third party. File and image inputs are scanned for child sexual abuse material; a potential match may be retained for manual review even if Zero Data Retention or Modified Abuse Monitoring applies.

OpenAI states that API content is not used to train or improve its models unless the customer expressly opts in. AssessSuite does not opt referral extraction into training, evaluation, feedback or data-sharing programmes and prohibits sale, research, marketing, product improvement and other secondary use of the referral or extracted health information.

OpenAI OpCo, LLC is located in the United States. Its published API subprocessor list includes infrastructure processing in the United States and other countries, content delivery at a data centre near the requester, and limited moderation/support processing in published locations. The current schedule does not assert Australian-only inference or storage. Support processing is initiated only if AssessSuite opens a case and supplies content; raw referrals must not be supplied to a support case without separate authority.

No person ordinarily reads a referral to generate the output. Limited human access may occur for flagged abuse/safety review, an AssessSuite-initiated support case, or legal compulsion. Maxwell Vidler attested for this release that the AssessSuite account has an account-specific arrangement authorising intentional sensitive-data transfer; its confidential contents were not requested or recorded. OpenAI’s current Under 18 API Guidance separately requires Zero Data Retention before processing personal data of a child under 13 or the applicable age of digital consent, so that category remains disabled until the relevant project control is verified.

## 5. How output is used

AI output is a draft or decision-support input. It must not make the final clinical, treatment, referral, funding, eligibility or safety decision. An appropriately qualified practitioner must review the source data and output, consider patient-specific risks and alternatives, correct errors, and affirmatively sign the final record.

For referral extraction, the proposed values remain unverified until the practitioner compares them with every submitted document. Extraction alone must not create or amend a client, referral, assessment or other clinical record. If a required file fails, the product must not silently exclude it or report complete success.

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

Where recording, transcription or AI processing is optional, the patient must be offered a genuine non-AI or non-recorded alternative without loss of clinically necessary care. Consent must be specific to the function and may be withdrawn prospectively.

Where a practice or AssessSuite proposes to rely on another legal basis for a necessary function, a signed function-level authority record must identify each collector/holder, the sensitive information, necessity, APP 3/5 position, use/disclosure, provider, countries and retention. Until that record is approved, the function remains disabled or uses valid specific consent and a genuine alternative. A broad platform or treatment consent is not permission for future model training, sale, research, marketing or unrelated analytics.

Referral extraction may concern an adult or a child. The practice must give the applicable collection notice and document the patient’s capacity or representative authority and any required consent. Before the provider call, AssessSuite requires the authenticated practitioner to attest that the practice holds that notice/consent or another valid function-specific authority, calculates the provider age category from the entered date of birth, and records content-free evidence of the attestation. The provider’s separate under-13/age-of-digital-consent Zero Data Retention condition applies even if a parent or guardian has authorised the Australian clinical collection.

## 8. Review, correction and contestability

A patient may ask the treating practice to explain, review or correct a clinical output. They may also contact AssessSuite about the system, provenance or personal information we control. The practice and AssessSuite must cooperate so a person is not sent in circles.

For referral extraction, the product retains content-free provenance identifying the upload integrity hash, practice and initiating practitioner, function, selected model, prompt/schema versions, provider status class and time. The source is bound to a clinical entity only after the practitioner affirmatively creates or updates that record. Practitioner edits and final clinical approval remain evidenced by the resulting clinical record and its available amendment history; AssessSuite does not represent that this release stores a field-by-field AI-edit replay. Signed records are corrected by an auditable amendment.

## 9. Automated decisions from 10 December 2026

If a computer program makes or does something substantially and directly related to a decision that could significantly affect a person’s rights or interests, the Privacy Policy must describe the kinds of personal information and decisions covered by APP 1.7–1.9.

AssessSuite’s intended position is that final clinical and funding decisions are made by a practitioner or authorised program decision-maker. Because AI recommendations may still be substantially related to those decisions, we will assess and disclose them rather than relying on the presence of a human as a blanket exclusion.

## 10. Safety incidents and changes

Users and patients may report an unsafe, discriminatory, inexplicable or privacy-affecting output to admin@assesssuite.com or 1800 317 553. Urgent clinical concerns must also follow the treating practice’s emergency pathway.

AssessSuite will assess patterns, suspend an affected function where necessary, preserve evidence, notify relevant customers and regulators where required, and document corrective action and rollback. A material provider, model, intended-purpose or data-use change triggers renewed assessment, notice and, where required, consent or contract acceptance.

This RC-2026.07.19 notice materially changes the disclosed data flow. Existing practitioners must complete document-bound re-acceptance of the current practitioner-notice suite before clinical access continues. The event records this notice’s identifier, title, version and content fingerprint; it does not state that the patient consented or that direct customer email notice occurred.
