# AssessSuite Clinical-Claims Audit Register

Opened 5 July 2026 under mission order UM-AUTO-20260705-ASSESSSUITE-ENGINEERING-SPRINT-DEMO (priority P-C). This register enumerates every surface in the application that makes a clinical claim, records where the claim came from, whether it is correct, and how it should be remediated. It is a standing, incrementally-completed workstream, not a one-pass document.

**Governing rule (fabrication prohibition).** No claim, cutoff, normative value, or citation may ever be "corrected" to an invented value. Every remediation must cite a resolved primary source or be escalated to registered-clinician sign-off. A claim that cannot be sourced is marked `unverifiable`, never guessed.

**Gate on P-B.** The automated normative interpretation (priority P-B) may only present a norm to a clinician as *authoritative* once that norm's row here is `verified`. Until then the interpretation carries a visible `SYNTHETIC / unverified` provenance tag (this is enforced today: all seeded norms are labelled synthetic in `normative_source`). Direction-of-benefit metadata (`normative_direction`) is a required, audited field for every norm, because a correct number in the wrong direction is itself a fabricated clinical implication.

## Claim taxonomy and provenance

| Category | What it is | Typical provenance | How correctness is assessed |
|---|---|---|---|
| 1. LLM-generated | Protocols, SOAP assessment/plan, recommendations, medication alerts, nutrition, report narrative | LLM parametric memory / LLM+web | Not source-verifiable from output (LLM is mocked in the shim); governed by citation-request + verification wiring + clinician sign-off |
| 2. Static constants | Severity cutoffs, normative tables, scoring formulas, MET/VO2 equations, diagnostic stats, DOI literals | Hard-coded literal in a runner | Checkable against the published instrument / cited primary source; attribution-checkable |
| 3. Catalogue content | Assessment `references`, `contraindications`, `scoring_system`, `ai_instruction` | Seed, clinician, or **LLM-persisted via approveFix** | Depends on writer; LLM-written catalogue content is suspect |
| 4. Marketing | Landing-page capability and scheme-alignment claims | Copywriting | Verifiable against the app's actual behaviour and each scheme's published requirements |

## Verification method per claim class

- **Scoring formulas** (DASS ×2, Siri, Jackson–Pollock, ACSM MET/VO2): deterministic pass/fail against the published equation.
- **Severity cutoffs / normative tables**: verify the value against the cited primary source AND that the cited source actually states it for this test (attribution integrity).
- **DOI / PMID literals**: existence-verifiable (Crossref / doi.org / PubMed E-utilities); *support* — that the reference backs the claim beside it — must be human/clinician-checked. Existence alone is insufficient (the dominant failure mode is a real DOI on the wrong paper).
- **Contraindications, scope-of-practice, prognosis, LLM narrative**: not mechanically verifiable — route to registered-clinician sign-off.
- **Scheme-alignment marketing**: verify against the named scheme's published requirements.

## Tranches (clinical-risk order)

1. **Tranche 1 — safety-critical & interpretation-driving.** Medication-safety alerts; all contraindication/red-flag blocks; questionnaire severity cutoffs that persist a "Severe"/"Extremely Severe" label (DASS-21, K10, PHQ-9, GAD-7, PCL-5).
2. **Tranche 2 — wrong-number risk.** Scoring formulas and normative cutoffs that yield an incorrect value (Siri, Jackson–Pollock, ACSM MET/VO2, VO2max regressions; Rikli–Jones / Bohannon / Bischoff norms).
3. **Tranche 3 — citation integrity.** Every hard-coded DOI/PMID/citation across runners and the catalogue: existence + support-check via the planned PubMed/OpenAlex/Crossref verification service; gate `ClickableReferences` to a verified badge.
4. **Tranche 4 — diagnostic stats, prognosis, marketing.** Special-test sensitivity/specificity/LR against cited meta-analyses; scheme-alignment claims; prognosis/scope text to clinician sign-off.

## Register (first tranche of concrete findings)

Verdicts: `verified` (checked correct against cited source), `defect` (confirmed wrong), `conflict` (self-inconsistent), `flag` (needs verification), `synthetic` (placeholder pending sourced data), `signoff` (clinician-only).

| ID | Cat | Class | Surface | Claim | Provenance | Verdict | Remediation | Tranche | Status |
|---|---|---|---|---|---|---|---|---|---|
| CL-DASS21-BANDS | 2 | severity_cutoff | `src/lib/clinical/dass21.js` (now single source; formerly `DASS21Runner.jsx`) | DASS-21 subscale severity cutoffs & ×2 multiplier | hardcoded literal | verified | Matches Lovibond & Lovibond (1995) DASS Manual (2nd ed.). Attribution now recorded in-code (`DASS21_SOURCE`). | 1 | done |
| CL-STS-BFAT-SITE | 2 | scoring_formula | `BodyFatPercentageSkinfoldsRunner.jsx` | Jackson–Pollock equation selected by COUNT of skinfolds (4 vs 7), not by whether the correct SITES were entered | hardcoded literal | defect | Bind the equation to a named site-set; validate the entered sites; reject mismatched site inputs. | 2 | open |
| CL-MET-WALK-SCOPE | 2 | MET_VO2_formula | `METCalculationRunner.jsx` | ACSM walking VO2 equation applied to any speed with no range guard (valid only ~1.9–4.0 mph walking) | hardcoded literal, uncited | defect | Add a speed-range guard; select walking vs running equation by input; cite ACSM Guidelines. | 2 | open |
| CL-MCMURRAY-STATS | 2 | diagnostic_stat | `McMurraysTestRunner.jsx` | Sensitivity stated three ways in one file (~57% / ~50–70% / ~50–60%); two hard-coded DOIs, no runtime check | hardcoded literal | conflict | Reconcile to a single figure against Hegedus et al. (2015) meta-analysis; verify both DOIs and their support. | 4 | open |
| CL-STS-BISCHOFF | 2 | normative_table | `30SecondSittoStandTestRunner.jsx` | Fall-risk `<12 reps` threshold attributed to Bischoff et al. (2003), which is a Timed-Up-and-Go study | hardcoded literal | flag | Verify the source of the cited threshold; correct the attribution or the value. | 2 | open |
| CL-CAT-WRITEBACK | 1/3 | catalogue_contamination | `AssessmentAudit.jsx:847` (LLM path — the vector); `AdminApprovals.jsx:244/419/1080` (boolean flags), `:282` (human edit) | LLM-generated references persisted into the Assessment catalogue with no verification | LLM-persisted-to-catalogue | defect | **DONE (LLM path)** — `AssessmentAudit.approveFix` now verifies AI-generated references via `verifyReferences` before write; keeps only verified citations, drops the rest with a count, and persists none if the service is unavailable. AdminApprovals `244/419/1080` write only boolean quality flags (no reference content); `282` is a human-authored edit (lower risk) — optional verify-and-warn is a follow-on. | 3 | wired (LLM path) |
| CL-CLICKABLE-REFS | 3 | reference_DOI | `ClickableReferences.jsx` | Any citation-shaped string rendered as an authoritative clickable DOI/PMID link with no existence or support check | presentation layer | defect | Backward-compatible `verified` badge added (verified / not-independently-verified). Per-citation badge gating across all callers is the follow-on. | 3 | partial |
| CL-LLM-SOAP | 1 | interpretation_narrative | `SOAPNoteModal.jsx:1337/1436` | LLM writes clinical Assessment and Plan narrative into the SOAP record, no citation | LLM parametric | signoff | Not source-verifiable; require clinician review before finalising; label as AI-drafted. | 1 | open |
| CL-MEDALERTS | 1 | contraindication | `client/MedicationAlerts.jsx` | Per-medication exercise-safety alerts were from an "expert pharmacologist" prompt on parametric memory, no citation | LLM parametric | signoff | **GROUNDED** — now fetches the real openFDA drug label (via `medicalLookup`) and displays authoritative, provenance-tagged contraindications/warnings; the LLM sentence is grounded on that label text and clearly labelled "AI-drafted (decision support)". Clinician sign-off still applies to the AI sentence. | 1 | grounded |
| CL-TX-PROTOCOL-REFS | 1 | reference_DOI | `TreatmentProtocols.jsx:252` | LLM protocol requests DOIs; `validateReferences` checks only that the DOI RESOLVES, not that it supports the claim | LLM+web | flag | **DONE** — `validateReferences` now calls the `verifyReferences` service (OpenAlex/PubMed title+author+year cross-match); unverified references are dropped with a visible count; never asserts verified on failure. | 3 | wired |
| CL-SEED-NORMS | 2 | normative_table | `server/seed.mjs` (TUG, 6MWT, 30s STS) | Normative mean/SD/percentile values seeded for P-B demonstration | SYNTHETIC (agent-authored, labelled) | synthetic | Replace with clinician-sourced published norms (e.g. Rikli–Jones for STS, ATS/ERS reference equations for 6MWT) and set verdict `verified` before removing the synthetic tag. Direction flags already set and correct. | 2 | open |
| CL-MKT-SCHEMES | 4 | scheme_alignment | `LandingLive.jsx` | ~40 funding-scheme alignment claims (SIRA, BACPR/SIGN, NDIS, TAC, WSIB, NHS ERS) | copywriting | flag | Verify each against the scheme's published requirements; qualify or remove unsupported claims. | 4 | open |
| CL-MKT-COUNT | 4 | scheme_alignment | `Landing.jsx:465/567` | "226+ validated clinical assessments … with normative data and automated interpretation" | copywriting | flag | "validated" and "normative data … automated interpretation" must match the audited state; today most assessments have neither verified norms nor interpretation. Qualify the claim. | 4 | open |

## Enumeration status

- The full Category-2 harvest (301 runners; 391 statistic/formula markers; 194 citation-bearing files; 16 hard DOI literals) is scripted but not yet run in bulk — see recon `wf_cfcfe211-899`. The rows above are the hand-triaged highest-risk instances.
- Category-1 clinical claims cannot be audited from generated output in the shim (the LLM integration is mocked). They are governed by design controls (citation-request, the verification service, clinician sign-off), not by output inspection.
- The citation-verification service (PubMed E-utilities / OpenAlex / Crossref, all zero-cost) is designed in the sprint mission order (Annex A, Priority 4) and is the tooling backbone for Tranche 3.

## Tooling built (5 July 2026) — citation-verification service

The Tranche-3 backbone now exists and is tested against live databases:

- `server/evidence.mjs` — verifies a citation against OpenAlex (primary; DOI lookup + title search returning title/authors/year), PubMed E-utilities (cross-check), Crossref (best-effort). Verdicts: `verified` / `mismatch` (real DOI, wrong paper) / `unverifiable`. Title/author/year cross-match, not mere DOI existence. **Never** returns `verified` on a network failure. Zero-cost, keyless, polite-pool `mailto`, rate-limited, in-memory cache. Bibliographic strings only — no client data leaves the server.
- `server/functions/verifyReferences.mjs` — exposes it to the app (`base44.functions.invoke('verifyReferences', { citations })`), authenticated, max 25 per call.
- Live self-test `scripts/evidence-selftest.mjs` — 11/11, incl. the real-DOI-wrong-paper catch and never-verify-on-failure. End-to-end through the running shim: verified / mismatch / unverifiable across three citations, 401 without auth.

## Onboarding enrichment (built 6 July 2026)

Serves the client's request to enrich onboarding for conditions and medications by reference to authoritative data (not LLM memory):

- `server/medicalLookup.mjs` + `server/functions/medicalLookup.mjs` — conditions → ICD-10-CM codes (NIH Clinical Tables); medications → RxNorm generic-ingredient normalisation + openFDA drug-label warnings/contraindications. Every field verbatim from an authoritative source with provenance tags; **US-jurisdiction caveat surfaced in every payload** (RxNorm/openFDA are US-sourced; matched at ingredient level; Australian AMT/TGA has no free API). Terms only leave the server — no client data.
- Wired: `AddConditionModal` shows debounced ICD-10-CM code suggestions for the typed condition (decision-support; clinician chooses; degrades silently), storing the selected code on the condition.
- Live self-test `scripts/medical-lookup-selftest.mjs` — 9/9 + end-to-end through the shim (E11.65/E11.9 for type 2 diabetes; metformin → rxcui 6809 + real openFDA contraindications; 401 without auth).

## What is closed as at 5 July 2026

- `CL-DASS21-BANDS` — verified against the DASS manual; cutoffs consolidated into a single sourced module.
- P-B safety mechanism — direction-of-benefit is a required field; interpretations are templated strictly from stored numbers; the clinical-inference clause is curated-only, never generated; all seeded norms are labelled synthetic so nothing false is presented as verified.
- `CL-TX-PROTOCOL-REFS` — TreatmentProtocols now cross-matches references via the service (drop-with-count; no false "verified").
- Citation-verification service built, tested (11/11 live + end-to-end through the shim), and exposed as `verifyReferences`.
- `CL-CAT-WRITEBACK` (LLM path) — the catalogue write-back in `AssessmentAudit.approveFix` now gates AI-generated references through the service before persistence, so unverified/fabricated references can no longer enter the Assessment catalogue. Gate logic is a pure, unit-tested helper (`src/lib/clinical/referenceGate.js`).
