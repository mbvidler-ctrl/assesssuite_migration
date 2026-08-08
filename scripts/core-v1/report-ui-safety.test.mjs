import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const wizardUrl = new URL("../../src/components/reports/UnifiedReportWizard.jsx", import.meta.url);
const editorUrl = new URL("../../src/components/reports/wizard-steps/SectionEditor.jsx", import.meta.url);

const [wizard, editor] = await Promise.all([
  readFile(wizardUrl, "utf8"),
  readFile(editorUrl, "utf8"),
]);

test("report section editing has no browser-owned generic generation path", () => {
  assert.doesNotMatch(editor, /InvokeLLM/);
  assert.doesNotMatch(editor, /JSON\.stringify\s*\(\s*client/i);
  assert.doesNotMatch(editor, /const\s+prompt\s*=/);
  assert.doesNotMatch(editor, /buildFullContext/);
  assert.match(editor, /no client context leaves this page/i);
});

test("legacy report persistence is explicitly draft-only", () => {
  assert.match(wizard, /status:\s*["']draft["']/);
  assert.doesNotMatch(wizard, /status:\s*["']final["']/);
  assert.match(wizard, /lifecycleState:\s*["']draft["']/);
  assert.match(wizard, /releaseEligible:\s*false/);
  assert.match(wizard, /purpose_specific_server_review_pending/);
  assert.match(wizard, /Export locked/);
  assert.doesNotMatch(wizard, /\.print\s*\(/);
});

test("compatibility layout and saved-report round-trip markers remain present", () => {
  for (const marker of [
    "base44.entities.SavedReport.create(payload)",
    "base44.entities.SavedReport.update(existingReport.id, payload)",
    "section_content: sectionContent",
    "active_sections: activeSections",
    "report_html: draftHtml",
    "data-assess-body",
    "class=\"outcome\"",
    "letterhead",
    "signoff",
    "footer",
    "LEGACY_REPORT_COMPATIBILITY_VERSION",
  ]) {
    assert.ok(wizard.includes(marker), `missing compatibility marker: ${marker}`);
  }
});

test("editing a released legacy report creates a new draft instead of overwriting it", () => {
  assert.match(wizard, /existingReport\.status\s*===\s*["']draft["']/);
  assert.match(wizard, /!hasImmutableCoreLineage/);
  assert.match(wizard, /lineageMode:\s*["']new_unapproved_legacy_draft["']/);
  assert.match(wizard, /sourceReportId:\s*existingReport\?\.id\s*\|\|\s*null/);
  assert.doesNotMatch(wizard, /\.\.\.\(existingReport\?\.core_metadata/);
});
