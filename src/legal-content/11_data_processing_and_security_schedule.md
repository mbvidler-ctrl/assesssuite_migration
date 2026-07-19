# AssessSuite Data Processing and Security Schedule

**Release status:** APPROVED FOR PUBLICATION WITH THE 19 JULY 2026 RELEASE — PROCESSING REMAINS SUBJECT TO THE ACTIVATION GATES IN THIS SCHEDULE  
**Effective date:** Effective on verified deployment; deployment date recorded in the release manifest  
**Publication authority:** Mission UM-AUTO-20260719-ASSESSSUITE-REFERRAL-SIGNUP-RELEASE, activated by Maxwell Vidler on 19 July 2026  
**Approved by:** Maxwell Vidler under the activated mission authority
**Version:** RC-2026.07.19

## 1. Purpose and roles

This Schedule governs personal information and health information processed through the Service.

1. Customer determines why patient information is collected and used in its clinical relationship and gives documented instructions for the Service.
2. AssessSuite processes that information to provide, secure, support, maintain, export and lawfully administer the Service.
3. AssessSuite independently determines purposes for practitioner accounts, billing, authentication, abuse prevention, legal compliance and platform administration.
4. AEP practice customers that provide health services and hold health information are generally APP entities irrespective of small-business status. Whether AssessSuite is itself an APP entity by operation of law or registered opt-in is fact-dependent; this Schedule does not represent that statutory status has been determined. AssessSuite voluntarily adopts and contractually applies the APP-equivalent obligations in this Schedule regardless of that status.
5. Australian law does not turn statutory duties on or off merely because a party is labelled controller, processor, custodian or owner. Each party remains responsible for duties imposed directly on it, including any APP 3 and APP 5 duties arising when it momentarily holds or otherwise collects sensitive information.

## 2. Processing details

| Item | Approved description |
|---|---|
| Data subjects | Adult and child patients/clients, representatives, practitioners, practice staff, referrers, providers, funder contacts and emergency contacts |
| Information | Identity, contact, date of birth, health, disability, raw referral documents, referrer and provider details, medication, assessment, note, report, recording/transcript, funding and health identifiers, consent, account, audit and security information |
| Purposes | Practice record and workflow, secure referral upload and extraction of proposed profile fields, approved assessment/reporting, secure hosting, other approved AI/transcription, support, export, incident response and legal compliance |
| Duration | Subscription plus the lawful export, retention, legal-hold, incident and backup periods in the Customer-Facing Retention and Exit Schedule, being Part A, sections 1–7, of the AssessSuite Records Retention, Export, Deletion and Exit Policy |
| Jurisdictions | Primary application hosting in Australia as recorded in the release manifest; referral extraction discloses the submitted document to OpenAI OpCo, LLC in the United States and may involve other published OpenAI API infrastructure, moderation or support locations. No Australia-only inference or storage representation is made. |
| High-risk processing | Clinical AI, audio/transcription, minors, disability data, funding identifiers, multi-tenant access and overseas subprocessors |

## 3. Customer instructions and responsibilities

Customer must:

- collect and use information lawfully and within professional scope;
- give required collection notices and obtain separate effective consents;
- configure authorised users, roles, retention and recipients;
- ensure instructions do not require unlawful or unsafe processing;
- review and sign clinical output and maintain required records;
- ensure each referral was lawfully obtained, give the applicable collection notice, and document any required patient/representative authority before extraction;
- not submit personal data of a child under 13 or the applicable age of digital consent to OpenAI unless AssessSuite has verified the required Zero Data Retention control and the Customer has documented capacity or parent/guardian authority;
- respond to patients, referrers, funders and regulators, with AssessSuite assistance;
- notify AssessSuite promptly of an incident or unlawful instruction.

AssessSuite must notify Customer if it reasonably believes an instruction breaches law or the Approved Production Mode and may pause only the affected processing while the issue is resolved.

## 4. AssessSuite obligations

AssessSuite must:

- process Customer Data only on documented instructions, to secure and provide the Service, or as required by law;
- ensure authorised personnel are trained, bound by confidentiality and limited to need-to-know access;
- maintain and test the approved security controls in Annex A;
- keep a current processing, asset, access, subprocessor and incident record;
- preserve data quality, provenance, version and correction evidence appropriate to clinical records;
- assist with access, correction, complaints, privacy impact assessments, incidents and regulator enquiries;
- return and delete information in accordance with the Customer-Facing Retention and Exit Schedule, being Part A, sections 1–7, of the AssessSuite Records Retention, Export, Deletion and Exit Policy, and legal holds;
- not sell patient information or use identifiable Patient Data for general-purpose model training;
- not use Patient Data for product improvement merely because it is labelled de-identified; any such purpose requires written Customer authority, an approved lawful basis and legal/ethical assessment, effective de-identification and re-identification-risk assessment, confidentiality and IP permission, required notice and separate specific opt-in consent, and approved governance;
- not materially change a processing purpose through a privacy-policy update alone.

For referral/document extraction, AssessSuite must additionally:

- accept only an authenticated, purpose-labelled upload owned by the validated Customer organisation;
- send a PDF/image inline, or bounded locally parsed CSV text, only through `/v1/responses` with `store: false`, the shortest documented in-memory prompt-cache policy supported by the selected pre-GPT-5.6 model, and without OpenAI Files, conversations, Assistants, vector stores, background mode, web search or external tools;
- exclude raw referral content, extracted health information and provider bodies from application logs, traces, analytics, support tickets and error messages;
- return proposed values only to a mandatory practitioner review step and make no clinical-entity write until the practitioner affirmatively confirms the reviewed data;
- require the authenticated practitioner to attest that the Customer has documented the applicable patient/representative notice and consent or another valid function-specific authority, and retain content-free evidence tied to the actor, Customer and upload;
- rely on the release-specific attestation by Maxwell Vidler that the AssessSuite account has an account-specific arrangement authorising intentional sensitive-data transfer; do not request, copy, log or publish the confidential arrangement, and fail closed if the attestation is withdrawn or cannot be tied to the production account;
- disable the provider call for a child under 13 or the applicable age of digital consent unless Zero Data Retention is verified for the relevant OpenAI organisation/project; and
- prohibit training opt-in, feedback sharing, sale, marketing, research, product improvement and every other secondary use of the referral or extracted health information.

## 5. Subprocessors and overseas handling

1. Only providers listed in the Approved Subprocessor and Cross-Border Data Schedule may access Customer Data.
2. AssessSuite must conduct due diligence, enter written obligations that are no less protective for the relevant function, monitor material changes and remain accountable for its selection and instructions.
3. AssessSuite will give reasonable prior notice of a material new subprocessor, country or processing purpose and consider a Customer’s evidence-based objection.
4. If the risk cannot reasonably be resolved, Customer may terminate the affected Service and receive a pro-rata refund for the unused affected period.
5. An overseas disclosure must have an APP 8 assessment, likely-country transparency where practicable, security and incident cooperation, retention and deletion controls, and an approved legal basis. A generic consent clause is not the default control.

6. The OpenAI contracting and processing entity for an Australian customer under the published Services Agreement is OpenAI OpCo, LLC, United States. OpenAI’s published API subprocessor list identifies infrastructure, content-delivery, moderation and support processing in the United States and other countries. The public schedule distinguishes possible published locations from a claim that each request reaches every location. The account-specific sensitive-data arrangement was attested for this release, but its confidential terms are not reproduced in this Schedule.
7. `store: false` prevents AssessSuite from requesting retention of the Response object; it does not remove prompt-cache application state or default abuse-monitoring logs. OpenAI states that non-Zero-Data-Retention Responses requests may cache encrypted derived key/value tensors in GPU-local storage. AssessSuite requests the shortest documented in-memory policy supported by the selected pre-GPT-5.6 model, generally 5–10 minutes of inactivity and no more than one hour; a model/project that does not honour it fails closed. Abuse-monitoring logs may contain customer content for up to 30 days, subject to longer legal or safety retention. File/image inputs are scanned for child sexual abuse material and a potential match may be retained for manual review even under enhanced controls.
8. OpenAI states that API content is not used to train or improve its models unless the customer expressly opts in. AssessSuite does not opt in. Human access is not part of ordinary extraction, but may occur for flagged abuse/safety review, a customer-initiated support case or legal compulsion.

## 6. Security incidents

1. AssessSuite must notify Customer without undue delay after becoming aware of an actual or reasonably suspected security or privacy incident affecting Customer Data and target initial notice within 24 hours. Notice must not be postponed pending confirmation; it may be preliminary and must be updated as facts develop.
2. Initial notice must state what is known, affected systems/data, containment, likely impact, contact and next update. It may be supplemented as facts develop.
3. AssessSuite must preserve evidence, contain and remediate the incident, cooperate with Customer’s harm assessment and notices, and avoid public statements naming Customer without authority unless required by law.
4. Each party remains responsible for notifications imposed directly on it. The parties will coordinate to avoid delay, inconsistency or duplicate harm.

## 7. Requests and complaints

AssessSuite must provide proportionate search, export, correction, restriction, provenance and deletion assistance. It must not require an active subscription before assisting with a lawful request concerning retained information. If a patient contacts AssessSuite directly, it may verify and coordinate with the treating practice but must not send the person in circles.

## 8. Audit and assurance

AssessSuite must provide current, proportionate evidence of relevant security, privacy, subprocessor, backup, recovery, access-control and incident testing. Customer audit access is subject to confidentiality, security and reasonable frequency, but those limits must not prevent an audit required by a regulator or following a material incident.

## 9. Return, retention and deletion

1. Customer may export information during the subscription and exit window in the approved formats.
2. Termination does not authorise immediate clinical-record destruction.
3. AssessSuite must follow applicable statutory health-information rules, Customer’s lawful instructions, legal holds, patient rights, incident preservation and the approved backup cycle. Customer labelling does not determine whether raw audio, prompts, responses or another item is regulated health information.
4. Deletion must cover primary records, derivatives, search indexes, file objects, caches and expiry from backups, with evidence. Where a record cannot yet be deleted, it must be isolated from ordinary use and the reason and expiry recorded.
5. An unbound referral upload expires no later than 24 hours after upload. Cancellation, rejection or failure queues deletion for the next cleanup run, targeted within one hour and subject to the 24-hour outer bound. A referral explicitly bound to a validated clinical entity follows the applicable clinical-record schedule instead. Metadata-only upload and extraction audit events are retained for two years unless an incident, complaint or legal hold requires longer retention.
6. AssessSuite deletion cannot force early deletion from OpenAI’s abuse-monitoring or legal/safety retention described above. The public instruments must not describe `store: false` as zero retention.

## Annex A — minimum security controls

The production release must evidence:

- unique accounts, MFA for privileged and clinical users, secure credential recovery and prompt offboarding;
- server-side role and tenant authorisation for every record and object, including uploaded files, with a distinct matrix for Customer owner, administrator and clinician and for global platform-administrator and time-bounded support access;
- encryption in transit and at rest with managed keys and secrets;
- production separation from development, demo and synthetic environments;
- secure coding, dependency and secret scanning, peer review and tested release/rollback;
- vulnerability intake, prioritisation, remediation and independent tenant-boundary testing;
- immutable or tamper-evident authentication, access, change, export, deletion, consent, acceptance and administrative logs;
- approved database and object storage, encrypted backups, defined recovery objectives and tested restoration;
- monitoring and alerting without unapproved patient content;
- a default-off document-extraction feature flag, enforced provider-contract, practitioner-authority and child/ZDR gates, `store: false`, shortest-policy prompt caching, bounded inline requests and tests proving no raw content appears in logs;
- least-privilege support access, recorded approvals and time-bounded elevation;
- subprocessor assurance, business continuity and incident exercises;
- secure export and deletion verification.

RC-2026.07.19 includes authenticated tenant/object controls for the referral upload and extraction path. It does not evidence every Annex control, including product-wide MFA, tamper-evident logging, complete export/deletion and tested backup restoration. Those unresolved controls remain release conditions for functions or representations that depend on them; publication of this Schedule is not evidence that they are complete.

## Annex B — contacts

| Role | Release-candidate contact | Final requirement |
|---|---|---|
| Customer privacy/security | Order Form | Named monitored contact and alternate |
| AssessSuite privacy/security | admin@assesssuite.com; 1800 317 553 | Assign accountable owner, after-hours incident method and escalation |
| Clinical safety | admin@assesssuite.com | Create monitored safety channel and clinical owner |
