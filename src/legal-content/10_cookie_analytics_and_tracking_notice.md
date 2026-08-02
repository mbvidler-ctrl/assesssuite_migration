# AssessSuite Cookie, Analytics and Tracking Notice

**Release status:** APPROVED FOR PUBLICATION — LIMITED PUBLIC-SITE ANALYTICS ONLY

**Effective date:** 2 August 2026

**Publication authority:** Mission UM-AUTO-20260801-ASSESSSUITE-SPLIT-HOSTING-ANALYTICS

**Approved by:** Maxwell Vidler under mission UM-AUTO-20260801-ASSESSSUITE-SPLIT-HOSTING-ANALYTICS

**Version:** RC-2026.07.19
**Controlled revision:** 2 August 2026, revision 2026-08-02.1

## 1. Current position

AssessSuite uses Vercel Web Analytics only on the public homepage and public legal pages at `assesssuite.com` and `www.assesssuite.com`. It measures aggregate page views, estimated daily visitors and external referrers. It does not set analytics cookies. Vercel estimates daily visitors using a hash derived from the incoming request that resets each day; the visitor-session value is discarded after 24 hours.

Before a page-view event is sent, AssessSuite removes the query string and URL fragment from the measured page URL and rejects routes outside the public homepage and public legal pages. AssessSuite does not configure custom events, UTM reporting, feature-flag analytics, session replay, advertising pixels or cross-site behavioural tracking.

Vercel may also derive aggregate country, browser, operating-system and device categories from a request. Web Analytics is not loaded in the authenticated AssessSuite application and is not used on account, patient, clinical, assessment, note, report, payment, upload, function or API routes. Patient Data is not authorised for this service.

## 2. Categories

| Category | Purpose | Consent position |
|---|---|---|
| Strictly necessary | Sign-in, session, security, fraud prevention, load and legal-preference records | Required for the requested Service; explain and minimise |
| Functional | Remember non-essential display or workflow preferences | User choice where not necessary |
| Limited public-site analytics | Aggregate public page views, estimated daily visitors, referrers and coarse device/location categories | Active only on the allowlisted public marketing and legal routes described above; cookie-free; Patient Data prohibited |
| Product analytics | Measure authenticated feature use | Not enabled through Vercel Web Analytics and not authorised by this notice |
| Session replay | Reconstruct interface activity | Prohibited on authenticated, patient, assessment, note, report, payment and consent paths; not enabled on the public site |
| Advertising or cross-site tracking | Target or measure marketing | Prohibited; no advertising pixel or cross-site behavioural tracking is enabled |

## 3. Sensitive-path rule

AssessSuite must not send a URL, page title, form field, search term, identifier, assessment, condition, referral, report, event or other signal that reveals or permits an inference about health information to an advertising or unapproved analytics provider.

This applies even if a provider labels the data pseudonymous. A cookie ID linked with a fertility, condition, medication, exercise-treatment or patient page can itself reveal sensitive information.

## 4. Current analytics inventory

| Technology | Provider | Public routes | Data and retention boundary |
|---|---|---|---|
| Vercel Web Analytics package version 2 | Vercel Inc. | `/` and approved `/legal/<slug>` pages on the production apex and `www` hosts | Cookie-free page views, daily-reset visitor estimate, external referrer and aggregate country/browser/OS/device categories. Measured page URL query strings and fragments are removed. The visitor-session value is discarded after 24 hours. AssessSuite uses the standard Pro reporting window, currently 12 months; Web Analytics Plus and analytics drains are not enabled. |

Essential authentication and session storage in the separately hosted application is outside this limited public-site analytics inventory and remains governed by the Privacy Policy and security controls for the Service.

## 5. User controls

Vercel Web Analytics does not set analytics cookies. Browser or content-blocking settings may prevent this limited measurement without affecting the public website or paid clinical functions. The public site does not require consent to advertising or session replay because neither is enabled.

Browser blocking may separately affect essential sign-in functions in the authenticated application. AssessSuite does not condition clinical access on accepting public-site analytics.

## 6. Changes

Adding custom events, UTM reporting, feature-flag analytics, session replay, advertising, measurement of authenticated or sensitive routes, an analytics drain or another analytics provider requires a further controlled revision before activation.

Questions or privacy requests may be sent to admin@assesssuite.com or 1800 317 553.
