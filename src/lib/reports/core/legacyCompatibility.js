import {
  REPORT_ARTIFACT_SCHEMA_VERSION,
  buildDeterministicExportInput,
  canonicalStringify,
  stableFingerprint,
} from "./reportCompositionEngine.js";

export const LEGACY_REPORT_COMPATIBILITY_VERSION = "assesssuite.legacy-report-compatibility.v1";
export const REPORT_RELEASE_BINDING_VERSION = "assesssuite.report-release-binding.v1";
export const OUTCOME_TABLE_SLOT_TEXT = "Outcome comparison table will be inserted here automatically.";
export const OUTCOME_TABLE_SLOT_HTML = `<p><em>${OUTCOME_TABLE_SLOT_TEXT}</em></p>`;

export const LEGACY_REPORT_COMPATIBILITY_CONTRACT = Object.freeze({
  version: LEGACY_REPORT_COMPATIBILITY_VERSION,
  supportedEntities: Object.freeze(["SavedReport", "ClientReport"]),
  preservedBlocks: Object.freeze(["document_preamble", "letterhead", "outcome_table", "signoff", "footer", "document_postamble"]),
  editableBlock: "prose_body",
  editableBodyAttribute: "data-assess-body",
  outcomeTableClass: "outcome",
  outcomeHeaderSignature: Object.freeze(["Assessment", "Baseline", "Most Recent", "Change", "Interpretation"]),
  savedHtmlFields: Object.freeze({ SavedReport: "report_html", ClientReport: "html_content" }),
});

function requireString(value, label, { allowEmpty = false } = {}) {
  if (typeof value !== "string") throw new TypeError(`${label} must be a string.`);
  if (!allowEmpty && value.length === 0) throw new TypeError(`${label} cannot be empty.`);
  return value;
}

function clonePlain(value) {
  if (Array.isArray(value)) return value.map(clonePlain);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clonePlain(item)]));
}

function uniqueSorted(values) {
  return Array.from(new Set((values || []).map((value) => String(value || "").trim()).filter(Boolean))).sort();
}

// Browser/server-stable SHA-256 for binding the exact compatibility render to
// an immutable, content-free release authorization receipt.
export function reportHtmlFingerprint(reportHtml) {
  const bytes = new TextEncoder().encode(requireString(reportHtml, "reportHtml"));
  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const bitLength = bytes.length * 8;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000), false);
  view.setUint32(paddedLength - 4, bitLength >>> 0, false);
  const constants = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  const hash = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const words = new Uint32Array(64);
  const rotateRight = (value, count) => (value >>> count) | (value << (32 - count));
  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let index = 0; index < 16; index += 1) words[index] = view.getUint32(offset + index * 4, false);
    for (let index = 16; index < 64; index += 1) {
      const s0 = rotateRight(words[index - 15], 7) ^ rotateRight(words[index - 15], 18) ^ (words[index - 15] >>> 3);
      const s1 = rotateRight(words[index - 2], 17) ^ rotateRight(words[index - 2], 19) ^ (words[index - 2] >>> 10);
      words[index] = (words[index - 16] + s0 + words[index - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = hash;
    for (let index = 0; index < 64; index += 1) {
      const sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choice = (e & f) ^ (~e & g);
      const temporary1 = (h + sum1 + choice + constants[index] + words[index]) >>> 0;
      const sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temporary2 = (temporary1 + sum0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temporary1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = temporary2;
    }
    hash[0] = (hash[0] + a) >>> 0;
    hash[1] = (hash[1] + b) >>> 0;
    hash[2] = (hash[2] + c) >>> 0;
    hash[3] = (hash[3] + d) >>> 0;
    hash[4] = (hash[4] + e) >>> 0;
    hash[5] = (hash[5] + f) >>> 0;
    hash[6] = (hash[6] + g) >>> 0;
    hash[7] = (hash[7] + h) >>> 0;
  }
  return `sha256:${hash.map((value) => value.toString(16).padStart(8, "0")).join("")}`;
}

function replaceOutcomeSlot(body, outcomeTableHtml) {
  const slotIndex = body.indexOf(OUTCOME_TABLE_SLOT_HTML);
  if (slotIndex >= 0) {
    return `${body.slice(0, slotIndex)}${outcomeTableHtml}${body.slice(slotIndex + OUTCOME_TABLE_SLOT_HTML.length)}`;
  }
  const textIndex = body.indexOf(OUTCOME_TABLE_SLOT_TEXT);
  if (textIndex >= 0) {
    return `${body.slice(0, textIndex)}${outcomeTableHtml}${body.slice(textIndex + OUTCOME_TABLE_SLOT_TEXT.length)}`;
  }
  return outcomeTableHtml ? `${body}${outcomeTableHtml}` : body;
}

// The envelope is the adapter seam for the current UnifiedReportWizard and
// ReviewExport components. Only editableBodyHtml may change during rich-text
// editing. Locked fragments are copied byte-for-byte on re-composition.
// Inputs must already have passed the application's safe-HTML pipeline; this
// compatibility adapter intentionally does not invent a second sanitizer.
/** @param {any} options */
export function createLegacyEditEnvelope(options = {}) {
  const {
    documentPreambleHtml,
    letterheadHtml,
    editableBodyHtml,
    outcomeTableHtml = "",
    signoffHtml = "",
    footerHtml,
    documentPostambleHtml,
  } = options;
  return {
    contractVersion: LEGACY_REPORT_COMPATIBILITY_VERSION,
    documentPreambleHtml: requireString(documentPreambleHtml, "documentPreambleHtml"),
    letterheadHtml: requireString(letterheadHtml, "letterheadHtml"),
    editableBodyHtml: requireString(editableBodyHtml, "editableBodyHtml", { allowEmpty: true }),
    outcomeTableHtml: requireString(outcomeTableHtml, "outcomeTableHtml", { allowEmpty: true }),
    signoffHtml: requireString(signoffHtml, "signoffHtml", { allowEmpty: true }),
    footerHtml: requireString(footerHtml, "footerHtml"),
    documentPostambleHtml: requireString(documentPostambleHtml, "documentPostambleHtml"),
  };
}

export function recomposeLegacyReportHtml(envelope, { editableBodyHtml = envelope?.editableBodyHtml } = {}) {
  if (!envelope || envelope.contractVersion !== LEGACY_REPORT_COMPATIBILITY_VERSION) {
    throw new TypeError("A Core V1 legacy edit envelope is required.");
  }
  const nextBody = requireString(editableBodyHtml, "editableBodyHtml", { allowEmpty: true });
  const bodyWithOutcome = replaceOutcomeSlot(nextBody, envelope.outcomeTableHtml);
  return [
    envelope.documentPreambleHtml,
    envelope.letterheadHtml,
    `<div data-assess-body>${bodyWithOutcome}</div>`,
    envelope.signoffHtml,
    envelope.footerHtml,
    envelope.documentPostambleHtml,
  ].join("");
}

function countExact(haystack, needle) {
  if (!needle) return 0;
  let count = 0;
  let offset = 0;
  while ((offset = haystack.indexOf(needle, offset)) >= 0) {
    count += 1;
    offset += needle.length;
  }
  return count;
}

export function inspectLegacyRenderCompatibility(reportHtml, envelope) {
  requireString(reportHtml, "reportHtml");
  if (!envelope || envelope.contractVersion !== LEGACY_REPORT_COMPATIBILITY_VERSION) {
    throw new TypeError("A Core V1 legacy edit envelope is required.");
  }
  const issues = [];
  const locked = [
    ["DOCUMENT_PREAMBLE_CHANGED", "document preamble", envelope.documentPreambleHtml],
    ["LETTERHEAD_CHANGED", "letterhead", envelope.letterheadHtml],
    ["SIGNOFF_CHANGED", "signoff", envelope.signoffHtml],
    ["FOOTER_CHANGED", "footer", envelope.footerHtml],
    ["DOCUMENT_POSTAMBLE_CHANGED", "document postamble", envelope.documentPostambleHtml],
  ];
  for (const [code, label, fragment] of locked) {
    if (fragment && !reportHtml.includes(fragment)) {
      issues.push({ code, severity: "blocker", message: `The locked ${label} fragment was not preserved.` });
    }
  }
  if (!reportHtml.includes("data-assess-body")) {
    issues.push({ code: "EDITABLE_BODY_MARKER_MISSING", severity: "blocker", message: "The rich-edit body marker is missing." });
  }
  if (envelope.outcomeTableHtml) {
    const tableCount = countExact(reportHtml, envelope.outcomeTableHtml);
    if (tableCount !== 1) {
      issues.push({
        code: "OUTCOME_TABLE_CARDINALITY",
        severity: "blocker",
        message: "The data-derived outcome table must be preserved exactly once.",
        details: { actual: tableCount, expected: 1 },
      });
    }
    const lowerTable = envelope.outcomeTableHtml.toLowerCase();
    const hasSignature = LEGACY_REPORT_COMPATIBILITY_CONTRACT.outcomeHeaderSignature.every((heading) =>
      lowerTable.includes(heading.toLowerCase())
    );
    if (!hasSignature || !/class=["'][^"']*\boutcome\b/i.test(envelope.outcomeTableHtml)) {
      issues.push({
        code: "OUTCOME_TABLE_SIGNATURE_INVALID",
        severity: "blocker",
        message: "The outcome table lacks the established class/header signature.",
      });
    }
  }
  return {
    status: issues.length === 0 ? "compatible" : "blocked",
    blockerCount: issues.length,
    issues,
  };
}

function defaultSectionContent(report) {
  return Object.fromEntries(report.sections.map((section) => [section.heading, section.body]));
}

function defaultActiveSections(report) {
  return report.sections
    .filter((section) => section.provided || section.body.trim() || section.outcomeTable)
    .map((section) => section.heading);
}

function inspectReleaseBinding(report, reportHtml, compatibility, releaseBinding, { clientId, orgId }) {
  const renderFingerprint = reportHtmlFingerprint(reportHtml);
  const issues = [];
  const reportSubjectKeys = report.subject && typeof report.subject === "object" && !Array.isArray(report.subject)
    ? Object.keys(report.subject).sort()
    : [];
  if (compatibility.status !== "compatible" || compatibility.blockerCount !== 0) {
    issues.push("legacy_render_incompatible");
  }
  if (
    canonicalStringify(reportSubjectKeys) !== canonicalStringify(["id", "type"])
    || report.subject.type !== "client"
    || report.subject.id !== clientId
  ) {
    issues.push("report_subject_client_mismatch");
  }
  if (!releaseBinding || releaseBinding.schemaVersion !== REPORT_RELEASE_BINDING_VERSION) {
    issues.push("release_binding_missing");
  } else {
    if (!buildDeterministicExportInput(report, { releaseBinding, orgId }).releaseEligible) {
      issues.push("core_release_binding_invalid");
    }
    if (releaseBinding.environment !== "production") issues.push("sandbox_or_unknown_environment");
    if (releaseBinding.artifactId !== report.artifactId) issues.push("artifact_id_mismatch");
    if (releaseBinding.orgId !== orgId) issues.push("tenant_binding_mismatch");
    if (
      releaseBinding.subjectType !== report.subject?.type
      || releaseBinding.subjectId !== report.subject?.id
    ) {
      issues.push("report_subject_binding_mismatch");
    }
    if (releaseBinding.subjectType !== "client" || releaseBinding.subjectId !== clientId) {
      issues.push("client_binding_mismatch");
    }
    if (releaseBinding.artifactState !== "approved") issues.push("artifact_not_approved");
    if (releaseBinding.contentFingerprint !== report.version.contentFingerprint) {
      issues.push("content_fingerprint_mismatch");
    }
    if (releaseBinding.reportHtmlFingerprint !== renderFingerprint) {
      issues.push("render_fingerprint_mismatch");
    }
    if (releaseBinding.compatibilityVersion !== LEGACY_REPORT_COMPATIBILITY_VERSION) {
      issues.push("compatibility_version_mismatch");
    }
    if (releaseBinding.releaseControlComplete !== true) issues.push("release_control_incomplete");
    if (releaseBinding.releaseEligible !== true) issues.push("release_not_eligible");
    if (releaseBinding.productionReleaseAuthority !== true) issues.push("production_authority_missing");
    if (
      !String(releaseBinding.orgId || "").trim()
      || !String(releaseBinding.subjectType || "").trim()
      || !String(releaseBinding.subjectId || "").trim()
      || !String(releaseBinding.authorActorId || "").trim()
      || !String(releaseBinding.reviewId || "").trim()
      || !String(releaseBinding.reviewerActorId || "").trim()
      || !String(releaseBinding.releaseAuthorizationEventId || "").trim()
      || !String(releaseBinding.releaseControllerActorId || "").trim()
    ) {
      issues.push("release_evidence_incomplete");
    }
    if (releaseBinding.authorActorId !== report.version.createdBy) {
      issues.push("author_actor_mismatch");
    }
    if (
      releaseBinding.reviewerActorId === releaseBinding.authorActorId
      || releaseBinding.releaseControllerActorId === releaseBinding.authorActorId
      || releaseBinding.releaseControllerActorId === releaseBinding.reviewerActorId
    ) {
      issues.push("release_role_separation_invalid");
    }
  }
  if (report.validation?.blockerCount !== 0 || report.validation?.status === "blocked") {
    issues.push("report_validation_blocked");
  }
  const { fingerprint: manifestFingerprint, ...manifestCore } = report.sourceManifest || {};
  const { fingerprint: ledgerFingerprint, ...ledgerCore } = report.claimLedger || {};
  const expectedContentFingerprint = stableFingerprint({
    subject: report.subject,
    template: { key: report.template?.key, version: report.template?.version },
    reportingPeriod: report.reportingPeriod,
    sourceManifestFingerprint: manifestFingerprint,
    sections: report.sections,
    claimLedgerFingerprint: ledgerFingerprint,
    versionNumber: report.version?.number,
  });
  if (
    stableFingerprint(manifestCore) !== manifestFingerprint
    || stableFingerprint(ledgerCore) !== ledgerFingerprint
    || expectedContentFingerprint !== report.version?.contentFingerprint
  ) {
    issues.push("report_fingerprint_invalid");
  }
  return {
    releaseEligible: issues.length === 0,
    renderFingerprint,
    issues: uniqueSorted(issues),
  };
}

// Additive bridge for the current schemaless Base44-compatible entities. It
// retains legacy field names while carrying the Core lineage in core_metadata.
// Drafts remain drafts. Only an exact production Core release binding plus a
// blocker-free compatibility render can map to the legacy "final" state; the
// report object's local lifecycle is review-readiness evidence only.
/** @param {any} report @param {any} options */
export function buildLegacySavedReportPayload(report, options = {}) {
  const {
    entity = "SavedReport",
    clientId,
    orgId,
    reportHtml,
    reportName = report?.template?.title,
    reportDate = report?.version?.composedAt?.slice(0, 10),
    sectionContent,
    activeSections,
    assessmentIds = [],
    editEnvelope = null,
    releaseBinding = null,
  } = options;
  if (!report || report.schemaVersion !== REPORT_ARTIFACT_SCHEMA_VERSION) {
    throw new TypeError("A Core V1 report artifact is required.");
  }
  if (!LEGACY_REPORT_COMPATIBILITY_CONTRACT.supportedEntities.includes(entity)) {
    throw new RangeError(`Unsupported legacy report entity ${entity}.`);
  }
  const resolvedClientId = String(clientId || "").trim();
  const resolvedOrgId = String(orgId || "").trim();
  if (!resolvedClientId || !resolvedOrgId) throw new TypeError("clientId and orgId are required.");
  requireString(reportHtml, "reportHtml");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(reportDate || ""))) {
    throw new TypeError("reportDate must use YYYY-MM-DD.");
  }

  const compatibility = editEnvelope
    ? inspectLegacyRenderCompatibility(reportHtml, editEnvelope)
    : {
        status: "blocked",
        blockerCount: 1,
        issues: [{
          code: "COMPATIBILITY_ENVELOPE_REQUIRED",
          severity: "blocker",
          message: "The exact locked legacy render envelope is required.",
        }],
      };
  const release = inspectReleaseBinding(
    report,
    reportHtml,
    compatibility,
    releaseBinding,
    { clientId: resolvedClientId, orgId: resolvedOrgId },
  );
  const payload = {
    client_id: resolvedClientId,
    org_id: resolvedOrgId,
    report_type: report.template.legacyReportType,
    report_name: String(reportName || report.template.title),
    report_date: reportDate,
    date_range_start: report.reportingPeriod.start,
    date_range_end: report.reportingPeriod.end,
    assessment_ids: uniqueSorted(assessmentIds),
    section_content: clonePlain(sectionContent || defaultSectionContent(report)),
    active_sections: clonePlain(activeSections || defaultActiveSections(report)),
    ai_assisted_sections: [],
    status: release.releaseEligible ? "final" : "draft",
    core_metadata: {
      schemaVersion: report.schemaVersion,
      artifactId: report.artifactId,
      subject: clonePlain(report.subject),
      templateKey: report.template.key,
      templateVersion: report.template.version,
      sourceCutoff: report.sourceCutoff,
      sourceManifestFingerprint: report.sourceManifest.fingerprint,
      sourceManifest: clonePlain(report.sourceManifest),
      claimLedgerFingerprint: report.claimLedger.fingerprint,
      claimLedger: clonePlain(report.claimLedger),
      lifecycleState: release.releaseEligible ? releaseBinding.artifactState : "draft",
      reportVersion: report.version.number,
      contentFingerprint: report.version.contentFingerprint,
      reportHtmlFingerprint: release.renderFingerprint,
      releaseEligible: release.releaseEligible,
      releaseControlComplete: releaseBinding?.releaseControlComplete === true,
      releaseBlockers: release.issues,
      compatibilityStatus: compatibility.status,
      compatibilityBlockerCount: compatibility.blockerCount,
      compatibilityVersion: LEGACY_REPORT_COMPATIBILITY_VERSION,
      releaseBinding: release.releaseEligible ? clonePlain(releaseBinding) : null,
    },
  };
  payload[LEGACY_REPORT_COMPATIBILITY_CONTRACT.savedHtmlFields[entity]] = reportHtml;
  return payload;
}

export function legacyPayloadFingerprint(payload) {
  return canonicalStringify(payload);
}
