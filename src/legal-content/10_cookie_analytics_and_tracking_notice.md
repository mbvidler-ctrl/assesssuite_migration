# AssessSuite Cookie, Analytics and Tracking Notice

**Release status:** DRAFT — NOT APPROVED FOR PUBLICATION, ACCEPTANCE OR RELIANCE  
**Effective date:** None  
**Approved by:** None  
**Version:** RC-2026.07.11

## 1. Current position

AssessSuite may use essential browser storage or cookies needed for authentication, session continuity, security, load management and user preferences. At this release-candidate stage, no third-party advertising pixel, cross-site behavioural advertising, or sensitive-data session replay is approved.

The production release must publish a tested cookie inventory rather than copying a generic banner.

## 2. Categories

| Category | Purpose | Consent position |
|---|---|---|
| Strictly necessary | Sign-in, session, security, fraud prevention, load and legal-preference records | Required for the requested Service; explain and minimise |
| Functional | Remember non-essential display or workflow preferences | User choice where not necessary |
| Product analytics | Measure reliability and aggregate feature use without clinical content | Off by default until PIA, provider and data map are approved; obtain consent where required |
| Session replay | Reconstruct interface activity | Prohibited on authenticated, patient, assessment, note, report and consent paths; any limited use requires field masking, PIA and express approval |
| Advertising or cross-site tracking | Target or measure marketing | Prohibited on health and authenticated paths; no activation without express opt-in and full disclosure |

## 3. Sensitive-path rule

AssessSuite must not send a URL, page title, form field, search term, identifier, assessment, condition, referral, report, event or other signal that reveals or permits an inference about health information to an advertising or unapproved analytics provider.

This applies even if a provider labels the data pseudonymous. A cookie ID linked with a fertility, condition, medication, exercise-treatment or patient page can itself reveal sensitive information.

## 4. Inventory required before release

For every browser or SDK technology, record:

- cookie or storage key and provider;
- first- or third-party status;
- exact purpose and necessity;
- information collected or inferred;
- pages and users affected;
- expiry and retention;
- likely countries and recipients;
- consent category and withdrawal control;
- contract, security and privacy-assessment evidence.

## 5. User controls

The website should provide a clear preference control for any non-essential category. Refusing or withdrawing non-essential tracking must not block paid clinical functions. Withdrawal applies prospectively and must be honoured across devices where reasonably linked.

Browser blocking may affect essential sign-in functions. Explain the consequence without coercing consent to unrelated analytics.

## 6. Changes

Adding a provider, pixel, replay tool, advertising purpose or sensitive-page measurement is a privacy-impact and release event. Update the inventory, notice, consent and subprocessor schedule before activation.

Questions or privacy requests may be sent to admin@assesssuite.com or 1800 317 553.
