import test from "node:test";
import assert from "node:assert/strict";

import {
  createReportTemplateRegistry,
  listReportTemplates,
  resolveReportTemplate,
} from "../../src/lib/reports/core/templateRegistry.js";

test("resolves templates by stable key, legacy alias, and explicit coordinates", () => {
  const byKey = resolveReportTemplate({ templateKey: "dva.end-of-cycle.end-of-cycle.v1" });
  const byLegacy = resolveReportTemplate({ legacyReportType: "dva_end_cycle_report" });
  const byCoordinates = resolveReportTemplate({
    purpose: "end_of_cycle",
    funder: "DVA",
    horizon: "end-of-cycle",
  });

  assert.equal(byKey.key, "dva.end-of-cycle.end-of-cycle.v1");
  assert.deepEqual(byLegacy, byKey);
  assert.deepEqual(byCoordinates, byKey);
  assert.equal(byKey.legacyReportType, "DVA_END_OF_CYCLE_REPORT");
  assert.ok(byKey.sections.some((section) => section.outcomeTable));
});
test("does not silently substitute an unrelated funder template", () => {
  assert.throws(
    () => resolveReportTemplate({
      purpose: "progress_review",
      funder: "unknown_funder",
      horizon: "reporting_period",
    }),
    /No report template matches/
  );

  const explicitFallback = resolveReportTemplate({
    purpose: "progress_review",
    funder: "unknown_funder",
    horizon: "reporting_period",
    allowGeneralFallback: true,
  });
  assert.equal(explicitFallback.funder, "general");
});

test("registry snapshots are isolated from caller mutation", () => {
  const first = listReportTemplates();
  first[0].sections[0].heading = "mutated";
  const second = listReportTemplates();
  assert.notEqual(second[0].sections[0].heading, "mutated");
});

test("rejects ambiguous legacy aliases and coordinate collisions", () => {
  const base = {
    version: 1,
    title: "Synthetic Template",
    purpose: "custom",
    funder: "custom",
    horizon: "reporting_period",
    legacyReportType: "SYNTHETIC_CUSTOM",
    legacyAliases: ["synthetic_custom_alias"],
    sections: [{ key: "purpose", heading: "Purpose", required: true }],
  };
  assert.throws(
    () => createReportTemplateRegistry([
      { ...base, key: "synthetic.custom.period.v1" },
      { ...base, key: "synthetic.custom.period.v2", legacyReportType: "SYNTHETIC_CUSTOM_2" },
    ]),
    /Duplicate legacy report alias|Duplicate report-template coordinates/
  );
});
