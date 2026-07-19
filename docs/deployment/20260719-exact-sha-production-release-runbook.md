# AssessSuite exact-SHA production release runbook

**Mission:** `UM-AUTO-20260719-ASSESSSUITE-REFERRAL-SIGNUP-RELEASE`<br>
**Production app:** `assesssuite-production`<br>
**Release mechanism:** trusted `workflow_dispatch` definitions on default branch `main`<br>
**Credential:** existing GitHub Actions secret `FLY_API_TOKEN`, value-blind
**Topology invariant:** Sydney, one machine, one mounted volume, `--strategy immediate`

## 1. Outcome and non-negotiable boundaries

The release path deploys an exact 40-character commit SHA whose remote source-branch tip matches the dispatch input. The workflow definition runs only from `main`, grants `contents: read`, uses a non-cancelling production concurrency group, and does not expose the Fly token to checkout, dependency installation, repository tests, local image builds, or any candidate-supplied script.

The workflow-only bootstrap does not reconcile stale `main` with the production application branch. Only the three workflow definitions in `.github/workflows/` belong in that bootstrap pull request. The Dockerfile metadata change, application code, tests, legal content and this runbook remain in the mission release pull request against `mission/20260716-live-remediation`.

Do not run local Fly commands with a credential. Do not retrieve, print, copy or replace `FLY_API_TOKEN`. Do not access production records, referral contents or secret values for release evidence.

## 2. Trust model

| Control | Enforcement |
|---|---|
| Manual only | `workflow_dispatch` is the sole trigger. |
| Trusted definition | Repository, actor, non-fork status, `refs/heads/main`, and exact `github.workflow_ref` are checked before checkout. |
| Read-only GitHub token | Top-level `permissions: contents: read`. |
| Exact application source | SHA must be lowercase 40-hex, checkout must equal it, and the named remote branch tip must equal it. |
| Secret isolation | All gates run in a job with no Fly secret. The final secret-bearing step contains only reviewed inline release logic and Fly/public-version commands; no repository script is executed there. |
| Supply-chain pinning | Checkout, Node setup and artifact-transfer actions use reviewed full commit SHAs; the official flyctl `0.4.71` archive is fixed by URL and verified against its reviewed SHA-256 digest before extraction; both Docker stages pin the reviewed Node 24 slim manifest digest. |
| Production serialization | All three workflows share concurrency group `assesssuite-production` with `cancel-in-progress: false`. |
| Image identity | Release SHA, source branch and UTC build time are baked into both Docker stages and the OCI revision/source/created labels. The tested candidate image is transferred between jobs, pushed once and deployed by its immutable registry digest. |
| Current-state guard | Dispatch records expected current release and image; the secret-bearing step compares them to Fly immediately before mutation. |
| Runtime identity | Both public production domains must return the candidate SHA byte-for-byte from `/api/version`. |
| Automatic recovery | Ambiguous deploy result, release mismatch or version mismatch deploys the pre-verified compatibility image and verifies its SHA. |
| Independent rollback | Manual rollback checks out only the reviewed rollback configuration SHA and deploys the prebuilt compatibility image. It does not check out or execute the failing image. |

The final deploy and rollback steps require multiple Fly calls because the activated order also requires a names-only production-secret preflight and recording the before/after Fly release identifiers. The credential is present only in that last sealed step, after every source and test gate, and no candidate code or repository script runs in it.

## 3. Provider-processing release gates

Document extraction is fail-closed independently of application deployment.

### 3.1 Adult health and sensitive data

The default dispatch is:

- `extraction_runtime_mode=disabled`;
- `provider_terms_attestation=EXTRACTION-DISABLED`; and
- `provider_terms_evidence_id=NOT-APPLICABLE-EXTRACTION-DISABLED`.

Adult referral extraction may be enabled only when all of the following are already true before dispatch:

1. the reviewed candidate `fly.production.toml` contains `DOCUMENT_EXTRACTION_ENABLED = "1"`;
2. the exact dispatch literal is `TERMS-VERIFIED-HEALTH-DATA-20260719`;
3. the non-secret evidence reference is exactly `EVD-20260719-ASSESSSUITE-OPENAI-HEALTH-TERMS-ATTESTATION`;
4. that evidence reference is recorded in the release manifest and capability intent; and
5. nobody requests, copies or records the contents of the account-specific arrangement.

The evidence ID is a durable attestation pointer, not permission to inspect or reproduce the arrangement.

### 3.2 Under-13 or otherwise age-restricted data

This is a separate gate. The default and current documented outcome is:

- `under_age_zdr_runtime_mode=disabled`;
- `under_age_zdr_attestation=UNDER-AGE-ZDR-DISABLED`; and
- `under_age_zdr_evidence_id=NOT-APPLICABLE-UNDER-AGE-ZDR-DISABLED`.

The candidate must leave `DOCUMENT_EXTRACTION_UNDER_13_ENABLED` absent or set to `"0"`. Enabling it requires an independently reviewed ZDR evidence ID and the exact workflow literal. Adult-health terms evidence does not satisfy this gate.

Both enablement keys must be reviewed non-secret configuration. If either name exists as an opaque Fly secret, the deployment workflow refuses to proceed because a secret value could override the exact-SHA config without review.

## 4. Required application contracts before bootstrap

Do not merge the workflow-only bootstrap until the release reviewer confirms:

1. `package.json` exposes `test:assurance` and it runs the complete mission-specific extraction and sign-up assurance matrix fail-closed;
2. the compatibility source exposes `test:rollback-compatibility` and proves the clinical gate accepts both the superseded and new legal-suite versions while document extraction remains disabled;
3. `/api/version` returns only non-sensitive JSON with exact keys `release_sha` and `build_timestamp`;
4. `Dockerfile` consumes `RELEASE_SHA`, `SOURCE_BRANCH` and `BUILD_TIMESTAMP` in both stages;
5. the candidate contains no release command or data migration that is irreversible by image rollback; and
6. the legal-version-compatible rollback source descends from the final hardened candidate, differs only by fail-closing document extraction and adding the exact `RC-2026.07.11,RC-2026.07.19` compatibility gate, and has an independently reviewed remote branch tip.

## 5. Workflow-only default-branch bootstrap

Perform this in a fresh worktree after independent workflow review. The commands below create reviewable local state; push, pull-request creation and merge remain separately logged external actions.

```powershell
git fetch origin main
git worktree add C:\Users\Maxwe\Projects\assesssuite_workflow_bootstrap_20260719 -b mission/20260719-workflow-bootstrap origin/main
Set-Location C:\Users\Maxwe\Projects\assesssuite_workflow_bootstrap_20260719
git checkout mission/20260719-referral-signup-release -- .github/workflows/production-deploy.yml .github/workflows/production-rollback.yml .github/workflows/production-prepare-rollback-image.yml
git status --short
git diff --check
git diff --name-only origin/main...HEAD
```

The final name list must contain only:

```text
.github/workflows/production-deploy.yml
.github/workflows/production-prepare-rollback-image.yml
.github/workflows/production-rollback.yml
```

Before merge:

1. confirm every `uses:` reference is a full 40-character reviewed SHA;
2. run a YAML and GitHub Actions semantic validator;
3. independently inspect every `${{ inputs.* }}` use for script injection;
4. confirm no `pull_request`, `pull_request_target`, `push`, `workflow_run` or `repository_dispatch` trigger exists;
5. confirm top-level permissions remain exactly `contents: read`;
6. confirm the pull request base is default branch `main` and contains workflow files only;
7. record the workflow-bootstrap pull request, reviewer and merge SHA in the external-action register; and
8. merge only under clause 8.2 of the activated mission order. Do not merge application code to `main`.

## 6. Credential and trusted-definition gate

The repository does not currently have a pre-protected production environment, so these workflows deliberately do not name or auto-create one. Trust is instead bounded by `workflow_dispatch` on the default branch, exact workflow-path/ref checks, exact source SHAs, read-only job permissions, non-cancelling serialization and the activated capability intent. Do not copy the existing repository `FLY_API_TOKEN` secret into documentation or a local environment.

If the repository secret is missing, invalid or insufficiently scoped, stop the deployment frontier. Do not broaden or replace the token under this runbook. Creating an environment later is a separately reviewable governance change and must not silently weaken this release corridor.

## 7. Prepare the compatibility rollback image

This must occur before the production candidate dispatch.

1. Record the compatibility branch name and exact remote tip SHA.
2. Record the superseded and new legal-suite version identifiers.
3. Create and evaluate a zero-transaction Workspace OS capability intent for GitHub Actions to build and push an image for `assesssuite-production` without deployment.
4. Dispatch only the trusted `main` definition:

```powershell
gh workflow run production-prepare-rollback-image.yml --ref main `
  -f rollback_source_sha=<40_HEX_COMPATIBILITY_SHA> `
  -f rollback_source_branch=<REMOTE_BRANCH> `
  -f superseded_legal_version=<OLD_VERSION> `
  -f new_legal_version=<NEW_VERSION> `
  -f capability_intent_id=<AUTHORISED_INTENT_ID> `
  -f authority_reference=UM-AUTO-20260719-ASSESSSUITE-REFERRAL-SIGNUP-RELEASE `
  -f confirmation='BUILD assesssuite-production COMPATIBILITY IMAGE ONLY'
```

The successful run summary records the immutable image as:

The workflow records both a human-readable tag and the immutable reference that must be supplied to the deploy/rollback workflows:

```text
registry.fly.io/assesssuite-production:rollback-compat-<40_HEX_COMPATIBILITY_SHA>
registry.fly.io/assesssuite-production@sha256:<64_HEX_DIGEST>
```

It builds and gates the image once, authenticates Docker to the Fly registry, pushes that exact local image and resolves its immutable digest. It does not deploy or alter the running Machine. Record the workflow run ID/URL, tag and digest reference. Fly does not promise indefinite retention for unused registry images, so build this immediately before the release window and retain the exact evidence.

## 8. Exact-SHA production preflight

Record all fields in the evidence template before dispatch:

- local fully gated SHA;
- remote mission-branch tip SHA;
- pull-request head SHA;
- current Fly release identifier and full image reference from the Fly dashboard or last verified live release evidence;
- compatibility source SHA/branch, immutable rollback image digest and `/api/version` rollback SHA;
- every gate result and independent review decision;
- provider-processing mode and evidence IDs only;
- authorised, `execution_ready` capability intent; and
- workflow bootstrap merge SHA on `main`.

The three candidate SHAs must be identical. If the expected current Fly release/image has changed, do not guess: refresh the evidence and capability intent. The workflow also checks the live current state and fails before deployment if it does not match.

## 9. Dispatch the exact candidate

The default, fail-closed extraction example is:

```powershell
gh workflow run production-deploy.yml --ref main `
  -f application_sha=<40_HEX_CANDIDATE_SHA> `
  -f source_branch=mission/20260719-referral-signup-release `
  -f expected_current_release=<FLY_RELEASE_ID> `
  -f expected_current_image=<FULL_CURRENT_IMAGE> `
  -f rollback_source_sha=<40_HEX_COMPATIBILITY_SHA> `
  -f rollback_source_branch=<COMPATIBILITY_BRANCH> `
  -f rollback_image=<FULL_COMPATIBILITY_IMAGE> `
  -f rollback_release_sha=<40_HEX_COMPATIBILITY_SHA> `
  -f extraction_runtime_mode=disabled `
  -f provider_terms_attestation=EXTRACTION-DISABLED `
  -f provider_terms_evidence_id=NOT-APPLICABLE-EXTRACTION-DISABLED `
  -f under_age_zdr_runtime_mode=disabled `
  -f under_age_zdr_attestation=UNDER-AGE-ZDR-DISABLED `
  -f under_age_zdr_evidence_id=NOT-APPLICABLE-UNDER-AGE-ZDR-DISABLED `
  -f capability_intent_id=<AUTHORISED_EXECUTION_READY_INTENT_ID> `
  -f authority_reference=UM-AUTO-20260719-ASSESSSUITE-REFERRAL-SIGNUP-RELEASE `
  -f confirmation='DEPLOY assesssuite-production EXACT SHA'
```

For adult-health extraction enablement, change only the three adult-health fields in accordance with section 3.1. Do not enable the under-age gate without its independent evidence.

The workflow:

1. validates dispatch provenance and inputs;
2. checks out the exact remote branch tip;
3. runs install, build, typecheck, lint containment, established suites, `test:assurance`, diff secret scan and one local labelled Docker build without the Fly token;
4. transfers that exact gated image to the sealed deploy job through a one-day, checksum-verified GitHub artifact and independently checks out the exact rollback config source;
5. performs a names-only production secret preflight in the final sealed step;
6. stages removal of legacy opaque legal-setting secrets by name only, pushes the restored gated image, resolves its registry digest and runs `fly deploy -c fly.production.toml --strategy immediate --ha=false --update-only --app assesssuite-production --image registry.fly.io/assesssuite-production@sha256:<digest>`;
7. records and compares prior and candidate release/image identifiers using immutable candidate/rollback digests;
8. verifies both production domains return the exact SHA from `/api/version`;
9. when adult extraction is enabled, runs the separately authorised real-provider probe inside the deployed machine using one synthetic PDF and one synthetic PNG, accepts only the exact value-blind PASS metadata contract and treats any probe failure as a verification failure; and
10. automatically deploys and verifies the compatibility image if the deploy result is ambiguous, either public version check fails or the enabled-mode provider probe fails.

The probe imports the production extraction adapter directly and keeps both synthetic fixtures in memory. Its reviewed import chain contains only `node:crypto` and `node:zlib`; it does not import the server, database, upload registry or filesystem APIs. Workflow output validation permits metadata keys only, requires two passing fixtures and zero database/filesystem writes, and does not print probe output. When adult extraction is disabled, the workflow records `SKIPPED-BY-DESIGN`; that result is safe for a disabled deployment but cannot close the extraction mission. Under-age test data remains prohibited unless the separate ZDR gate is satisfied.

## 10. Manual rollback

Use manual rollback for a retained release that later meets a stop condition. Do not use `fly releases rollback` because an unmodified prior image can reject users who accepted only the new legal version.

Create and approve a new rollback capability intent, then dispatch:

```powershell
gh workflow run production-rollback.yml --ref main `
  -f failed_application_sha=<40_HEX_FAILED_OR_SUSPECT_SHA> `
  -f expected_current_release=<CURRENT_FLY_RELEASE_ID> `
  -f expected_current_image=<FULL_CURRENT_IMAGE> `
  -f rollback_source_sha=<40_HEX_COMPATIBILITY_SHA> `
  -f rollback_source_branch=<COMPATIBILITY_BRANCH> `
  -f rollback_image=<FULL_COMPATIBILITY_IMAGE> `
  -f rollback_release_sha=<40_HEX_COMPATIBILITY_SHA> `
  -f capability_intent_id=<AUTHORISED_ROLLBACK_INTENT_ID> `
  -f authority_reference=UM-AUTO-20260719-ASSESSSUITE-REFERRAL-SIGNUP-RELEASE `
  -f incident_reference=<FAILED_RUN_OR_INCIDENT_ID> `
  -f confirmation='ROLLBACK assesssuite-production COMPATIBILITY IMAGE'
```

The workflow refuses to use a rollback config that enables document extraction, runs the same names-only feature-setting and required-secret preflight, and stages removal of legacy opaque legal-setting secrets before mutation. It deploys the supplied immutable image with `--ha=false --update-only` and the independently reviewed config, preserves the verified one-machine/one-volume topology, and verifies the rollback SHA on both production domains. Image rollback does not reverse database or file changes; this mission prohibits destructive or irreversible migrations.

## 11. Evidence and stop conditions

Copy the completed run summary into `20260719-release-evidence-template.md` and the mission work-product release record. Record workflow creation/amendment, image preparation, dispatch, deployment, public smoke and rollback as separate external actions. Never paste a raw secret, production record, provider payload, referral, decoded token, environment dump or complete Fly secret output.

Stop and seek direction if:

- any SHA, branch tip, current release or image does not match;
- a required package gate is absent or skipped;
- adult extraction is enabled but the safe value-blind real-provider probe has not passed;
- `DOCUMENT_EXTRACTION_ENABLED` or `DOCUMENT_EXTRACTION_UNDER_13_ENABLED` exists as an opaque Fly secret;
- the provider evidence gate is not satisfied for the requested runtime mode;
- the compatibility image is absent, unverified or not legal-version compatible;
- the Actions secret is invalid or insufficiently scoped;
- the GitHub environment requires unplanned interaction or account security challenge;
- the deployed or rollback SHA cannot be established; or
- rollback itself does not verify cleanly.

## 12. Primary technical sources

- [GitHub workflow_dispatch event](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_dispatch) — the workflow file must exist on the default branch for manual dispatch.
- [GitHub workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax) — permissions, inputs, concurrency and environments.
- [GitHub secure use reference](https://docs.github.com/en/actions/reference/security/secure-use) — least privilege, untrusted input and full-SHA action pinning.
- [Fly deploy reference](https://fly.io/docs/flyctl/deploy/) — `--strategy`, `--image`, `--image-label`, OCI labels, build arguments, `--build-only` and `--push`.
- [Fly releases reference](https://fly.io/docs/flyctl/releases/) — release and image evidence.
- [Fly rollback guide](https://fly.io/docs/blueprints/rollback-guide/) — rollback by deploying an explicit earlier image and the limits of image rollback.
- [Fly working with Docker](https://fly.io/docs/blueprints/working-with-docker/) — split build/push from later image deployment.
- [Fly private registry guide](https://fly.io/docs/blueprints/using-the-fly-docker-registry/) — immutable image references and retention caveat.
- [actions/checkout v7.0.0 commit](https://github.com/actions/checkout/commit/9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0), [actions/setup-node v7.0.0 commit](https://github.com/actions/setup-node/commit/820762786026740c76f36085b0efc47a31fe5020), [actions/upload-artifact v4.6.2 commit](https://github.com/actions/upload-artifact/commit/ea165f8d65b6e75b540449e92b4886f43607fa02), [actions/download-artifact v4.3.0 commit](https://github.com/actions/download-artifact/commit/d3f86a106a0bac45b974a628896c90dbdf5c8093), and [Fly setup action 1.6 commit](https://github.com/superfly/flyctl-actions/commit/ed8efb33836e8b2096c7fd3ba1c8afe303ebbff1) — reviewed action pins current on 19 July 2026.
