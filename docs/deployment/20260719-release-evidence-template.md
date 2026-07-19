# AssessSuite production release evidence

**Mission:** `UM-AUTO-20260719-ASSESSSUITE-REFERRAL-SIGNUP-RELEASE`<br>
**Evidence status:** `NOT EXECUTED`<br>
**Prepared by:**<br>
**Reviewed by:**<br>
**Release window (UTC/AEST):**

Do not include secret values, production records, referral contents, provider payloads, environment dumps or the contents of account-specific provider arrangements. Record durable non-secret evidence identifiers only.

## A. Trusted workflow bootstrap

| Field | Evidence |
|---|---|
| Workflow-only branch | |
| Pull request URL/number | |
| Base branch | `main` |
| Files changed (must be three workflow files only) | |
| Independent reviewer | |
| Action pins reviewed | checkout `9c091...`; setup-node `820762...`; Fly setup `ed8efb...`; flyctl `0.4.71` |
| Workflow YAML/semantic validation | |
| Bootstrap merge SHA | |
| GitHub environment control verified | |
| External-action register entry | |

## B. Candidate provenance

| Field | Evidence |
|---|---|
| Confirmed production base | `d593a7f2e83657125d5be4acb49642a38215d5bd` |
| Local verified SHA | |
| Remote source branch | |
| Remote branch-tip SHA | |
| Pull-request head SHA | |
| Three-SHA equality | `NOT VERIFIED` |
| Pull request URL/number | |
| Independent complete-diff review | |
| Post-review commit check | |

## C. Compatibility rollback image

| Field | Evidence |
|---|---|
| Compatibility source branch | |
| Compatibility source SHA | |
| Superseded legal-suite version | |
| New legal-suite version | |
| `test:rollback-compatibility` result | `NOT RUN` |
| Adult extraction disabled in compatibility config | `NOT VERIFIED` |
| Under-age extraction disabled in compatibility config | `NOT VERIFIED` |
| Build-only workflow run ID/URL | |
| Full compatibility image | |
| Build timestamp | |
| Production deployment during image build | must be `no` |
| Independent compatibility review | |

## D. Provider-processing gates

| Field | Evidence |
|---|---|
| Adult extraction runtime mode | default `disabled` |
| Adult terms literal | default `EXTRACTION-DISABLED` |
| Adult terms evidence ID | default `NOT-APPLICABLE-EXTRACTION-DISABLED`; enabled value may be `EVD-20260719-ASSESSSUITE-OPENAI-HEALTH-TERMS-ATTESTATION` |
| Evidence ID present in capability intent | `NOT VERIFIED` |
| Under-age/ZDR runtime mode | default `disabled` |
| Under-age/ZDR literal | default `UNDER-AGE-ZDR-DISABLED` |
| Under-age/ZDR evidence ID | default `NOT-APPLICABLE-UNDER-AGE-ZDR-DISABLED` |
| Opaque Fly enablement secret names absent | `NOT VERIFIED` |
| Arrangement contents requested or recorded | must be `no` |

## E. Release gates

| Gate | Result | Evidence pointer |
|---|---|---|
| `npm ci` | `NOT RUN` | |
| Build | `NOT RUN` | |
| Typecheck | `NOT RUN` | |
| Lint baseline containment | `NOT RUN` | |
| Server selftest | `NOT RUN` | |
| Entry-guard suite | `NOT RUN` | |
| Clinical selftest | `NOT RUN` | |
| PA E2E verify | `NOT RUN` | |
| Smoke suite | `NOT RUN` | |
| Seeded launch-gate suite | `NOT RUN` | |
| Evidence service suite | `NOT RUN` | |
| Medical lookup suite | `NOT RUN` | |
| `test:assurance` aggregate | `NOT RUN` | |
| Real-provider synthetic PDF + image probe | `NOT RUN` | enabled mode requires bounded PASS metadata for both fixtures; disabled mode records `SKIPPED-BY-DESIGN` and cannot close the extraction mission |
| Complete-diff secret/high-entropy scan | `NOT RUN` | |
| Local labelled Docker image gate | `NOT RUN` | |
| Independent security/privacy review | `NOT RUN` | |
| Opponent/rollback-readiness pass | `NOT RUN` | |
| Staging rehearsal | `NOT RUN` | |

No skipped, unavailable, network-skipped or baseline-failing gate may be recorded as passed.

## F. Capability and dispatch

| Field | Evidence |
|---|---|
| Capability intent ID | |
| Decision | must be `authorised` |
| `execution_ready` | must be `true` |
| Executor | GitHub Actions |
| Target | `assesssuite-production` |
| Exact candidate SHA | |
| Rollback image | |
| Credential label | `FLY_API_TOKEN` (label only) |
| Transaction amount | `0` |
| Data classification | public code/config plus clinical-system deployment; no production-record access |
| User interaction required | `no` |
| Dispatching actor | |
| Dispatch time | |
| Workflow run ID/URL | |

## G. Before and after release identity

| Field | Evidence |
|---|---|
| Expected prior Fly release | |
| Observed prior Fly release | |
| Expected prior image | |
| Observed prior image | |
| Candidate SHA | |
| Candidate build timestamp | |
| Candidate Fly release | |
| Candidate full image | |
| `assesssuite.com/api/version` exact SHA | `NOT VERIFIED` |
| `assesssuite-production.fly.dev/api/version` exact SHA | `NOT VERIFIED` |
| Workflow conclusion | |

## H. Bounded public smoke

| Check | Result | Evidence |
|---|---|---|
| Both public domains respond | `NOT RUN` | |
| Static assets load | `NOT RUN` | |
| Old adult-only wording absent | `NOT RUN` | |
| Old jurisdiction wording absent | `NOT RUN` | |
| Consolidated consent present | `NOT RUN` | |
| Amended public instruments present | `NOT RUN` | |
| Anonymous upload fails closed | `NOT RUN` | |
| Anonymous extraction fails closed | `NOT RUN` | |
| Anonymous clinical-file access fails closed | `NOT RUN` | |
| No real account, email, payment or record access used | must be `yes` |

## I. Retain or rollback decision

**Decision:** `NOT MADE`<br>
**Decision-maker/reviewer:**<br>
**Time:**<br>
**Reason:**

If rollback occurred:

| Field | Evidence |
|---|---|
| Trigger | |
| Failed/suspect release and image | |
| Automatic or manual | |
| Rollback workflow run ID/URL | |
| Compatibility source SHA | |
| Requested rollback image | |
| Observed rollback release | |
| Observed rollback image | |
| Apex `/api/version` rollback SHA | `NOT VERIFIED` |
| Fly domain `/api/version` rollback SHA | `NOT VERIFIED` |
| Public smoke after rollback | `NOT RUN` |

## J. Registers and residual risks

| Item | Evidence |
|---|---|
| Workflow creation/amendment external action | |
| Rollback-image build/push external action | |
| Workflow dispatch external action | |
| Deployment external action | |
| Public smoke external action | |
| Rollback external action, if used | |
| Decision/risk register update | |
| Mission iteration/frontier update | |

Residual risks carried forward:

- Fly does not promise indefinite retention for unused registry images.
- Image rollback does not reverse database or file mutations.
- Single-machine/single-volume availability constraint remains.
- Authenticated production extraction is not tested unless an already authorised synthetic session exists.
- Under-age processing remains disabled unless independent ZDR evidence is later approved.
- Provider/model extraction error remains possible despite schema validation and human review.
- Main-line application reconciliation remains a separate post-verification action.
