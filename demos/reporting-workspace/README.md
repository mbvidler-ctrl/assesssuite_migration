# AssessSuite — reporting workflow demonstration workspace

A cloned, self-contained workspace that demonstrates the evidence-grounded
reporting workflow ("capture once, act, reassess, explain, report and learn")
without modifying the live application.

**Synthetic data only.** Every record in this workspace is invented. No real
patient, clinician, organisation or clinical event is represented. Rendered
documents carry a visible banner saying so.

**Not a deployment source.** Nothing here is wired into `apps/`, `server/`,
the Fly configuration or any release workflow. AI drafting is unavailable by
design: the named task fails closed and never fabricates a draft.

## What it demonstrates

1. A **Reports and outputs** list with status, owner, recipient, due date,
   overdue signal and requirement-based completeness (present, missing,
   unknown, not applicable — never a single percentage).
2. A **new report request** raised from an episode workspace: type, purpose,
   recipient, clinical questions, owner, due date, minimum evidence.
3. An **evidence and completeness panel** derived from the episode record,
   showing available evidence and explicit gaps with reasons.
4. A **sectioned editor**: facts sections generated deterministically from the
   pinned sources (read-only), clinician-authored narrative, and AI-assisted
   drafts that stay labelled and must be reviewed before approval; source
   chips on every section; an evidence drawer, a source manifest and a
   review panel one click away.
5. **Approve and snapshot**: an immutable document with content, document and
   manifest hashes, approver and time.
6. A **later source change** that never alters the draft or the snapshot: the
   workspace reports "new evidence available" and the clinician refreshes
   explicitly into a new revision with a recorded diff.
7. An **amendment** that produces a linked successor snapshot while the
   original stays on record, and a manually recorded delivery.

Screenshots of the deterministic browser run are in
`../../docs/reporting/walkthrough/`.

## Running it

Requires Node 24 and the repository's installed dependencies (`npm ci` at the
repository root). All commands run from this directory or with
`npm run --prefix demos/reporting-workspace <script>` from the root.

```
npm run demo:api          # API on http://127.0.0.1:8791 (seeds data/demo.sqlite on first start)
npm run demo:app          # Vite dev server on http://127.0.0.1:4301 (proxies /api to the API)
npm run demo:api:reset    # discard the local store and reseed
```

Or build once and let the API serve the built workspace:

```
npm run demo:build && npm run demo:api      # then open http://127.0.0.1:8791
```

Choose a demonstration identity on the first screen:

| Identity | Role | Can approve | Purpose |
|---|---|---|---|
| Synthetic Treating Physiotherapist | clinician | no | authors drafts; cannot approve |
| Synthetic Senior Physiotherapist | senior clinician | yes | approves and amends |
| Synthetic Practice Administrator | practice admin | no | raises requests, records delivery; cannot author |
| Synthetic Suspended Clinician | clinician (suspended) | no | shows the inactive-account refusal |
| Synthetic Clinician (other practice) | senior clinician | yes | shows organisation isolation |

## Suggested demonstration path

1. As the treating clinician, open the outputs list. Note the overdue request
   for Synthetic Patient B and the approved report for Synthetic Patient A.
2. Open Patient B's episode workspace. Read the evidence gaps, then request a
   progress report and assemble evidence; start the draft and observe the
   facts sections stating what is not recorded.
3. Open Patient A's referrer update (draft). Import the pinned AI-assisted
   draft into the clinical update section; note the attribution and the
   review requirement. Write the plan, save, mark the AI text reviewed,
   submit for review, and note that this identity cannot approve.
4. Switch to the senior clinician; approve. Open the approved document and
   the snapshot page.
5. Open Patient A's episode workspace and use a demonstration control to add
   a reassessment. Return to the approved report: it is unchanged. Open an
   amendment, observe "new evidence available", refresh, re-review, submit and
   approve. The snapshot chain shows the successor and the superseded
   original.
6. Try the "Draft with AI" button: the named task fails closed with an
   explicit unavailable state.

## Tests

```
npm run demo:test          # 32 deterministic node:test cases, no network, no provider
npm run demo:lint
npm run demo:walkthrough   # builds, then runs the Playwright walkthrough and writes screenshots
```

The tests cover completeness against two materially different fixtures,
SourceSet pinning and change detection, deterministic rendering, the request
state machine (immutability, explicit refresh, amendment chain, concurrency,
idempotency), admission for every identity, the closed AI task schema and the
fail-closed path, and the HTTP contract including organisation isolation.

## Layout

```
domain/     pure, deterministic modules (report types, evidence, source sets, rendering, workflow, admission, AI task)
server/     SQLite store mirroring the live shim's entity tables, service, HTTP surface, seed, start script
app/        Vite/React workspace reusing the live UI primitives by read-only alias
fixtures/   the synthetic dataset (two materially different episodes, five identities)
tests/      node:test suites
e2e/        Playwright walkthrough and its runtime
```

See `../../docs/reporting/20260906-report-output-workflow-adr.md` for the
design decisions and the path to coexistence with the live application.
