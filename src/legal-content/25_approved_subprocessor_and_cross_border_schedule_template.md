# AssessSuite Approved Subprocessor and Cross-Border Data Schedule

**Release status:** PUBLIC SCHEDULE — APPROVED PROVIDERS LISTED IN CLAUSE 2  
**Effective date:** 16 July 2026  
**Approved by:** Maxwell Vidler, duly authorised agent for Assess Suite Pty Ltd  
**Version:** RC-2026.07.11

## 1. Purpose

This is the public, customer-facing schedule promised by the Privacy Policy, Terms and Order Form. The internal dependency register is not a substitute. Only providers whose entity, function, countries, contract and production settings have been verified are published below; unapproved rows are not listed.

## 2. Approved provider table

| Legal entity and service | Function | Personal information | Production/support/backup countries | Provider retention and training use | Material controls and contract date | Effective date/change notice |
|---|---|---|---|---|---|---|
| Base44 — application development platform and app-runtime environment | Platform on which AssessSuite is built and served; provides the SDK, authentication wire protocol and application runtime. | Practitioner account identifiers and technical metadata handled at the platform and runtime layer. Clinical records are held in the self-hosted application database (see Fly.io), not in Base44-managed storage. | United States. | Processed only to operate the platform; not used to train provider models. Retained for the service term; removed on account closure or contract exit. | Platform data-processing terms; access controls; encryption in transit and at rest. Approved 16 July 2026. | 16 July 2026; material change notified under clause 4. |
| Fly.io, Inc. — application hosting, compute and database volume | Hosts the application server, compute and the primary database volume in which AssessSuite records are stored and backed up. | All information entered into the Platform — Patient Data, practitioner data, content and technical metadata — stored in the application database and its volume snapshots. | Primary processing region Sydney, Australia; operator incorporated in the United States; support access may originate from the United States. | Infrastructure provider; does not access application content in the ordinary course and does not use it for training. Data retained until deleted by AssessSuite; volume snapshots held on a short rolling cycle. | Data-processing addendum; encryption at rest and in transit; regional volume placement; access controls. Approved 16 July 2026. | 16 July 2026; material change notified under clause 4. |
| OpenAI, L.L.C. — generative AI text service (API) | Generates draft clinical documentation and report text to assist practitioners. | Prompt content submitted for text generation. Prompts pass through a de-identification step before egress, removing direct patient identifiers prior to transmission; residual free-text clinical content may remain. | United States. | API content is not used to train OpenAI models; retained for a limited period for abuse monitoring under the provider's API data-usage terms, then deleted. No human review in the ordinary course. | API data-processing terms (no-training commitment); de-identification pre-processing; encryption in transit. Approved 16 July 2026. | 16 July 2026; material change notified under clause 4. |
| Stripe Payments Australia Pty Ltd and Stripe, Inc. — subscription payment processing | Processes subscription sign-up and recurring billing and issues the customer billing portal. | Subscriber billing identity (name, email) and payment-instrument data captured directly by Stripe. Card data is entered into Stripe-hosted fields and does not touch AssessSuite servers. No Patient Data. | Australia and the United States. | Retained by Stripe as payment processor under its terms and applicable financial-records law; not used to train models. | Stripe data-processing agreement; PCI-DSS compliance (card data handled solely by Stripe); encryption in transit and at rest. Approved 16 July 2026. | 16 July 2026; material change notified under clause 4. |
| Resend, Inc. — transactional email delivery | Delivers transactional email — one-time passcodes, account and system notifications. | Recipient email address and transactional message content (one-time passcodes, notification text); practitioner identifiers only. No Patient Data. | United States. | Message metadata and delivery logs retained for a limited period for deliverability, then deleted; not used to train models. | Data-processing terms; encryption in transit (TLS); access controls. Approved 16 July 2026. | 16 July 2026; material change notified under clause 4. |

**Current RC position:** the providers listed above — Base44, Fly.io, OpenAI, Stripe and Resend — are approved for production use as at the effective date. No other provider (additional identity, database, object storage, backup, SMS, monitoring, analytics, CDN or support provider) is approved for real Patient Data by this schedule; any addition is made only under clause 4.

## 3. Information for customers and patients

For each approved provider, the effective schedule must explain:

- why it is necessary and which AssessSuite function uses it;
- whether Patient Data, practitioner data, payment data, content or only technical metadata is involved;
- every likely overseas country where information is processed, backed up or accessed for support;
- provider-side retention, deletion, model-training and human-access settings;
- how AssessSuite assessed APP 8, security, incident cooperation and exit;
- how a Customer can object to a material new provider or country;
- the date the change takes effect and which prior version it supersedes.

## 4. Change control

A provider is added only after privacy, security, clinical/regulatory and legal review, executed terms, production configuration test and updated notices/consent. Give reasonable prior Customer notice of a material new provider, country or purpose. If a reasonable objection cannot be resolved, apply the affected-service termination and pro-rata refund right in the Terms.

Historical effective versions remain publicly accessible. The Order Form and release manifest bind the exact version used by each Customer.
</content>
</invoke>
