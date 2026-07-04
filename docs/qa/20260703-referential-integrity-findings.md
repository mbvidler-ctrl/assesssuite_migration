# ASX-PI-20260703-01 — Referential Integrity Audit — Findings Filed

The full findings document was produced by the live Base44 application's own builder agent, under prompt reference `ASX-PI-20260703-01`, and provided to the engineering session by Maxwell Vidler on 4 July 2026. It is filed in full in the AssessSuite matter's service-delivery folder at:

`Unimatter/02_Client_and_Venture_Matters/AssessSuite/work-product/service-delivery-20260701/` (as pasted into that session; the canonical copy of record is the chat transcript and this repository's issue/risk register entries referencing it).

## Summary

458 findings across nineteen entity types: 105 orphaned client-scoped records, 143 ClientAssessment records referencing a nonexistent Assessment, 131 referencing a soft-deleted Assessment, zero cross-organisation drift, zero orphaned Organization references, five OrganizationMember records with no matching User, 36 questionnaire Assessments with no questions, and 38 soft-deleted Assessments still flagged as having a test runner. The audit's own self-verification stage re-confirmed all 458 findings individually and used full pagination throughout, so none of the totals are truncation artefacts.

Two points are carried into the matter's Decision, Cost and Risk Register (issue I4, risk R13) rather than repeated here in full:

1. One client record's complete deletion left sixteen dependent records orphaned — including an adverse-event record — while every other client-scoped orphan in the audit was one or two records scattered across roughly thirty-seven other clients, consistent with ordinary accumulated drift rather than a single deletion event.
2. The volume of live data found (201 clients; 1,802 client assessments; 1,303 condition records; eighteen organisations) is difficult to reconcile with this application being treated as pre-launch with no real users, and bears directly on Decision D4 (real data handling), which remains open.

No remediation has been undertaken against any of these findings. This document exists so the finding is discoverable from within the repository's own QA record, alongside the security and rendering audits already filed here.
