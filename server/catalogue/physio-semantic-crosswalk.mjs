/**
 * Explicit EP source-to-source semantic reconciliation.
 *
 * These rows do not delete or rewrite a source definition. They identify an
 * original EP runtime source that describes the same instrument/protocol as a
 * richer retained EP source. The complete source content remains checksummed
 * in the manifest as a `same-instrument-ep-duplicate` variant.
 */
export const EP_SEMANTIC_DUPLICATE_CROSSWALK = Object.freeze([
  Object.freeze({
    sourceRef: 'ep-import:6876d96437f326610e5253bb',
    targetSourceRef: 'ep-import:6933c59973f16bb2124f3c65',
    relationship: 'same-instrument-ep-duplicate',
    rationale: 'Both sources administer the 30-second chair-rise protocol and score the number of full stands; the retained source supplies the fuller contraindication and normative table.',
  }),
  Object.freeze({
    sourceRef: 'ep-synthetic:30-second-sit-to-stand',
    targetSourceRef: 'ep-import:6933c59973f16bb2124f3c65',
    relationship: 'same-instrument-ep-duplicate',
    rationale: 'The synthetic record is an abbreviated 30-second chair-rise example for the same instrument; the retained import contains the full protocol, scoring rules, references and normative table.',
  }),
  Object.freeze({
    sourceRef: 'ep-synthetic:timed-up-and-go',
    targetSourceRef: 'ep-import:6900b2fb190ed8134f88dcd6',
    relationship: 'same-instrument-ep-duplicate',
    rationale: 'Both sources time standing from a chair, walking three metres, turning, returning and sitting; the retained import contains the complete administration script, trials and interpretation.',
  }),
  Object.freeze({
    sourceRef: 'ep-import:6933c3bbb49a5d359580fe88',
    targetSourceRef: 'ep-import:691eb8c39a4ee560fb861ef5',
    relationship: 'same-instrument-ep-duplicate',
    rationale: 'Both sources are the two-minute in-place step test and count right-knee lifts reaching the same target height; the retained source has the fuller setup, script and age/sex normative table.',
  }),
  Object.freeze({
    sourceRef: 'ep-import:6933cc3f697c55fe37e0bc15',
    targetSourceRef: 'ep-import:6933d97ed8d7afa0d779cc6d',
    relationship: 'same-instrument-ep-duplicate',
    rationale: 'Both sources describe the Modified Bruce treadmill protocol; the retained source explicitly records stages 0 and one-half before the standard Bruce stages and carries the fuller safety content.',
  }),
  Object.freeze({
    sourceRef: 'ep-synthetic:six-minute-walk-test',
    targetSourceRef: 'ep-import:69636f09c9620c87150fe372',
    relationship: 'same-instrument-ep-duplicate',
    rationale: 'Both sources administer the standard six-minute walk for total distance; the retained import contains the complete setup, standardised encouragement, observations, equations and references.',
  }),
]);

export const EXPECTED_EP_SEMANTIC_DUPLICATE_COUNT = 6;
