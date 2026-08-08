import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const COMPONENT_URL = new URL("../../src/components/client/SavedReports.jsx", import.meta.url);
const componentSource = await readFile(COMPONENT_URL, "utf8");

function loadEligibilityPredicate() {
  const match = componentSource.match(
    /\/\* REPORT_RELEASE_ELIGIBILITY_START \*\/([\s\S]*?)\/\* REPORT_RELEASE_ELIGIBILITY_END \*\//,
  );
  assert.ok(match, "release eligibility contract must remain directly testable");

  const executable = match[1].replace("export function", "function");
  const context = vm.createContext({});
  vm.runInContext(`${executable}\nglobalThis.predicate = isReportReleaseEligible;`, context);
  return context.predicate;
}

const isReportReleaseEligible = loadEligibilityPredicate();

test("Core drafts and review-pending artifacts cannot print", () => {
  assert.equal(isReportReleaseEligible({
    status: "draft",
    core_metadata: { lifecycleState: "draft", releaseEligible: false },
  }), false);
  assert.equal(isReportReleaseEligible({
    status: "draft",
    core_metadata: { lifecycleState: "review_pending", releaseEligible: false },
  }), false);
  assert.equal(isReportReleaseEligible({
    status: "final",
    core_metadata: { lifecycleState: "review_pending", releaseEligible: true },
  }), false, "releaseEligible alone cannot bypass lifecycle approval");
});

test("even a structurally complete embedded Core receipt cannot authorise browser printing", () => {
  assert.equal(isReportReleaseEligible({
    status: "final",
    report_html: "<html><body>Released-looking content</body></html>",
    core_metadata: {
      lifecycleState: "approved",
      releaseEligible: true,
      releaseControlComplete: true,
      releaseBinding: {
        environment: "production",
        authorActorId: "author-1",
        reviewerActorId: "reviewer-1",
        releaseControllerActorId: "controller-1",
        productionReleaseAuthority: true,
      },
    },
  }), false, "current server state, including supersession, must be checked before Core printing");
});

test("legacy compatibility is explicit-final only and otherwise fail-closed", () => {
  assert.equal(isReportReleaseEligible({ status: "final" }), true);
  assert.equal(isReportReleaseEligible({ status: " FINAL " }), true);
  assert.equal(isReportReleaseEligible({ status: "draft" }), false);
  assert.equal(isReportReleaseEligible({ status: "approved" }), false);
  assert.equal(isReportReleaseEligible({}), false);
  assert.equal(isReportReleaseEligible(null), false);
});

test("malformed or ambiguous Core metadata cannot fall back to legacy eligibility", () => {
  assert.equal(isReportReleaseEligible({ status: "final", core_metadata: null }), false);
  assert.equal(isReportReleaseEligible({ status: "final", core_metadata: "approved" }), false);
  assert.equal(isReportReleaseEligible({
    status: "final",
    coreMetadata: { releaseEligible: true },
  }), false, "camel-only schemaless metadata is still Core-bearing and stays locked");
  assert.equal(isReportReleaseEligible({
    status: "final",
    core_metadata: {},
    coreMetadata: {},
  }), false, "dual metadata representations stay locked");
});

test("every SavedReports print entry point is gated and the handler fails before opening a window", () => {
  assert.match(componentSource, /if \(!isReportReleaseEligible\(report\)\) \{[\s\S]*?return;[\s\S]*?\}\s*const html/);
  assert.match(componentSource, /disabled=\{!releaseEligible\}/);
  assert.match(componentSource, /disabled=\{!isReportReleaseEligible\(viewingReport\)\}/);

  const guardIndex = componentSource.indexOf("if (!isReportReleaseEligible(report))");
  const openIndex = componentSource.indexOf("window.open('', '_blank')");
  assert.ok(guardIndex >= 0 && openIndex > guardIndex, "release guard must run before window.open");
});
