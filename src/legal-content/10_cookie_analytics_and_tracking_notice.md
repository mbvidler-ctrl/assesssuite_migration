# AssessSuite Cookie, Analytics and Tracking Notice

**Release status:** APPROVED FOR PUBLICATION — PUBLIC-SITE ANALYTICS DISABLED

**Effective date:** 2 August 2026

**Publication authority:** Mission UM-AUTO-20260801-ASSESSSUITE-SPLIT-HOSTING-ANALYTICS

**Approved by:** Maxwell Vidler under mission UM-AUTO-20260801-ASSESSSUITE-SPLIT-HOSTING-ANALYTICS

**Version:** RC-2026.07.19
**Controlled revision:** 2 August 2026, revision 2026-08-02.2

## 1. Current position

Project-level Vercel Web Analytics is disabled and the deployed AssessSuite public site does not initiate Web Analytics events. No other public-site analytics provider is enabled. Vercel continues to host the public homepage and public legal pages at `assesssuite.com` and `www.assesssuite.com`.

Vercel Web Analytics was briefly active from approximately 12:25 pm to 3:10 pm AEST on 2 August 2026. The implementation removed the query string and URL fragment from the measured page URL and rejected routes outside the public homepage and public legal pages. Post-deployment verification then showed that the provider script could append a fuller external referring URL after that page-URL filter. AssessSuite disabled Web Analytics at project level and removed the analytics component from the deployed public website.

During the brief enabled interval, Vercel may have processed the public page origin and path, event time, a request-derived daily visitor estimate, external referrer information and coarse country, browser, operating-system and device categories. Vercel reports that the project received data during that interval. AssessSuite has not established that any actual Patient Data was included. Web Analytics was not authorised for Patient Data and was not loaded in the authenticated AssessSuite application or on account, patient, clinical, assessment, note, report, payment, upload, function or API routes.

## 2. Categories

| Category | Purpose | Consent position |
|---|---|---|
| Strictly necessary | Sign-in, session, security, fraud prevention, load and legal-preference records | Required for the requested Service; explain and minimise |
| Functional | Remember non-essential display or workflow preferences | User choice where not necessary |
| Limited public-site analytics | Aggregate public page views, estimated daily visitors, referrers and coarse device/location categories | Disabled; briefly active only on the allowlisted public marketing and legal routes on 2 August 2026; Patient Data was prohibited |
| Product analytics | Measure authenticated feature use | Not enabled through Vercel Web Analytics and not authorised by this notice |
| Session replay | Reconstruct interface activity | Prohibited on authenticated, patient, assessment, note, report, payment and consent paths; not enabled on the public site |
| Advertising or cross-site tracking | Target or measure marketing | Prohibited; no advertising pixel or cross-site behavioural tracking is enabled |

## 3. Sensitive-path rule

AssessSuite must not send a URL, page title, form field, search term, identifier, assessment, condition, referral, report, event or other signal that reveals or permits an inference about health information to an advertising or unapproved analytics provider.

This applies even if a provider labels the data pseudonymous. A cookie ID linked with a fertility, condition, medication, exercise-treatment or patient page can itself reveal sensitive information.

## 4. Current analytics inventory

| Technology | Provider | Public routes | Data and retention boundary |
|---|---|---|---|
| Vercel Web Analytics package version 2 | Vercel Inc. | Disabled; historically limited to `/` and approved `/legal/<slug>` pages on the production apex and `www` hosts | Briefly active on 2 August 2026. The measured page URL query string and fragment were removed, but the provider could append the external referring URL after that filter. Vercel reports that data was received during the interval. Project-level Web Analytics is disabled, the deployed component has been removed, and the deployed AssessSuite public site does not initiate Web Analytics events. Web Analytics Plus and analytics drains were not enabled. |

Essential authentication and session storage in the separately hosted application is outside this limited public-site analytics inventory and remains governed by the Privacy Policy and security controls for the Service.

## 5. User controls

No public-site analytics or advertising tracker is currently enabled. Browser or content-blocking settings do not need to permit analytics for the public website or paid clinical functions to operate. Advertising and session replay remain disabled.

Browser blocking may separately affect essential sign-in functions in the authenticated application. AssessSuite does not condition clinical access on accepting public-site analytics.

## 6. Changes

Reactivating Vercel Web Analytics, or adding custom events, UTM reporting, feature-flag analytics, session replay, advertising, measurement of authenticated or sensitive routes, an analytics drain or another analytics provider, requires a further controlled revision and independent verification of the proposed minimisation boundary before activation.

Questions or privacy requests may be sent to admin@assesssuite.com or 1800 317 553.
