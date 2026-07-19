# AssessSuite Privacy Policy

**Release status:** APPROVED FOR PUBLICATION WITH THE 19 JULY 2026 RELEASE — ENABLED FUNCTIONS REMAIN SUBJECT TO THE GATES IN THIS POLICY  
**Effective date:** Effective on verified deployment; deployment date recorded in the release manifest  
**Publication authority:** Mission UM-AUTO-20260719-ASSESSSUITE-REFERRAL-SIGNUP-RELEASE, activated by Maxwell Vidler on 19 July 2026  
**Approved by:** Maxwell Vidler under the activated mission authority
**Operator:** Assess Suite Pty Ltd (ACN 694 044 481; ABN 53 694 044 481)  
**Version:** RC-2026.07.19  
**Privacy contact:** admin@assesssuite.com | 1800 317 553

> **Material-change note:** This version first discloses the referral/document-extraction flow in which a practitioner may submit a raw referral containing identifiable adult or child health information to the OpenAI API. Publication does not by itself enable that function. The technical, contractual, child-data and release gates stated below must all be satisfied.

## 1. Purpose and scope

Assess Suite Pty Ltd (**AssessSuite**, **we**, **us**) provides AssessSuite Clinical, a software service for exercise physiology practices. This policy explains how we collect, hold, use and disclose personal information in connection with our website, practitioner accounts, support, subscriptions and the patient information that practices place in the Service.

This policy is drafted to the standard of the Privacy Act 1988 (Cth), the Australian Privacy Principles (**APPs**) and applicable health-record laws. AEP practices that provide health services and hold health information are generally covered irrespective of small-business status. Whether AssessSuite is itself an APP entity by operation of law or registered opt-in is fact-dependent; this policy does not represent that a statutory-status determination has been made merely because a customer places health information in the Service. AssessSuite voluntarily adopts and contractually applies the APP-equivalent controls in this policy to the approved Service regardless of that status.

This policy does not replace a practice’s APP 5 collection notice, treatment consent process or legal obligations. If AssessSuite is an APP entity and receives or momentarily holds sensitive information, it must also meet its own collection, notice and consent obligations; a practice notice or checkbox does not automatically discharge them.

Where a practice uses the Service for a patient, that practice ordinarily controls the clinical relationship and why the record is created. AssessSuite processes information to provide and secure the Service and independently determines account, billing, security and platform-administration purposes. Applicable collection notices identify both legal entities and their purposes wherever they collect or hold the same information. We do not disclaim a direct duty by calling a practice the controller or record owner.

## 2. Whose information we handle

We may handle information about:

- subscribers, practitioners, practice owners, staff and prospective customers;
- patients, clients, carers, guardians, substitute decision-makers and family contacts;
- referrers, treating providers, funders, insurers and program personnel;
- website visitors, support contacts, vendors and job applicants;
- people whose information appears in a referral, recording, upload, note, report or communication.

## 3. Information we collect

Depending on the enabled functions, we may collect:

### Account and professional information

- name, contact details, practice, role and account credentials;
- ESSA accreditation status and number, provider numbers, insurance or other professional evidence;
- subscription plan, billing status, transaction information and Stripe customer or subscription identifiers; Stripe collects payment-method details directly and AssessSuite does not presently store card numbers;
- support, complaint, training, survey and communications records.

### Patient and health information

- identity, contact, date of birth, sex or gender information, emergency and representative details;
- referral documents and their contents, including patient and child identity, referrer, provider, funding, insurer, Medicare, DVA, NDIS and other identifier information where authorised;
- health history, diagnoses or conditions, medication, disability, symptoms, psychosocial information, risks, goals and consent records;
- assessment inputs, measurements, scores, observations, exercise interventions, treatment plans and outcomes;
- case notes, SOAP notes, reports, attachments, correspondence and signatures;
- audio, transcript or other consultation content where the relevant recording function is approved and every required consent has been obtained;
- AI inputs, drafts, recommendations, flags, provenance, practitioner edits and approvals.

### Technical and usage information

- device, browser, network, session, authentication, audit and security events implemented in the approved production configuration;
- tenant, role, record-access, export, edit, deletion, consent and acceptance events actually generated by that configuration;
- performance, fault, diagnostic and feature-use data configured to avoid patient content unless necessary and authorised;
- cookie and tracking information described in the Cookie, Analytics and Tracking Notice.

We do not use Medicare, DVA, NDIS or healthcare identifiers as a general internal account identifier.

## 4. How we collect information

We collect information:

- directly from practitioners, practices, patients or their authorised representatives;
- from a practice’s referral, onboarding, upload, assessment, recording, report or integration workflow, including a referral supplied by a referrer or authorised representative;
- from referrers, funders, providers or other sources where the practice and AssessSuite are authorised to receive it;
- automatically through security, audit and essential service logs;
- from public registers or professional bodies to verify a credential;
- from payment, hosting, support and other approved service providers.

The treating practice must give an accurate collection notice at or before collecting patient information. Where both the practice and AssessSuite collect or hold information, the notice must identify both entities, their contacts and purposes; how, when and from whom information is collected; whether collection is required or authorised by an identified Australian law or court/tribunal order; collection circumstances; consequences of non-provision; usual disclosures; likely overseas countries; and both privacy-policy locations. If AssessSuite collects directly for its own purpose, it provides its own notice as required.

## 5. Why we use information

We use personal information only where authorised and reasonably necessary to:

- create and administer accounts, subscriptions and support;
- receive, store, organise, display, export and protect practice records;
- provide approved assessment, documentation, reporting and workflow functions;
- extract proposed client-profile fields from an approved referral document by sending the document to the OpenAI API under the controls in section 6;
- operate another approved transcription or AI function under a signed function-level authority record, with the required notice and specific consent where required;
- verify user eligibility and professional credentials;
- prevent, detect, investigate and respond to security, privacy, misuse and clinical-safety events;
- maintain audit history, data quality, correction and version integrity;
- comply with law, court orders, regulator requirements and lawful program obligations;
- bill customers and keep tax, corporate and contract records;
- improve reliability and usability using technical service information that excludes Patient Data;
- communicate service, security, legal and subscription information;
- send marketing only where permitted and with a functional opt-out.

We do **not** sell personal or health information. We do not use identifiable Patient Data to train a general-purpose AI model. Patient-derived information is not used for improvement merely because it is labelled de-identified. A research, benchmarking, improvement, product-training or commercial secondary use requires written Customer authority, an effective de-identification and re-identification-risk assessment, confidentiality and IP permission, a separate legal and ethical assessment, updated notice and separate specific opt-in consent. It will not be introduced through a silent policy change.

## 6. AI and automated processing

Approved features may use software or AI to transcribe content, structure notes, draft reports, calculate or display assessment results, or assist a practitioner’s clinical reasoning. The current feature, provider, input, output, human-review and data-location position is explained in the AI and Automated Processing Transparency Notice.

For **referral/document extraction**, an authenticated practitioner may upload a PDF, image or CSV referral. The release configuration sends the raw document or bounded locally parsed CSV text directly in one `POST /v1/responses` request to **OpenAI OpCo, LLC**. A referral may identify an adult or child and may contain names, contact details, date of birth, health history, diagnosis, medication, disability, funding and provider identifiers, referrer details and other sensitive information. This path does not represent that the document is de-identified.

The request sets `store: false`, requests the shortest documented in-memory prompt-cache policy supported by the selected pre-GPT-5.6 model, and does not use OpenAI Files, conversations, Assistants, vector stores, background mode, web search or external tools. `store: false` means AssessSuite does not ask OpenAI to retain the Response object; it does **not** mean zero provider retention. OpenAI’s published controls state that non-Zero-Data-Retention Responses requests may cache encrypted derived key/value tensors in GPU-local application state. The in-memory policy generally remains active for 5–10 minutes of inactivity and may remain for up to one hour; if the selected model or project does not honour that policy, the request fails closed rather than silently using a longer policy. Default abuse-monitoring logs may include inputs, outputs and derived metadata for up to 30 days, subject to longer legal or safety retention. File and image inputs are scanned for child sexual abuse material; a potential match may be retained for manual review even where enhanced retention controls apply. OpenAI states that API data is not used to train or improve its models unless the customer expressly opts in. AssessSuite does not opt this function into training or any data-sharing programme.

No extracted value is treated as verified merely because the API returned it. Extraction may omit, misread, misclassify or fabricate information. Before transmission, the authenticated practitioner must attest that the practice has documented the applicable patient or representative notice and consent, or another valid authority, for this function; AssessSuite records that content-free attestation against the practice, actor and upload. The output is shown only as proposed, editable values. A practitioner must compare it with every submitted source and affirmatively create or update the record; extraction alone must not write a client or other clinical entity.

OpenAI’s current Under 18 API Guidance says personal data of a child under 13, or the applicable age of digital consent, must not be processed without Zero Data Retention. AssessSuite therefore keeps OpenAI referral extraction disabled for that category unless the relevant OpenAI organisation/project is verified as having the required retention control and the practice has documented capacity, parent/guardian authority, notice and any required consent. For other authorised referrals, Maxwell Vidler attested for this release that the AssessSuite OpenAI account has an account-specific arrangement authorising intentional sensitive-data transfer. Its confidential terms were not requested, copied or published; the release record preserves only the attestation and its date.

AI output may contain personal information and may be inaccurate. It must remain attributed to its source and model version, be reviewed by an appropriately qualified practitioner, and be corrected by an auditable amendment. We do not permit an AI output to make a final treatment or eligibility decision without the required human decision-maker.

From 10 December 2026, additional APP privacy-policy transparency applies to certain computer-assisted decisions that significantly affect rights or interests. We have drafted to that position and will update this policy when final regulator guidance is issued.

## 7. When we disclose information

We may disclose information:

- to the treating practice and its authorised users;
- at the practice’s documented instruction to a patient, representative, referrer, provider, funder or recipient;
- to approved hosting, storage, AI, transcription, payment, email, monitoring, support and security providers that need it for the stated service;
- to professional advisers, insurers, auditors or incident responders under confidentiality;
- to regulators, courts, law enforcement or other bodies where required or authorised by law;
- in a business transfer only under due diligence, confidentiality, continuity and privacy safeguards, with notice where required.

We do not disclose patient information to advertisers or place third-party advertising pixels on authenticated, patient, assessment, clinical-note or report pages.

## 8. Service providers and overseas handling

The public Approved Subprocessor and Cross-Border Data Schedule identifies each approved provider, function, data category, legal entity, likely country, retention setting and material control. For referral extraction, the contracting and processing entity for an Australian customer under OpenAI’s published business terms is OpenAI OpCo, LLC in the United States. OpenAI and its published API subprocessors may process Customer Data in the United States and other listed infrastructure, moderation and support locations. AssessSuite has not represented that this flow stays in Australia or that an Australian OpenAI data-residency project is configured.

Some approved providers may process information outside Australia. Before enabling a flow, we assess necessity, contract terms, security, retention, model-training use, access, deletion, incident cooperation and applicable law. Where APP 8 applies, we take reasonable steps concerning overseas handling and do not assume that a broad consent sentence removes our accountability.

OpenAI personnel or specialist moderation providers do not ordinarily review content to generate the extraction. Limited human access may nevertheless occur where content is flagged for abuse or safety review, where a support case is opened and content is deliberately supplied, or where access is required by law. AssessSuite support staff must not send a raw referral to a provider support case without separate authority.

## 9. Security

Before this policy becomes effective, the Approved Production Mode and release assurance record must verify technical and organisational measures proportionate to identifiable health information. Required controls include authentication, role and tenant isolation, encryption, secrets, secure development, vulnerability management, logging, monitoring, backups, recovery, vendor assurance, incident response and secure deletion. The final effective wording must describe only controls that the frozen production release and executed provider agreements substantiate.

No system can be guaranteed completely secure. We therefore do not make an absolute security promise. We test controls, restrict production use where evidence is incomplete, and require prompt reporting of suspected incidents.

## 10. Data quality and correction

Practices and practitioners must check source information and clinical output. We preserve relevant provenance and support correction by an auditable amendment rather than silently rewriting a signed clinical record.

You may ask us to correct personal information we control. For a clinical record held for a practice, we will ordinarily coordinate with that practice, but we will not use that allocation to prevent a lawful request or preserve information we know is materially inaccurate without a notation.

## 11. Retention, export and deletion

We retain information only while required for the documented purpose, applicable clinical and health-record periods, funding and tax rules, patient rights, legal holds, incidents, disputes and backup cycles.

Clinical records and other health information are not automatically destroyed merely because a subscription ends. The applicable test depends on jurisdiction, legal role, actual content and control—not on whether the practice labels an item a clinical record. Raw audio, prompts and responses may themselves be regulated health information. The treating practice selects applicable jurisdictions and programs and must receive a usable export and exit period. Jurisdiction-specific rules may require at least seven years after the last service and longer periods for a child’s information. Victoria can require the later of the age and last-service tests.

An unbound referral upload used only for extraction is a temporary working copy. It expires no later than 24 hours after upload. Cancellation, rejection or failed extraction queues it for the next cleanup run; deletion is not represented as instantaneous. A file leaves the temporary lifecycle only when an authorised practitioner affirmatively binds it to a validated tenant-scoped clinical entity. A bound referral then follows the clinical-record period that applies to its content, patient age, jurisdiction and legal holds. AssessSuite retains metadata-only upload and extraction audit events for two years unless a longer incident, complaint or legal hold applies. These periods do not shorten OpenAI’s separate provider-side retention described above.

The **Customer-Facing Retention and Exit Schedule**, being Part A, sections 1–7, of the AssessSuite Records Retention, Export, Deletion and Exit Policy, states the contractual category periods, backup expiry, deletion evidence and exceptions. When information is no longer required or authorised, we securely destroy or effectively de-identify it. Removing a record from view is not treated as deletion.

## 12. Children and people requiring decision support

AssessSuite may hold referrals and clinical information about adults or children. It must not be used for a child or a person who cannot provide the relevant consent unless the approved product mode records:

- the person’s capacity and involvement;
- the identity and authority of a parent, guardian or substitute decision-maker;
- the information given and the decision sought;
- the child or person’s assent where appropriate;
- any withdrawal, objection or change in authority;
- the correct retention calculation.

Referral extraction may be used for an authorised adult or child referral when the capacity, authority, notice, consent and retention controls above are documented. A date-of-birth field alone is not a consent control. The OpenAI provider call remains disabled for personal data of a child under 13 or the applicable age of digital consent unless Zero Data Retention is verified for the relevant project; that provider restriction applies independently of Australian capacity and representative-authority rules.

## 13. Direct marketing and communications

We may send necessary security, service, legal, billing and clinical-workflow communications without treating them as promotional consent. We send commercial electronic messages only with the required consent or other lawful basis, identify the sender and include a functional unsubscribe. We action unsubscribe requests within five working days.

We do not add promotional content to a clinical reminder where doing so would convert the message into marketing without the required consent.

We do not use or disclose sensitive information for direct marketing without consent.

## 14. Access, export and correction requests

You may request access to or correction of personal information by contacting the Privacy Contact. We will verify identity and authority, acknowledge the request and apply the earliest overlapping deadline: an operational APP target of no more than 30 calendar days, NSW and Victorian health-access periods of up to 45 days, and the ACT requirement to give the applicable notice or decision within two weeks and access within 30 days. If we refuse all or part, we will give written reasons and complaint information unless law prevents it.

Patients may contact their treating practice first for the clinical record. They may also contact us. We will coordinate responsibly and will not require an active subscription before assisting with a lawful request.

## 15. Privacy complaints

Send a complaint to:

**Privacy Contact**  
Assess Suite Pty Ltd  
Email: admin@assesssuite.com  
Telephone: 1800 317 553

Please describe the issue, relevant dates, people or records, and the outcome sought. We will acknowledge it promptly, investigate fairly, protect it from retaliation, and give a written outcome. If you are not satisfied, you may complain to the [Office of the Australian Information Commissioner](https://www.oaic.gov.au/privacy/privacy-complaints).

State health-complaints or privacy bodies may also have jurisdiction. We will identify the applicable pathway rather than restricting a person to our internal process.

## 16. Data breaches

We maintain a Data Breach and Notifiable Data Breach Response Plan. If a breach is likely to cause serious harm and remedial action has not removed that likelihood, we notify the OAIC and affected people as required. We also coordinate promptly with affected practices and other regulators or program bodies where applicable.

## 17. Changes to this policy

We may update this policy when law, product functions, data uses or providers change. We publish the current and archived versions. We give prior notice of a material adverse change and seek new consent where the law or a new purpose requires it. Continued use does not authorise a new sensitive-information purpose that requires consent.

The RC-2026.07.19 referral-extraction disclosure is a material change. Current practitioner users must acknowledge the current practitioner-notice suite through the product’s document-bound re-acceptance process before clinical access continues. Each acceptance records the displayed document identifier, title, suite version and content fingerprint. Direct customer notification outside the product is a separate communication action and is not represented by this policy as having occurred.

## 18. Contact and document details

Assess Suite Pty Ltd  
ACN 694 044 481  
ABN 53 694 044 481  
Email: admin@assesssuite.com  
Telephone: 1800 317 553

The registered office, ACN or qualifying corporate identifier, final privacy officer and effective date must be verified before release.
