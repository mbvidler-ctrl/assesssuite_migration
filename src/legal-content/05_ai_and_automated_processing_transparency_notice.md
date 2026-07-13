# AssessSuite AI and Automated Processing Transparency Notice

**Release status:** DRAFT — NOT APPROVED FOR PUBLICATION, ACCEPTANCE OR RELIANCE  
**Effective date:** None  
**Approved by:** None  
**Version:** RC-2026.07.11

## 1. Why this notice exists

AssessSuite uses or proposes to use automated and AI-supported functions in a clinical workflow. This notice explains what those functions do, what information they may receive, their limits, the role of the practitioner, and how a person can question or correct an output.

It does not authorise a function that is marked disabled, test-only or awaiting TGA, privacy, security or clinical approval.

## 2. Feature register

The production release must publish and version a feature register in this form:

| Function | Typical input | Output or use | Human decision | Production status at RC-2026.07.11 |
|---|---|---|---|---|
| Consultation transcription | Raw audio and session metadata | Draft transcript or note | Practitioner corrects and approves | Blocked pending recording consent and approved OpenAI/data flow |
| SOAP note assistance | Patient history, observations and note text | Draft assessment and plan text | Practitioner verifies, edits and signs | Blocked for real data pending TGA and clinical controls |
| Assessment interpretation | Measurements, scores, norms and patient context | Interpretation or recommendation | Practitioner selects and justifies use | Blocked pending feature-level TGA and evidence review |
| Treatment protocol assistance | Condition, goals, assessments and clinical context | Suggested protocol or exercise content | Practitioner independently decides | Blocked pending TGA, evidence and content-licence review |
| Medication considerations | Medication and clinical context | Interaction, precaution or consideration text | Practitioner verifies against authoritative Australian sources and refers as needed | Blocked pending safety and source validation |
| Report drafting | Referral, record, assessments and notes | Draft GP, funder or clinical report | Practitioner checks program rules, edits and signs | Documentation-only pathway may be approved after classification and data-flow review |
| Fixed calculations and established scores | Entered measurements | Deterministic result | Practitioner checks conditions and meaning | May be separately approvable after instrument licence and validation |

## 3. Information used

Depending on the function, information may include patient identity, age, sex or gender data, health history, condition, medication, disability, referral, goals, measurements, assessments, notes, recordings, funding context and practitioner instructions. Output, confidence or warning data, edits, approvals, model and prompt versions may also be retained for safety and audit.

Free text and audio must be treated as identifiable health information unless a validated process proves otherwise. Removing obvious contact details does not guarantee de-identification; names, rare conditions, dates, voices and combinations of facts may still identify a person.

## 4. Providers, locations and retention

The Approved Subprocessor and Cross-Border Data Schedule must state the legal provider, model or service, countries, input, output, retention, human-access, training-use and deletion settings for each function.

At this release-candidate stage, OpenAI-backed processing exists in the code path, raw audio can be sent before transcript redaction, and provider/location controls are not approved. Real-patient AI and transcription must therefore remain disabled until the schedule and contracts are complete.

AssessSuite will not use identifiable patient information to train a general-purpose model. An approved provider must also be contractually prohibited from training on that information unless a separate, lawful, specific and approved process applies.

## 5. How output is used

AI output is a draft or decision-support input. It must not make the final clinical, treatment, referral, funding, eligibility or safety decision. An appropriately qualified practitioner must review the source data and output, consider patient-specific risks and alternatives, correct errors, and affirmatively sign the final record.

Human review is a necessary safety control, but it does not make an opaque or otherwise regulated product exempt from therapeutic-goods law.

## 6. Material limitations

An output may:

- be incomplete, incorrect, inconsistent or fabricated;
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

## 8. Review, correction and contestability

A patient may ask the treating practice to explain, review or correct a clinical output. They may also contact AssessSuite about the system, provenance or personal information we control. The practice and AssessSuite must cooperate so a person is not sent in circles.

The product must retain enough information to identify the input record, function, source, model/prompt or rule version, time, practitioner edits and final approval. Signed records are corrected by an auditable amendment.

## 9. Automated decisions from 10 December 2026

If a computer program makes or does something substantially and directly related to a decision that could significantly affect a person’s rights or interests, the Privacy Policy must describe the kinds of personal information and decisions covered by APP 1.7–1.9.

AssessSuite’s intended position is that final clinical and funding decisions are made by a practitioner or authorised program decision-maker. Because AI recommendations may still be substantially related to those decisions, we will assess and disclose them rather than relying on the presence of a human as a blanket exclusion.

## 10. Safety incidents and changes

Users and patients may report an unsafe, discriminatory, inexplicable or privacy-affecting output to admin@assesssuite.com or 1800 317 553. Urgent clinical concerns must also follow the treating practice’s emergency pathway.

AssessSuite will assess patterns, suspend an affected function where necessary, preserve evidence, notify relevant customers and regulators where required, and document corrective action and rollback. A material provider, model, intended-purpose or data-use change triggers renewed assessment, notice and, where required, consent or contract acceptance.
