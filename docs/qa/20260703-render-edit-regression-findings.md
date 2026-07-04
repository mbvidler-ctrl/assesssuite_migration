# ASX-RPT-20260703-01 — Render/Edit Formatting Regression Audit — Findings Filed

The full findings document was produced by the live Base44 application's own builder agent, under prompt reference `ASX-RPT-20260703-01`, and provided to the engineering session by Maxwell Vidler on 4 July 2026. The canonical copy is the chat transcript and this repository's issue register entry (I5) referencing it.

## Summary

Of sixteen report and document-editing components examined against a precisely defined defect signature (a boolean edit/view toggle; a view state rendering content through a markup-interpreting mechanism; an edit state rendering the identical underlying value through a plain, non-interpreting text input), the exact signature was confirmed in three — `ReviewExport.jsx`, both internal components of `PDFFormFiller.jsx`, and `PrivateHealthInitialAssessment.jsx` — and a variant was found in a further seven, where the edit state shows a full JSON serialisation of the report-data object rather than the rendered content directly. One component (`UnifiedReportWizard.jsx`) was refuted on inspection; six had no relevant edit/view toggle at all.

Two points material to any future fix:

1. `react-quill`, a rich-text editing library, is declared as a dependency in `package.json` but is imported and used nowhere across the 508 files comprising `src/`. A fit-for-purpose component for this fix already exists in the dependency tree, unused.
2. Several of the affected components give the language model no explicit output-format instruction (HTML, markdown, or plain text) — a plausible explanation for the defect's apparently inconsistent visibility over time, since an unconstrained prompt would not be expected to produce the same kind of output on every occasion.

No remediation has been undertaken. Logged as issue I5 (Launch Gate G9) in the AssessSuite Decision, Cost and Risk Register, and referenced in the post-launch operating-model memorandum (`20260704-assesssuite-post-launch-operating-model-options.md`) as evidence for that memorandum's recommendation.
