import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("dormant Core Assurance is fail-closed outside both routing and navigation", async () => {
  const [pages, layout, dormantPage] = await Promise.all([
    read("src/pages.config.js"),
    read("src/Layout.jsx"),
    read("src/pages/CoreAssurance.jsx"),
  ]);
  assert.doesNotMatch(pages, /import CoreAssurance from ['"]\.\/pages\/CoreAssurance['"]/);
  assert.doesNotMatch(pages, /["']CoreAssurance["']:\s*CoreAssurance/);
  assert.doesNotMatch(layout, /createPageUrl\(["']CoreAssurance["']\)/);
  assert.doesNotMatch(layout, />Core Assurance</);
  assert.match(dormantPage, /export default function CoreAssurance/);
  assert.match(dormantPage, /Availability contract pending/);
});

test("page independently gates admins and uses only the read-only assurance endpoint", async () => {
  const page = await read("src/pages/CoreAssurance.jsx");
  assert.match(page, /user\?\.role !== "admin"/);
  assert.match(page, /fetchCoreAssurance\(\{ orgId: selectedOrgId, limit: 100/);
  assert.match(page, /Read-only orchestration, review and runtime assurance metadata/);
  assert.doesNotMatch(page, /\b(?:create|update|delete|approve|reject|activate|deploy)Core/i);
  assert.doesNotMatch(page, /<Button\b/);
});

test("client uses a bounded same-origin-safe GET with token read at call time", async () => {
  const client = await read("src/api/coreClient.js");
  assert.match(client, /resolveCoreServerUrl\("\/api\/core\/v1\/admin\/assurance"\)/);
  assert.match(client, /url\.searchParams\.set\("org_id", orgId\.trim\(\)\)/);
  assert.match(client, /window\.localStorage\.getItem\("base44_access_token"\)/);
  assert.match(client, /Authorization: `Bearer \$\{sessionValue\}`/);
  assert.match(client, /method: "GET"/);
  assert.match(client, /Accept: "application\/json"/);
  assert.match(client, /setTimeout\(\(\) => controller\.abort\("timeout"\)/);
  assert.doesNotMatch(client, /searchParams\.set\([^\n]*(?:token|authorization)/i);
  assert.doesNotMatch(client, /console\.(?:log|error|warn)/);
});

test("response and UI are content-free and expose explicit operational states", async () => {
  const [client, page] = await Promise.all([read("src/api/coreClient.js"), read("src/pages/CoreAssurance.jsx")]);
  assert.match(client, /CORE_RESPONSE_CONTENT_FIELD_DENIED/);
  assert.match(client, /client_name\|content\|input\|output\|patient_name\|payload\|prompt\|query\|subject_name\|text/);
  for (const state of ["loading", "denied", "error", "idle", "unavailable", "ready", "empty"]) {
    assert.match(`${client}\n${page}`, new RegExp(`["']${state}["']`), `missing explicit ${state} state`);
  }
  assert.match(page, /No patient content, prompts or queries are shown/);
  assert.match(page, /Production disabled/);
  assert.match(page, /Core V1 sandbox/);
  assert.match(page, /Availability contract pending/);
  assert.doesNotMatch(page, /row\?\.(?:content|prompt|query|patient_name|client_name)/i);
});

test("bounded collection lengths are never presented as organisation totals", async () => {
  const [client, page] = await Promise.all([read("src/api/coreClient.js"), read("src/pages/CoreAssurance.jsx")]);
  assert.match(client, /windowLimit/);
  assert.match(client, /requestedLimit: safeLimit/);
  assert.match(page, /Response window limit/);
  assert.match(page, /\{assurance\.windowLimit\} per collection/);
  assert.match(page, /bounded recent response, not organisation-wide totals/);
  for (const label of ["Visible capabilities", "Visible configurations", "Recent runs shown", "Recent artifacts shown", "Recent reviews shown", "Recent jobs shown"]) {
    assert.match(page, new RegExp(`label=["']${label}["']`));
  }
  assert.doesNotMatch(page, /label=["'](?:Capabilities|Configurations|Runs|Artifacts|Reviews|Jobs)["']/);
});

test("non-empty repository summaries map to meaningful camelCase table cells", async () => {
  const page = await read("src/pages/CoreAssurance.jsx");
  const expected = {
    capabilities: ["capabilityKey", "state", "activeConfigVersionId", "updatedAt"],
    config_versions: ["configKey", "version", "state", "contentHash"],
    runs: ["runId", "purpose", "state", "createdAt"],
    artifacts: ["artifactId", "artifactType", "state", "updatedAt"],
    reviews: ["reviewId", "artifactId", "state", "createdAt"],
    jobs: ["jobId", "jobType", "state", "availableAt"],
  };
  const samples = {
    capabilities: { capabilityKey: "assessment_discovery", state: "sandbox_only", activeConfigVersionId: "cfg-1", updatedAt: "2026-08-08T00:00:00Z" },
    config_versions: { configKey: "assessment_discovery", version: "1", state: "validated", contentHash: "sha256:abc" },
    runs: { runId: "run-1", purpose: "assessment_discovery", state: "succeeded", createdAt: "2026-08-08T00:00:00Z" },
    artifacts: { artifactId: "artifact-1", artifactType: "assessment_recommendation", state: "draft", updatedAt: "2026-08-08T00:00:00Z" },
    reviews: { reviewId: "review-1", artifactId: "artifact-1", state: "pending", createdAt: "2026-08-08T00:00:00Z" },
    jobs: { jobId: "job-1", jobType: "synthetic_evaluation", state: "queued", availableAt: "2026-08-08T00:00:00Z" },
  };

  for (const [collection, fields] of Object.entries(expected)) {
    const definitionPattern = new RegExp(`key: ["']${collection}["'][^\\n]+columns: \\[${fields.map((field) => `\\[\\[?[^\\]]*["']${field}["']`).join("[\\s\\S]*")}[^\\n]+`);
    assert.match(page, definitionPattern, `${collection} table must use repository camelCase fields`);
    const renderedCells = fields.map((field) => samples[collection][field] ?? "—");
    assert.ok(renderedCells.every((value) => value !== "—"), `${collection} sample row must render meaningful cells`);
  }
  assert.match(page, /row\?\.\[definition\.idField\]/);
  assert.doesNotMatch(page, /(?:capability_key|active_config_version_id|config_key|created_at|artifact_type|artifact_id|job_type|available_at)/);
});
