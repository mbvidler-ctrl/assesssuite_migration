# AssessSuite Cookie, Analytics and Tracking Notice

**Release status:** APPROVED FOR PUBLICATION — BOUNDED PUBLIC-SITE VERCEL WEB ANALYTICS AND FIRST-PARTY AGGREGATE MEASUREMENT

**Effective date:** 4 August 2026

**Publication authority:** Mission UM-AUTO-20260801-ASSESSSUITE-SPLIT-HOSTING-ANALYTICS

**Approved by:** Maxwell Vidler under mission UM-AUTO-20260801-ASSESSSUITE-SPLIT-HOSTING-ANALYTICS

**Version:** RC-2026.07.19
**Controlled revision:** 4 August 2026, revision 2026-08-04.1

## 1. Current position

Vercel Web Analytics is enabled only on the public homepage and approved public legal pages at `assesssuite.com` and `www.assesssuite.com`. The production filter rejects non-page-view events, preview hosts, authenticated-application routes and unapproved paths. It removes the query string and URL fragment from the measured AssessSuite page URL before a page-view event is sent.

Vercel may separately process the browser-supplied external referring URL, including a referring path or query string when the referring site and browser supply it. AssessSuite does not place Patient Data in public marketing or legal URLs and does not authorise Vercel Web Analytics for Patient Data. No custom events, UTM reporting, feature-flag analytics, session replay, advertising analytics, Web Analytics Plus or analytics drain is enabled.

The separate first-party aggregate measurement holds only four Australia/Brisbane daily totals in the AssessSuite Fly database: public-site page loads, successful sign-ins, newly verified accounts and authenticated application opens. It creates no raw measurement-event rows and sends none of those first-party measurement events to Vercel or another analytics provider.

Vercel Web Analytics was briefly active from approximately 12:25 pm to 3:10 pm AEST on 2 August 2026. The implementation removed the query string and URL fragment from the measured page URL and rejected routes outside the public homepage and public legal pages. Post-deployment verification then showed that the provider script could append a fuller external referring URL after that page-URL filter. AssessSuite disabled Web Analytics at project level and removed the analytics component from the deployed public website.

During the brief enabled interval, Vercel may have processed the public page origin and path, event time, a request-derived daily visitor estimate, external referrer information and coarse country, browser, operating-system and device categories. Vercel reports that the project received data during that interval. AssessSuite has not established that any actual Patient Data was included. Web Analytics was not authorised for Patient Data and was not loaded in the authenticated AssessSuite application or on account, patient, clinical, assessment, note, report, payment, upload, function or API routes.

## 2. Categories

| Category | Purpose | Consent position |
|---|---|---|
| Strictly necessary | Sign-in, session, security, fraud prevention, load and legal-preference records | Required for the requested Service; explain and minimise |
| Functional | Remember non-essential display or workflow preferences | User choice where not necessary |
| Limited Vercel public-site analytics | Aggregate public page views, estimated daily visitors, external referrers and coarse device/location categories | Enabled only on the allowlisted public marketing and legal routes; cookie-free; Patient Data prohibited |
| First-party aggregate operational measurement | Count public-site page loads, successful sign-ins, newly verified accounts and authenticated application opens by Australia/Brisbane day | Active; no analytics cookie, identifier or person-level record; public aggregate-only reporting |
| Other product analytics | Measure authenticated feature use beyond the four disclosed daily totals | Not enabled through Vercel Web Analytics and not authorised by this notice |
| Session replay | Reconstruct interface activity | Prohibited on authenticated, patient, assessment, note, report, payment and consent paths; not enabled on the public site |
| Advertising or cross-site tracking | Target or measure marketing | Prohibited; no advertising pixel or cross-site behavioural tracking is enabled |

## 3. Sensitive-path rule

AssessSuite must not send a URL, page title, form field, search term, identifier, assessment, condition, referral, report, event or other signal that reveals or permits an inference about health information to an advertising or unapproved analytics provider.

This applies even if a provider labels the data pseudonymous. A cookie ID linked with a fertility, condition, medication, exercise-treatment or patient page can itself reveal sensitive information.

The first-party measurement table and dashboard must not contain or derive IP address, user agent, referrer, acquisition source, URL, path, query string, exact event time, user, account, session or organisation identifier, clinical or payment information, or free text. A public-site page load is an occurrence count, not a person, unique visitor or customer journey. An endpoint may validate that a page-load request came from an approved production origin, but that origin is not written to the measurement table or reported in the dashboard.

The authenticated application may use a non-identifying same-tab `sessionStorage` flag containing only the value `1` to avoid repeated app-open counts within the same browser-tab session. The flag is not transmitted, cannot distinguish one person from another and is not stored with the daily total.

## 4. Current analytics inventory

| Technology | Provider | Measurement surface | Data and retention boundary |
|---|---|---|---|
| Vercel Web Analytics package version 2.0.1 | Vercel Inc. | `/` and approved `/legal/<slug>` pages on the production apex and `www` hosts only | Cookie-free page views, a request-derived daily visitor estimate, event time, the filtered AssessSuite origin/path, browser-supplied external referring URL and coarse country/browser/OS/device categories. The filter removes query strings and fragments from the measured AssessSuite page URL, but cannot remove a separate referrer value added by the provider script. Vercel states that the daily visitor hash resets each day and its visitor-session value is discarded after 24 hours. The current UniMatter team is on Vercel Pro, which provides a 12-month Web Analytics reporting window; Vercel may retain analytics data longer, including to preserve upgrade options. Web Analytics Plus and analytics drains are not enabled. |
| AssessSuite first-party aggregate counter | AssessSuite application on Fly.io; no separate analytics provider | Public-site page-load occurrences plus the three disclosed application lifecycle counters | Each occurrence increments one Australia/Brisbane daily total. The database holds no raw measurement-event row and none of the prohibited fields in section 3. The public dashboard reads aggregate totals only. |

Essential authentication and session records remain separate from the aggregate measurement table and continue to be governed by the Privacy Policy and security controls for the Service.

## 5. User controls

Vercel Web Analytics does not set analytics cookies. Browser or content-blocking settings may prevent this limited measurement without affecting the public website or paid clinical functions. The first-party totals also use no analytics cookie or browser identifier and create no person-level analytics preference record. Advertising and session replay remain disabled.

Browser blocking may separately affect essential sign-in functions in the authenticated application. AssessSuite does not condition clinical access on accepting public-site analytics.

## 6. Changes

Adding custom events, UTM reporting, feature-flag analytics, session replay, advertising, authenticated or sensitive routes, an analytics drain, person-level or organisation-level reporting, or another analytics provider requires a further controlled revision before activation.

Questions or privacy requests may be sent to admin@assesssuite.com or 1800 317 553.
