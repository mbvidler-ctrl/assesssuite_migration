# Error telemetry plan — detecting the next capability outage in minutes, not days

**Prepared for:** Maxwell Vidler (Principal Solutions Architect and Technical Lead, AssessSuite Engagement)
**Date:** 29 July 2026
**Status:** plan — awaiting the one manual input marked below. No code in this document is active.

## Why

The 21–28 July clinical-AI outage produced a continuous stream of HTTP 503 responses from a single endpoint for roughly seven days, and nothing observed it: the production app has no error telemetry, no log-based alerting, and no external check on any AI surface (see `docs/qa/20260728-clinical-ai-outage-incident-report.md`, §4). Any one of the three layers below would have surfaced the outage on day zero.

## Layer 1 — Server-side error telemetry (Sentry, free tier)

The server is a zero-dependency `node:http` process, and it should stay that way — so the recommendation is Sentry's **store endpoint via plain HTTPS POST**, not the SDK:

- Add a ~40-line `server/telemetry.mjs` that, when `SENTRY_DSN` is set, posts a minimal event envelope for (a) any 5xx response, (b) any unhandled rejection/exception, with route, status, and a stable error class — **never request bodies, never patient data** (reuse the de-identification discipline in `server/llm.mjs`).
- Sampling: 503-storm coalescing (one event per route per minute with a counter), so an outage is one alert, not a flood.
- Alert rule in Sentry: >20 5xx events on `/integration-endpoints/*` within 10 minutes → email.
- Rollout: config-only via Fly secret `SENTRY_DSN`; absent DSN = telemetry disabled, zero behaviour change. Registered in the flag/secret manifest so the change is visible to the impact gate.

**Manual input needed from you (5 minutes):** create a free Sentry account/project (platform: Node.js), copy the DSN, and either hand it to the implementation session or set it yourself later via the guarded corridor (`fly secrets set SENTRY_DSN=…` is refused for forbidden-override variables; `SENTRY_DSN` should be added as an *allowed* opaque secret since it is not behaviour-gating). Until then, Layer 2 needs no account at all.

## Layer 2 — Fly log-based alerting (no new accounts)

- `fly logs` already carries every 5xx line. Fly.io's Grafana (fly-metrics.net, included with the account) can alert on `fly_app_http_responses_count{status=~"5.."}`.
- Recommended alert: 5xx rate > 1/min sustained 15 min → email to mb.vidler@gmail.com.
- **Manual input needed:** one-time alert rule creation in the Fly Grafana UI (~10 minutes, click-path documented in the runbook when you're ready). No code change at all.

## Layer 3 — Capability posture canary (in-repo, no accounts)

- Extend the existing loopback canary (`scripts/referral-production-canary.mjs` pattern) with an **InvokeLLM posture probe**: inside the release image, boot the isolated loopback server with the *production* flag values and assert each capability in `server/capabilityFlags.mjs` responds according to the manifest (enabled → 200-class, disabled → clean 503 with the honest message). Emits a content-free JSON verdict.
- Wire it as a step in `production-deploy.yml`'s post-deploy verification (workflow change — goes through the validator re-pin procedure; prepared but not applied until you approve a corridor change).
- This is the layer that turns "the manifest says X" into "the deployed image actually does X" on every release.

## Order of value

Layer 2 today (zero code), Layer 1 this week (one account), Layer 3 with the next corridor change. Any one of them independently ends the "silent for seven days" failure mode.
