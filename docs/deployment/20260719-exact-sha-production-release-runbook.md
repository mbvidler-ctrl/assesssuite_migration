# AssessSuite R2 exact-SHA production release runbook

**Mission:** `UM-AUTO-20260721-ASSESSSUITE-REFERRAL-RECOVERY-R2`<br>
**Parent campaign:** `UM-CAMPAIGN-20260720-ASSESSSUITE-REFERRAL-ASSURANCE`<br>
**Repository:** `mbvidler-ctrl/assesssuite_migration`<br>
**Production app:** `assesssuite-production`<br>
**Production region and topology:** `syd`; exactly one Machine and one attached, encrypted 3 GB volume named `assesssuite_data`<br>
**Release corridor:** reviewed `workflow_dispatch` definitions at the exact remote `main` SHA<br>
**Credential boundary:** existing GitHub Actions secret `FLY_API_TOKEN`; value-blind and available only to sealed workflow steps

This runbook supersedes the release architecture previously recorded in this file. It does not itself claim that a release, rollback, restore drill or parity wave has completed.

## 1. Required outcome and boundaries

R2 has one release unit: application code, policy surfaces, tests, production configuration, rollback configuration and trusted workflows reviewed together in one pull request and merged to `main`. Let the resulting exact 40-character remote `main` SHA be `C`.

Both deployable runtime modes derive from `C`:

- the candidate image uses `fly.production.toml`; and
- the compatibility image uses `fly.rollback.production.toml`, which preserves the compatible application/schema behavior but disables adult and under-age document extraction.

The compatibility source is the same merged `main` revision, not a separately maintained ref. `application_sha`, `trusted_workflow_sha`, `rollback_source_sha` and `rollback_release_sha` must all equal `C`; `source_branch` and `rollback_source_branch` must both equal `main`. The immutable image digests and the SHA-256 hashes of the two Fly configuration blobs distinguish the enabled candidate from the extraction-disabled compatibility runtime.

Production mutations are permitted only through the reviewed workflow definitions on `main`:

- `.github/workflows/production-prepare-rollback-image.yml`;
- `.github/workflows/production-deploy.yml`;
- `.github/workflows/production-rollback.yml`; and
- `.github/workflows/production-parity-assurance.yml`.

Do not run a local `fly deploy`, `fly machine run`, volume mutation, secret mutation or registry push. Do not retrieve, print, copy, replace or otherwise expose `FLY_API_TOKEN` or any production secret value. Release evidence may contain approved secret names, immutable identifiers and content-free counts only.

Do not inspect or mutate production clinical records, referral contents, uploaded-document contents, sessions, cookies or production-volume contents. The deploy canaries use isolated temporary paths and synthetic fixtures. The parity waves use a separate mission-owned volume and never attach or read `assesssuite_data`.

## 2. Trust and provenance model

| Control | Required proof |
|---|---|
| One reviewed release unit | One bounded integration branch and one pull request contain both application and workflow changes. |
| Immutable default-branch source | Remote `main`, `github.sha`, `github.workflow_sha`, checked-out application SHA and both runtime source SHAs equal `C`. |
| Trusted definitions | Every workflow dispatch uses `--ref main`; the workflow path/ref, repository, actor, non-fork status and remote `main` tip are checked before source execution. |
| Read-only GitHub token | Workflow permissions remain least privilege; only parity receipt chaining additionally requires `actions: read`. |
| Secret isolation | Source, install, tests, scans and local image gates run without `FLY_API_TOKEN`. Only reviewed inline sealed steps receive it. Candidate code is never executed with that token. |
| Supply-chain pins | Every third-party action, Node runtime, Fly CLI archive and Docker base image remains pinned to the reviewed immutable identity. |
| Exact configuration | The LF-byte SHA-256 values of `fly.production.toml` and `fly.rollback.production.toml` at `C` match the dispatch inputs and workflow checks. |
| Immutable images | Candidate and compatibility images are built from `C`, pushed once, resolved to `registry.fly.io/assesssuite-production@sha256:<64-hex>`, and thereafter selected only by digest. |
| Current-state lock | Immediately refreshed release, image, Machine ID and volume ID must match the dispatch inputs immediately before each mutation. |
| Topology lock | Exactly one production Machine in `syd` is attached to the exact encrypted 3 GB `assesssuite_data` volume. No second production Machine or production volume is accepted. |
| Snapshot lock | Scheduled snapshots and five-day retention are re-established and re-read on the exact production volume; deploy additionally creates and proves one new on-demand predeployment snapshot. |
| Runtime identity | Both `https://assesssuite.com/api/version` and `https://assesssuite-production.fly.dev/api/version` return `C` after candidate deployment or compatibility rollback. |
| Automatic recovery | Any ambiguous deploy, topology, snapshot, public-surface, provider-probe or canary result invokes the preverified compatibility image and verifies it by immutable digest and `C`. |
| One effect per parity dispatch | Each parity infrastructure/use/cleanup effect has its own broker intent, workflow run and content-free receipt chained to its predecessor. |

All production-affecting workflow runs share concurrency group `assesssuite-production` with `cancel-in-progress: false`.

## 3. Assemble and review the single release unit

The sole remotely published integration branch is:

```text
mission/20260721-assesssuite-referral-recovery-r2
```

Create it from the then-current `origin/main`. Integrate the locally reviewed application and workflow commits into it without losing either diff. Internal preparation commits may remain local; publish only the named integration ref.

Before push, prove:

1. the integration branch descends from the currently verified production/main lineage;
2. its complete tree contains the final application and all four trusted workflow definitions;
3. the complete combined diff, including workflow code, has received application, security/privacy, tenant/persistence, signup/referral, dependency/output-boundary and release-mechanics review;
4. no unrelated change, secret-bearing file, generated credential or production data is present;
5. all required application and workflow gates in section 4 pass from a clean checkout; and
6. the pull request base is `main` and there is exactly one R2 release pull request.

Push, pull-request creation and pull-request merge are separate external effects. Each requires its own schema-valid, authorised, `execution_ready` capability intent, `started` record before the effect, exactly one external mutation and one terminal `completed` or `failed` result.

After merge, refresh `origin/main`, set `C` to that exact tip and prove that the merged tree is byte-for-byte the reviewed integration tree. A squash merge is acceptable only when the tree equality proof passes. Do not dispatch any production workflow until the remote `main` tip is still `C`.

## 4. Candidate and workflow assurance gates

Run the final gate set from a clean checkout of the release unit and repeat the proportionate set after any fix:

```powershell
npm.cmd ci
npm.cmd audit --audit-level=moderate
npm.cmd run test:assurance
npm.cmd run test:referral-browser
npm.cmd run test:forward-rollback-compatibility
npm.cmd run selftest
npm.cmd run build
npm.cmd run lint
npm.cmd run typecheck
git diff --check
```

The repository's raw typecheck may contain inherited baseline findings. A raw non-zero result is not waived: run the reviewed differential typecheck against the exact production baseline and require zero candidate-owned regressions. Record both results.

Validate every trusted workflow in ordinary and mutation-test modes:

```powershell
$workflows = @(
  '.github/workflows/production-deploy.yml',
  '.github/workflows/production-prepare-rollback-image.yml',
  '.github/workflows/production-rollback.yml',
  '.github/workflows/production-parity-assurance.yml'
)
foreach ($workflow in $workflows) {
  node scripts/validate-production-deploy-workflow.mjs $workflow
  node scripts/validate-production-deploy-workflow.mjs $workflow --selftest
}
```

Also require:

- the release diff scanner and a value-blind high-entropy/secret scan to pass;
- no moderate-or-higher production dependency advisory;
- exact forward-write/compatibility-read behavior under both runtime configurations;
- production startup to be `node server/productionBootstrap.mjs && exec node server/index.mjs`, with no production execution of the general synthetic seed;
- the real document-extraction adapter to remain fail-closed, tenant-authorised and review-before-commit;
- the production output boundary and all HTML sinks to remain sanitised;
- signup to present one mandatory consolidated acceptance and one default-off optional marketing choice, with no adult-only, paediatric exclusion, state/territory/jurisdiction or pre-payment DOB control; and
- independent review findings to be closed or expressly recorded as non-blocking residual risk.

## 5. Freeze exact identities after merge

Immediately after `C` is established, create the frozen-input manifest. Hash Git blob bytes, not a working copy whose line endings may differ. This value-blind Node command prints SHA-256 and path only:

```powershell
$env:RELEASE_SHA = $C
node --input-type=module -e 'import {createHash} from "node:crypto"; import {execFileSync} from "node:child_process"; const files=["fly.production.toml","fly.rollback.production.toml","Dockerfile","scripts/validate-production-deploy-workflow.mjs","scripts/scan-release-diff.mjs","server/tests/provider-probe.mjs","scripts/referral-production-canary.mjs","scripts/referral-production-canary-contract.mjs","scripts/validate-referral-production-canary-output.mjs","server/tests/production-parity-wave.mjs","server/tests/support/syntheticReferralFixtures.mjs","server/tests/production-parity-cleanup.mjs"]; for (const file of files) { const bytes=execFileSync("git",["show",`${process.env.RELEASE_SHA}:${file}`]); console.log(`${createHash("sha256").update(bytes).digest("hex")}  ${file}`); }'
Remove-Item Env:RELEASE_SHA
```

Record at minimum:

- `C` and its tree ID;
- the integration tip and tree-equality result;
- the exact blob SHA-256 for candidate config, rollback config, Dockerfile, validator, scanner, provider probe, referral canary and all three parity driver/fixture/cleanup files;
- the exact workflow Git blob IDs and the complete workflow validation/mutation results;
- the candidate and compatibility immutable image digests when produced;
- the immediately refreshed current Fly release/image, sole Machine ID and sole volume ID;
- the production volume's region, size, encryption, attachment, scheduled-snapshot flag and retention;
- provider-processing mode and non-secret evidence IDs;
- the common frozen-input manifest SHA-256; and
- the distinct broker intent, evidence and idempotency identifiers for every external effect.

If remote `main`, a frozen blob, a workflow definition, the production release/image or the topology changes, invalidate the affected intent and refresh the entire dependent identity chain. Never guess or reuse stale values.

## 6. Provider-processing gates

Adult sensitive-health referral extraction is enabled only when all of these exact conditions are true:

- `fly.production.toml` at `C` contains `DOCUMENT_EXTRACTION_ENABLED = "1"`;
- dispatch input `extraction_runtime_mode` is `enabled`;
- `provider_terms_attestation` is `TERMS-VERIFIED-HEALTH-DATA-20260719`;
- `provider_terms_evidence_id` is `EVD-20260719-ASSESSSUITE-OPENAI-HEALTH-TERMS-ATTESTATION`; and
- the evidence reference is recorded without retrieving, reproducing or inferring the underlying account arrangement.

Under-age extraction remains separately disabled:

- `DOCUMENT_EXTRACTION_UNDER_13_ENABLED = "0"`;
- `under_age_zdr_runtime_mode=disabled`;
- `under_age_zdr_attestation=UNDER-AGE-ZDR-DISABLED`; and
- `under_age_zdr_evidence_id=NOT-APPLICABLE-UNDER-AGE-ZDR-DISABLED`.

The workflow refuses opaque Fly secret overrides of reviewed feature configuration. A secret-name check is permitted; a secret-value dump is not.

## 7. Refresh production state before every release mutation

Use value-blind, read-only evidence to refresh and record:

1. the exact current Fly release identifier and full immutable image reference;
2. the exact sole production Machine ID, region, image and state;
3. the exact sole `assesssuite_data` volume ID, 3 GB size, `syd` region, encryption state and attachment to that Machine;
4. scheduled snapshots enabled with retention exactly five days;
5. required production secret names present and forbidden opaque configuration names absent; and
6. both public version endpoints and public legal/settings surfaces.

These values become `expected_current_release`, `expected_current_image`, `expected_machine_id` and `expected_volume_id`. Refresh them again immediately before the rollback-image build, candidate deployment, any rollback and each parity effect. Drift is a stop condition, not a reason to alter the expected input until the drift is understood and the intent is reissued.

## 8. Build the extraction-disabled compatibility image first

Dispatch only the workflow definition at `C` on `main`:

```powershell
gh workflow run production-prepare-rollback-image.yml --ref main `
  -f trusted_workflow_sha=$C `
  -f rollback_source_sha=$C `
  -f rollback_config_sha256=$RollbackConfigSha256 `
  -f expected_current_release=$CurrentRelease `
  -f expected_current_image=$CurrentImage `
  -f expected_machine_id=$ProductionMachineId `
  -f expected_volume_id=$ProductionVolumeId `
  -f rollback_source_branch=main `
  -f superseded_legal_version=RC-2026.07.11 `
  -f new_legal_version=RC-2026.07.19 `
  -f capability_intent_id=$PrepareIntentId `
  -f authority_reference=UM-AUTO-20260721-ASSESSSUITE-REFERRAL-RECOVERY-R2 `
  -f confirmation='PREPARE assesssuite-production COMPATIBILITY IMAGE AND VOLUME POLICY'
```

The workflow must:

- check out `C` and prove the remote `main` tip is still `C`;
- verify the rollback-config LF-byte hash and extraction-disabled settings;
- run build, differential typecheck, selftest, compatibility and forward/rollback proof gates;
- prove the exact one-Machine/one-volume topology;
- enforce and re-read scheduled snapshots and five-day retention on the existing production volume;
- push the gated compatibility image without deploying it;
- resolve and report exactly one immutable compatibility image digest; and
- prove that the current production release and image did not change.

Record the workflow run ID/URL, config hash, image tag, immutable digest, topology and unchanged-release proof. Do not proceed unless the digest can be independently inspected and is available for immediate rollback.

## 9. Deploy the exact merged candidate

Create and start the distinct deploy capability/effect intents, then dispatch:

```powershell
gh workflow run production-deploy.yml --ref main `
  -f trusted_workflow_sha=$C `
  -f application_sha=$C `
  -f candidate_config_sha256=$CandidateConfigSha256 `
  -f rollback_config_sha256=$RollbackConfigSha256 `
  -f source_branch=main `
  -f expected_current_release=$CurrentRelease `
  -f expected_current_image=$CurrentImage `
  -f expected_machine_id=$ProductionMachineId `
  -f expected_volume_id=$ProductionVolumeId `
  -f rollback_source_sha=$C `
  -f rollback_source_branch=main `
  -f rollback_image=$CompatibilityImageDigest `
  -f rollback_release_sha=$C `
  -f extraction_runtime_mode=enabled `
  -f provider_terms_attestation=TERMS-VERIFIED-HEALTH-DATA-20260719 `
  -f provider_terms_evidence_id=EVD-20260719-ASSESSSUITE-OPENAI-HEALTH-TERMS-ATTESTATION `
  -f under_age_zdr_runtime_mode=disabled `
  -f under_age_zdr_attestation=UNDER-AGE-ZDR-DISABLED `
  -f under_age_zdr_evidence_id=NOT-APPLICABLE-UNDER-AGE-ZDR-DISABLED `
  -f capability_intent_id=$DeployIntentId `
  -f authority_reference=UM-AUTO-20260721-ASSESSSUITE-REFERRAL-RECOVERY-R2 `
  -f confirmation='DEPLOY assesssuite-production EXACT SHA'
```

The sealed workflow must refuse mutation unless it proves all frozen identities and current-state guards. Before deployment it must create exactly one new on-demand snapshot and record content-free evidence comprising the snapshot ID, digest, source volume ID, creation count and UTC timestamp. The snapshot must bind to the exact encrypted production volume; no unsupported per-snapshot encryption claim is required.

The workflow then pushes the already gated candidate image, resolves its immutable digest and deploys that digest with the reviewed candidate configuration using immediate, single-Machine update semantics. It must preserve the exact production volume and topology.

Enabled extraction cannot close on deterministic tests alone. Require both:

1. the full-schema real-provider probe to report exact 39-field policy, differential, full-field and multi-file results, exactly seven real provider requests, and zero database/filesystem writes; and
2. the isolated installed-SDK referral canary to use the repository-generated synthetic referral PDF, exercise upload, extraction, mandatory review and reviewed persistence against temporary database/upload paths, and report zero production database/upload writes and zero external email sends.

The workflow output firewall must accept only the reviewed content-free receipt contracts. Provider payloads, extracted referral data and fixture contents must not enter logs or evidence.

After success, independently verify:

- both public `/api/version` endpoints return `C`;
- the Fly current release and image equal the workflow's reported candidate release and immutable candidate digest;
- the sole production Machine runs that digest in `syd` and remains attached to the original exact production volume;
- the encrypted 3 GB volume and five-day scheduled-snapshot policy are unchanged;
- the expected public login/settings/legal surfaces load; and
- the compatibility digest remains available.

Any ambiguous mutation, failed provider probe/canary, public mismatch, topology drift or snapshot failure must trigger the workflow's compatibility rollback. Do not count an automatically rolled-back run as a successful deployment.

## 10. Two consecutive fresh production-parity waves

Parity runs in app `assesssuite-production` but is isolated from the live estate by all of these fixed controls:

- namespace `asr-r2-20260721`;
- hidden Machine `asr-r2-parity-20260721` in `syd`, with no public service/DNS registration and a hard lifetime bound;
- separate encrypted 3 GB volume `asr_r2_parity_data` mounted at `/app/server/data`;
- database `/app/server/data/assesssuite-parity.db`;
- uploads `/app/server/data/assesssuite-parity-uploads`;
- immutable live candidate image digest;
- `ALLOW_OPEN_REGISTRATION=0`, outbound email/SMS/payments disabled, under-age extraction disabled and provider-call limit one;
- exactly one synthetic user and one synthetic referral document per wave; and
- browser execution on the Actions runner through a selector-specific private proxy, never on the production Machine.

The parity Machine must never select or attach the production Machine or volume IDs. Production records, production uploads and the production volume are not opened, queried, copied or used for comparison.

### 10.1 One-effect dispatch contract

Use one `production-parity-assurance.yml` dispatch per action in this exact order:

1. `volume-create`;
2. `machine-create` (including synthetic seed and seed verification);
3. `provider-wave`;
4. `namespace-cleanup`;
5. `machine-delete`; and
6. `volume-delete`.

Every action receives a unique authorised effect intent and evidence ID. Record `started` before the dispatch. Supply the exact prior workflow run ID and SHA-256 of its content-free receipt. Wave 1 begins from `mission-genesis`; wave 2 begins from the verified wave-1 `volume-delete` receipt. The exact parity Machine/volume/private IPv6 values are `NOT-CREATED` until created and thereafter come only from the preceding verified receipt.

The dispatch form is:

```powershell
gh workflow run production-parity-assurance.yml --ref main `
  -f trusted_workflow_sha=$C `
  -f application_sha=$C `
  -f action=$Action `
  -f wave_id=$WaveId `
  -f expected_live_release=$LiveRelease `
  -f live_image=$LiveCandidateImageDigest `
  -f candidate_config_sha256=$CandidateConfigSha256 `
  -f parity_runner_sha256=$ParityRunnerSha256 `
  -f parity_fixture_sha256=$ParityFixtureSha256 `
  -f parity_cleanup_sha256=$ParityCleanupSha256 `
  -f parity_namespace=asr-r2-20260721 `
  -f expected_production_machine_id=$ProductionMachineId `
  -f expected_production_volume_id=$ProductionVolumeId `
  -f parity_machine_id=$ParityMachineId `
  -f parity_volume_id=$ParityVolumeId `
  -f parity_private_ipv6=$ParityPrivateIpv6 `
  -f predecessor_action=$PredecessorAction `
  -f predecessor_run_id=$PredecessorRunId `
  -f predecessor_receipt_sha256=$PredecessorReceiptSha256 `
  -f effect_intent_id=$EffectIntentId `
  -f effect_evidence_id=$EffectEvidenceId `
  -f authority_reference=UM-AUTO-20260721-ASSESSSUITE-REFERRAL-RECOVERY-R2 `
  -f confirmation="EXECUTE assesssuite-production PARITY $Action" `
  -f cleanup_chain_ack=CLEANUP-CHAIN-REQUIRED-AFTER-EVERY-WAVE-RESULT
```

After each run, download and validate only the bounded receipt/artifact set. Update the external-action register immediately, then terminally complete or fail that exact effect before starting its successor.

### 10.2 Clean-wave acceptance

The `provider-wave` must exercise the real post-payment synthetic-user UI:

- profile setup and consolidated legal acceptance;
- exactly one mandatory checkbox and one default-off optional marketing checkbox;
- all required notice links;
- no adult-only, paediatric exclusion, state/territory/jurisdiction or DOB control;
- one acceptance submission plus an idempotent retry with no duplicate receipts;
- referral uploader in the single-practice form for wave 1 and multi-practice form for wave 2;
- exactly one actual OpenAI extraction request for one synthetic PDF;
- mandatory review presented; and
- cancellation before referral commit, leaving zero clinical writes and zero created client records.

The machine-local observation must report exactly one provider request, zero email/SMS/payment attempts, zero clinical writes, exact signup receipt counts and zero production-volume-path accesses. Evidence is limited to the reviewed JSON receipts and three bounded synthetic screenshots: signup consent, referral uploader and mandatory review. Do not retain browser storage, cookies, tokens, traces, network bodies or provider output.

Independently review the bounded screenshots in two lanes: a directed reviewer checks the expected signup/referral contracts, while a blinded synthetic-user reviewer receives the screenshots without the expected outcome and reports usability defects or unexpected friction. These reviews cause no additional provider call and must contain no credential, token or production content. A blocking finding activates remediation and resets the clean-wave count.

A wave is not clean until cleanup reports zero remaining namespace rows/files, zero non-namespace objects touched and zero clinical rows deleted, followed by verified deletion of the parity Machine and volume. Re-read the app inventory and require:

- only the original production Machine and production volume remain;
- zero mission-labelled parity Machines;
- zero mission-labelled parity volumes; and
- zero retained namespace state or synthetic artefacts.

The next wave may reuse the fixed labels only after that terminal-absence proof. It must create a new encrypted volume and a new Machine; no state or resource may survive between waves.

If any wave finds a defect, produces an ambiguous provider outcome, crosses a data boundary or fails cleanup, finish the bounded cleanup chain, diagnose and remediate through a new reviewed `main` release, reset the clean-wave count to zero and repeat. Mission completion requires two consecutive clean fresh waves against the same verified live revision, followed by a final public canary/topology check.

## 11. Manual compatibility rollback

Use the manual workflow for a later verified stop condition. The rollback changes image/config only; it never restores or rewinds the production volume.

```powershell
gh workflow run production-rollback.yml --ref main `
  -f trusted_workflow_sha=$C `
  -f failed_application_sha=$C `
  -f expected_current_release=$CurrentRelease `
  -f expected_current_image=$CurrentImage `
  -f expected_machine_id=$ProductionMachineId `
  -f expected_volume_id=$ProductionVolumeId `
  -f rollback_source_sha=$C `
  -f rollback_source_branch=main `
  -f rollback_config_sha256=$RollbackConfigSha256 `
  -f rollback_image=$CompatibilityImageDigest `
  -f rollback_release_sha=$C `
  -f capability_intent_id=$RollbackIntentId `
  -f authority_reference=UM-AUTO-20260721-ASSESSSUITE-REFERRAL-RECOVERY-R2 `
  -f incident_reference=$IncidentReference `
  -f confirmation='ROLLBACK assesssuite-production COMPATIBILITY IMAGE'
```

Require exact current-state and topology guards, exact same-main config provenance, extraction disabled for adult and under-age data, immutable digest deployment, unchanged production volume and `C` from both public version endpoints. Do not use `fly releases rollback`: an earlier application image may not preserve the current legal, upload-lifecycle or receipt compatibility contracts.

## 12. Snapshot restore is separate and off-traffic

The release workflow creates and proves a recovery point, but it does not test or guarantee that an application restore will succeed. A snapshot restore requires separate incident authority and must never be attached over the live volume or exposed to production traffic during inspection.

1. Select the exact snapshot by immutable identifier and record the incident authority and source-volume evidence.
2. Restore it to a new, separately named encrypted volume in Sydney. Do not detach, overwrite or mutate the live production volume.
3. Attach the restored volume only to an isolated replacement Machine running the exact reviewed recovery image, with public traffic disabled.
4. Obtain an authoritative, content-free lifecycle delta covering the interval from the selected snapshot to the then-current live estate from a separately authorised read-only live query or a durable off-volume ledger. The delta may contain only opaque identifiers and more-restrictive lifecycle facts: deletion, expiry, quarantine, provider block and disposition state. If the delta is missing, incomplete or cannot be bound to the snapshot timestamp and source volume, traffic promotion is prohibited.
5. Replay only those more-restrictive lifecycle facts into the isolated restored copy. A restore operation must never revive ordinary access, remove a quarantine/provider block, extend an expiry or weaken a disposition on the basis of older snapshot state.
6. Start the server so its startup reconciliation removes or tombstones interrupted `registering` uploads, denies expired/deleted/quarantined uploads, and schedules eligible physical cleanup. Do not browse or export referral contents as evidence.
7. Run content-free SQLite integrity, upload-registry/disposition, legal-version and release-provenance checks. Require zero unresolved `registering` rows, zero unregistered application-managed upload artefacts, zero registry/file integrity mismatches and exact provider-block consistency. Any unresolved registration, expiry, binding, deletion or physical-file state is a stop condition.
8. A separate authorised traffic-switch decision may replace production only after the isolated checks pass and a rollback point for the then-current live volume remains preserved.

Restored snapshots can contain bytes whose live-volume copy was later deleted. They therefore remain administrative recovery material, not ordinary application-accessible storage, and must pass both the post-snapshot delta replay and lifecycle reconciliation before traffic. No completed independent restore drill or durable off-volume lifecycle ledger is represented by this release; those remain separately reviewable resilience controls.

## 13. Evidence, stop conditions and completion

For every external effect, record its frozen inputs, intent/decision/result IDs, idempotency key, workflow or GitHub run ID/URL, start/end times, immutable SHA/hash/digest, content-free outcome and targeted reconciliation. Never record raw secrets, tokens, environment dumps, production records, referral contents, provider payloads or browser storage.

Stop the affected action and reconcile before continuing if:

- any SHA, blob hash, workflow identity, immutable image digest or remote tip differs;
- the current release/image/Machine/volume or snapshot policy differs from the frozen guard;
- a required test, independent review, dependency scan, workflow validator or mutation test is absent, skipped or fails;
- the compatibility image is absent, mutable, unavailable or not extraction-disabled;
- the actual provider probe, installed-SDK canary or public verification is not an exact PASS;
- a secret value could be exposed, candidate source could execute with the Fly credential, or an opaque feature-setting secret overrides reviewed configuration;
- parity can select the production Machine/volume, exceeds one provider request, attempts communication/payment, writes clinical state or fails zero-residue cleanup;
- a workflow result is ambiguous or a broker attempt remains unresolved; or
- automatic or manual rollback cannot be verified.

R2 is complete only when the same exact `C` and immutable candidate digest are live on both public domains, all release/provider/canary/topology/snapshot gates pass, the extraction-disabled compatibility digest remains available, two consecutive fresh parity waves are clean, no temporary parity resources remain and the evidence register contains no unresolved release blocker.

## 14. Primary technical references

- [GitHub `workflow_dispatch`](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_dispatch)
- [GitHub Actions workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)
- [GitHub Actions secure use reference](https://docs.github.com/en/actions/reference/security/secure-use)
- [Fly deploy reference](https://fly.io/docs/flyctl/deploy/)
- [Fly Machines overview](https://fly.io/docs/machines/overview/)
- [Fly Volumes overview](https://fly.io/docs/volumes/overview/)
- [Fly rollback guide](https://fly.io/docs/blueprints/rollback-guide/)
- [Fly private registry guide](https://fly.io/docs/blueprints/using-the-fly-docker-registry/)
