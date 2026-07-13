# AssessSuite Data Processing and Security Schedule

**Release status:** DRAFT — NOT APPROVED FOR PUBLICATION, ACCEPTANCE OR RELIANCE  
**Effective date:** None  
**Approved by:** None  
**Version:** RC-2026.07.11

## 1. Purpose and roles

This Schedule governs personal information and health information processed through the Service.

1. Customer determines why patient information is collected and used in its clinical relationship and gives documented instructions for the Service.
2. AssessSuite processes that information to provide, secure, support, maintain, export and lawfully administer the Service.
3. AssessSuite independently determines purposes for practitioner accounts, billing, authentication, abuse prevention, legal compliance and platform administration.
4. AEP practice customers that provide health services and hold health information are generally APP entities irrespective of small-business status. AssessSuite must separately document whether it is an APP entity by operation of law or registered opt-in before production. It contractually adopts the APP-equivalent obligations in this Schedule regardless.
5. Australian law does not turn statutory duties on or off merely because a party is labelled controller, processor, custodian or owner. Each party remains responsible for duties imposed directly on it, including any APP 3 and APP 5 duties arising when it momentarily holds or otherwise collects sensitive information.

## 2. Processing details

| Item | Approved description |
|---|---|
| Data subjects | Patients/clients, representatives, practitioners, practice staff, referrers, providers, funder contacts and emergency contacts |
| Information | Identity, contact, health, disability, referral, medication, assessment, note, report, recording/transcript, funding, identifier, consent, account, audit and security information |
| Purposes | Practice record and workflow, approved assessment/reporting, secure hosting, approved AI/transcription, support, export, incident response and legal compliance |
| Duration | Subscription plus the lawful export, retention, legal-hold, incident and backup periods in the Customer-Facing Retention and Exit Schedule, being Part A, sections 1–7, of the AssessSuite Records Retention, Export, Deletion and Exit Policy |
| Jurisdictions | Australia only unless an approved Order Form and jurisdiction supplement states otherwise |
| High-risk processing | Clinical AI, audio/transcription, minors, disability data, funding identifiers, multi-tenant access and overseas subprocessors |

## 3. Customer instructions and responsibilities

Customer must:

- collect and use information lawfully and within professional scope;
- give required collection notices and obtain separate effective consents;
- configure authorised users, roles, retention and recipients;
- ensure instructions do not require unlawful or unsafe processing;
- review and sign clinical output and maintain required records;
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

## 5. Subprocessors and overseas handling

1. Only providers listed in the Approved Subprocessor and Cross-Border Data Schedule may access Customer Data.
2. AssessSuite must conduct due diligence, enter written obligations that are no less protective for the relevant function, monitor material changes and remain accountable for its selection and instructions.
3. AssessSuite will give reasonable prior notice of a material new subprocessor, country or processing purpose and consider a Customer’s evidence-based objection.
4. If the risk cannot reasonably be resolved, Customer may terminate the affected Service and receive a pro-rata refund for the unused affected period.
5. An overseas disclosure must have an APP 8 assessment, likely-country transparency where practicable, security and incident cooperation, retention and deletion controls, and an approved legal basis. A generic consent clause is not the default control.

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
- least-privilege support access, recorded approvals and time-bounded elevation;
- subprocessor assurance, business continuity and incident exercises;
- secure export and deletion verification.

The current public upload route, role enforcement, incomplete export/deletion, demo database/storage and production backup state do not satisfy this Annex and must be remediated before effective use.

## Annex B — contacts

| Role | Release-candidate contact | Final requirement |
|---|---|---|
| Customer privacy/security | Order Form | Named monitored contact and alternate |
| AssessSuite privacy/security | admin@assesssuite.com; 1800 317 553 | Assign accountable owner, after-hours incident method and escalation |
| Clinical safety | admin@assesssuite.com | Create monitored safety channel and clinical owner |
