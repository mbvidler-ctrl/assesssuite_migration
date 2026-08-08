import {
  REPORT_TEMPLATE_REGISTRY_VERSION,
  reportTemplateRegistry,
} from "./templateRegistry.js";

export const REPORT_ARTIFACT_SCHEMA_VERSION = "assesssuite.report-artifact.v1";
export const REPORT_COMPOSITION_ENGINE_VERSION = "1.0.0";
export const SOURCE_MANIFEST_SCHEMA_VERSION = "assesssuite.source-manifest.v1";
export const CLAIM_LEDGER_SCHEMA_VERSION = "assesssuite.claim-ledger.v1";

export const REPORT_LIFECYCLE_STATES = Object.freeze([
  "draft",
  "in_review",
  "approved",
  "rejected",
  "superseded",
  "withdrawn",
]);

const LIFECYCLE_TRANSITIONS = Object.freeze({
  draft: Object.freeze(["in_review", "withdrawn"]),
  in_review: Object.freeze(["draft", "approved", "rejected", "withdrawn"]),
  rejected: Object.freeze(["draft", "withdrawn"]),
  approved: Object.freeze(["superseded", "withdrawn"]),
  superseded: Object.freeze([]),
  withdrawn: Object.freeze([]),
});

function clonePlain(value) {
  if (Array.isArray(value)) return value.map(clonePlain);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clonePlain(item)]));
}

function canonicalise(value) {
  if (Array.isArray(value)) return value.map(canonicalise);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .filter((key) => value[key] !== undefined)
      .map((key) => [key, canonicalise(value[key])])
  );
}

export function canonicalStringify(value) {
  return JSON.stringify(canonicalise(value));
}

// Stable non-cryptographic identifier for deterministic composition and test
// comparison. It is deliberately labelled fnv1a32 and must not be treated as
// a content-integrity or signature primitive. Source integrity remains the
// responsibility of each source's contentDigest.
export function stableFingerprint(value) {
  const text = canonicalStringify(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `fnv1a32:${hash.toString(16).padStart(8, "0")}`;
}

function requireNonEmpty(value, label) {
  const normalised = String(value || "").trim();
  if (!normalised) throw new TypeError(`${label} is required.`);
  return normalised;
}

function normaliseInstant(value, label) {
  const raw = requireNonEmpty(value, label);
  if (!/^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/i.test(raw)) {
    throw new TypeError(`${label} must be an ISO 8601 timestamp with an explicit timezone.`);
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) throw new TypeError(`${label} is not a valid timestamp.`);
  return parsed.toISOString();
}

function normaliseTemporal(value) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const raw = String(value).trim();
  const expanded = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00.000Z` : raw;
  const parsed = new Date(expanded);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function normaliseDate(value, label) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const raw = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new TypeError(`${label} must use YYYY-MM-DD.`);
  const parsed = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== raw) {
    throw new TypeError(`${label} is not a valid date.`);
  }
  return raw;
}

function uniqueSorted(values) {
  return Array.from(new Set((values || []).map((value) => String(value || "").trim()).filter(Boolean))).sort();
}

function normaliseLocator(locator) {
  if (!locator || typeof locator !== "object" || Array.isArray(locator)) return null;
  const cloned = canonicalise(locator);
  return Object.keys(cloned).length > 0 ? cloned : null;
}

function laterTemporal(left, right) {
  if (!left) return right;
  if (!right) return left;
  return new Date(left).getTime() >= new Date(right).getTime() ? left : right;
}

function normaliseSource(source, cutoffInstant) {
  const sourceId = requireNonEmpty(source?.sourceId, "sourceId");
  const occurredAt = normaliseTemporal(source.occurredAt);
  const recordedAt = normaliseTemporal(source.recordedAt);
  // A historical event can be edited after the reporting cutoff. The current
  // row is not evidence of its pre-edit state, so the later event/record time
  // controls eligibility unless a versioned source store is introduced.
  const effectiveAt = laterTemporal(occurredAt, recordedAt);
  const base = {
    sourceId,
    kind: requireNonEmpty(source.kind, `Source ${sourceId} kind`),
    title: String(source.title || sourceId).trim(),
    occurredAt,
    recordedAt,
    effectiveAt,
    locator: normaliseLocator(source.locator),
    contentDigest: source.contentDigest ? String(source.contentDigest).trim() : null,
    sourceVersion: source.sourceVersion ? String(source.sourceVersion).trim() : null,
  };

  if (!effectiveAt) {
    return { included: false, exclusionReason: "missing_or_invalid_effective_at", source: base };
  }
  if (new Date(effectiveAt).getTime() > new Date(cutoffInstant).getTime()) {
    return { included: false, exclusionReason: "after_source_cutoff", source: base };
  }
  return { included: true, exclusionReason: null, source: base };
}

/** @param {any} options */
export function createSourceManifest(options = {}) {
  const { sourceCutoff, sources = [] } = options;
  const cutoff = normaliseInstant(sourceCutoff, "sourceCutoff");
  if (!Array.isArray(sources)) throw new TypeError("sources must be an array.");

  const seen = new Set();
  const included = [];
  const excluded = [];
  for (const rawSource of sources) {
    const result = normaliseSource(rawSource, cutoff);
    if (seen.has(result.source.sourceId)) throw new TypeError(`Duplicate sourceId ${result.source.sourceId}.`);
    seen.add(result.source.sourceId);
    if (result.included) included.push(result.source);
    else excluded.push({ ...result.source, exclusionReason: result.exclusionReason });
  }
  included.sort((left, right) => left.sourceId.localeCompare(right.sourceId));
  excluded.sort((left, right) => left.sourceId.localeCompare(right.sourceId));

  const manifestCore = {
    schemaVersion: SOURCE_MANIFEST_SCHEMA_VERSION,
    sourceCutoff: cutoff,
    included,
    excluded,
    counts: {
      supplied: sources.length,
      included: included.length,
      excluded: excluded.length,
    },
  };
  return { ...manifestCore, fingerprint: stableFingerprint(manifestCore) };
}

function normaliseSections(template, inputSections) {
  if (!Array.isArray(inputSections)) throw new TypeError("sections must be an array.");
  const provided = new Map();
  for (const rawSection of inputSections) {
    const sectionKey = requireNonEmpty(rawSection?.sectionKey || rawSection?.key, "sectionKey");
    if (provided.has(sectionKey)) throw new TypeError(`Duplicate sectionKey ${sectionKey}.`);
    provided.set(sectionKey, {
      sectionKey,
      heading: String(rawSection.heading || sectionKey).trim(),
      body: String(rawSection.body || ""),
      sourceIds: uniqueSorted(rawSection.sourceIds),
      provided: true,
    });
  }

  const output = template.sections.map((templateSection) => {
    const supplied = provided.get(templateSection.key);
    provided.delete(templateSection.key);
    return {
      sectionKey: templateSection.key,
      heading: templateSection.heading,
      body: supplied?.body || "",
      sourceIds: supplied?.sourceIds || [],
      required: templateSection.required,
      outcomeTable: templateSection.outcomeTable,
      provided: Boolean(supplied),
    };
  });

  const extras = Array.from(provided.values())
    .sort((left, right) => left.sectionKey.localeCompare(right.sectionKey))
    .map((item) => ({ ...item, required: false, outcomeTable: false }));
  return [...output, ...extras];
}

function normaliseClaims(claims) {
  if (!Array.isArray(claims)) throw new TypeError("claims must be an array.");
  const seen = new Set();
  return claims
    .map((rawClaim) => {
      const claimId = requireNonEmpty(rawClaim?.claimId, "claimId");
      if (seen.has(claimId)) throw new TypeError(`Duplicate claimId ${claimId}.`);
      seen.add(claimId);
      return {
        claimId,
        sectionKey: requireNonEmpty(rawClaim.sectionKey, `Claim ${claimId} sectionKey`),
        text: String(rawClaim.text || "").trim(),
        assertionType: String(rawClaim.assertionType || "factual").trim(),
        authoringMode: String(rawClaim.authoringMode || "human").trim(),
        requiresSource: rawClaim.requiresSource !== false,
        sourceIds: uniqueSorted(rawClaim.sourceIds),
        factKey: rawClaim.factKey ? String(rawClaim.factKey).trim() : null,
        factScope: rawClaim.factScope ? String(rawClaim.factScope).trim() : null,
        factValue: rawClaim.factValue === undefined ? null : canonicalise(rawClaim.factValue),
        contradictsClaimIds: uniqueSorted(rawClaim.contradictsClaimIds),
      };
    })
    .sort((left, right) => left.claimId.localeCompare(right.claimId));
}

function buildClaimLedger(claims, manifest) {
  const includedIds = new Set(manifest.included.map((source) => source.sourceId));
  const allClaimIds = new Set(claims.map((claim) => claim.claimId));
  const contradicted = new Set();
  const unknownContradictionTargets = new Map();

  for (const claim of claims) {
    const unknown = claim.contradictsClaimIds.filter((claimId) => !allClaimIds.has(claimId));
    if (unknown.length > 0) unknownContradictionTargets.set(claim.claimId, unknown);
    for (const targetId of claim.contradictsClaimIds) {
      if (allClaimIds.has(targetId)) {
        contradicted.add(claim.claimId);
        contradicted.add(targetId);
      }
    }
  }

  // Automatic contradiction detection is intentionally constrained to claims
  // carrying both a factKey and an explicit factScope. Time-varying clinical
  // facts must use different scopes, avoiding false conflict flags.
  const factGroups = new Map();
  for (const claim of claims) {
    if (!claim.factKey || !claim.factScope || claim.factValue === null) continue;
    const groupKey = `${claim.factScope}\u0000${claim.factKey}`;
    if (!factGroups.has(groupKey)) factGroups.set(groupKey, []);
    factGroups.get(groupKey).push(claim);
  }
  for (const group of factGroups.values()) {
    const values = new Set(group.map((claim) => canonicalStringify(claim.factValue)));
    if (values.size > 1) group.forEach((claim) => contradicted.add(claim.claimId));
  }

  const entries = claims.map((claim) => {
    const unresolvedSourceIds = claim.sourceIds.filter((sourceId) => !includedIds.has(sourceId));
    let validationStatus = "grounded";
    if (claim.requiresSource && (claim.sourceIds.length === 0 || unresolvedSourceIds.length > 0)) {
      validationStatus = "missing_source";
    } else if (contradicted.has(claim.claimId)) {
      validationStatus = "contradicted";
    } else if (!claim.requiresSource && claim.sourceIds.length === 0) {
      validationStatus = "author_statement";
    }
    return {
      ...claim,
      unresolvedSourceIds,
      unknownContradictionTargetIds: unknownContradictionTargets.get(claim.claimId) || [],
      validationStatus,
    };
  });

  const ledgerCore = {
    schemaVersion: CLAIM_LEDGER_SCHEMA_VERSION,
    entries,
    counts: {
      total: entries.length,
      grounded: entries.filter((entry) => entry.validationStatus === "grounded").length,
      missingSource: entries.filter((entry) => entry.validationStatus === "missing_source").length,
      contradicted: entries.filter((entry) => entry.validationStatus === "contradicted").length,
      authorStatement: entries.filter((entry) => entry.validationStatus === "author_statement").length,
    },
  };
  return { ...ledgerCore, fingerprint: stableFingerprint(ledgerCore) };
}

function issue(code, severity, message, details = {}) {
  return { code, severity, message, details: canonicalise(details) };
}

function validateComposition({ template, reportingPeriod, manifest, sections, claimLedger }) {
  const issues = [];
  const cutoffDate = manifest.sourceCutoff.slice(0, 10);

  if (["reporting_period", "end_of_cycle"].includes(template.horizon)) {
    if (!reportingPeriod.start || !reportingPeriod.end) {
      issues.push(issue("REPORTING_PERIOD_REQUIRED", "blocker", `${template.horizon} reports require start and end dates.`));
    }
  }
  if (reportingPeriod.start && reportingPeriod.end && reportingPeriod.start > reportingPeriod.end) {
    issues.push(issue("REPORTING_PERIOD_REVERSED", "blocker", "Reporting-period start is after its end."));
  }
  if (reportingPeriod.end && reportingPeriod.end > cutoffDate) {
    issues.push(issue("REPORTING_PERIOD_AFTER_CUTOFF", "blocker", "Reporting-period end is after the explicit source cutoff."));
  }

  const includedSourceIds = new Set(manifest.included.map((source) => source.sourceId));
  const sectionKeys = new Set(sections.map((sectionItem) => sectionItem.sectionKey));
  const claimSectionKeys = new Set(claimLedger.entries.map((claim) => claim.sectionKey));
  if (claimLedger.entries.length === 0) {
    issues.push(issue("CLAIM_LEDGER_EMPTY", "blocker", "A Core report must carry an explicit claim ledger."));
  }
  for (const sectionItem of sections) {
    if (sectionItem.required && !sectionItem.provided) {
      issues.push(issue("REQUIRED_SECTION_MISSING", "blocker", `Required section ${sectionItem.heading} was not supplied.`, {
        sectionKey: sectionItem.sectionKey,
      }));
    } else if (sectionItem.required && !sectionItem.body.trim() && !claimSectionKeys.has(sectionItem.sectionKey)) {
      issues.push(issue("REQUIRED_SECTION_EMPTY", "blocker", `Required section ${sectionItem.heading} is empty.`, {
        sectionKey: sectionItem.sectionKey,
      }));
    }
    const unresolvedSectionSources = sectionItem.sourceIds.filter((sourceId) => !includedSourceIds.has(sourceId));
    if (unresolvedSectionSources.length > 0) {
      issues.push(issue("SECTION_SOURCE_UNRESOLVED", "blocker", `Section ${sectionItem.heading} references unavailable sources.`, {
        sectionKey: sectionItem.sectionKey,
        sourceIds: unresolvedSectionSources,
      }));
    }
  }

  for (const claim of claimLedger.entries) {
    if (!sectionKeys.has(claim.sectionKey)) {
      issues.push(issue("CLAIM_SECTION_UNKNOWN", "blocker", `Claim ${claim.claimId} references an unknown section.`, {
        claimId: claim.claimId,
        sectionKey: claim.sectionKey,
      }));
    }
    if (!claim.text) {
      issues.push(issue("CLAIM_TEXT_EMPTY", "blocker", `Claim ${claim.claimId} has no text.`, { claimId: claim.claimId }));
    }
    if (claim.validationStatus === "missing_source") {
      issues.push(issue("CLAIM_SOURCE_MISSING", "blocker", `Claim ${claim.claimId} is not grounded in the included source manifest.`, {
        claimId: claim.claimId,
        unresolvedSourceIds: claim.unresolvedSourceIds,
      }));
    }
    if (claim.validationStatus === "contradicted") {
      issues.push(issue("CLAIM_CONTRADICTION", "blocker", `Claim ${claim.claimId} conflicts with another scoped claim.`, {
        claimId: claim.claimId,
      }));
    }
    if (claim.unknownContradictionTargetIds.length > 0) {
      issues.push(issue("CONTRADICTION_TARGET_UNKNOWN", "blocker", `Claim ${claim.claimId} names an unknown conflicting claim.`, {
        claimId: claim.claimId,
        targetClaimIds: claim.unknownContradictionTargetIds,
      }));
    }
  }

  for (const source of manifest.included) {
    if (!source.contentDigest) {
      issues.push(issue("SOURCE_DIGEST_MISSING", "warning", `Source ${source.sourceId} has no content digest.`, {
        sourceId: source.sourceId,
      }));
    }
    if (!source.locator) {
      issues.push(issue("SOURCE_LOCATOR_MISSING", "warning", `Source ${source.sourceId} has no durable locator.`, {
        sourceId: source.sourceId,
      }));
    }
  }
  for (const source of manifest.excluded) {
    issues.push(issue("SOURCE_EXCLUDED", "info", `Source ${source.sourceId} was excluded from the frozen manifest.`, {
      sourceId: source.sourceId,
      reason: source.exclusionReason,
    }));
  }

  issues.sort((left, right) => `${left.severity}|${left.code}|${canonicalStringify(left.details)}`.localeCompare(
    `${right.severity}|${right.code}|${canonicalStringify(right.details)}`
  ));
  return {
    status: issues.some((item) => item.severity === "blocker") ? "blocked" : "ready_for_review",
    blockerCount: issues.filter((item) => item.severity === "blocker").length,
    warningCount: issues.filter((item) => item.severity === "warning").length,
    infoCount: issues.filter((item) => item.severity === "info").length,
    issues,
  };
}

function normaliseReportingPeriod(reportingPeriod = {}) {
  return {
    start: normaliseDate(reportingPeriod.start, "reportingPeriod.start"),
    end: normaliseDate(reportingPeriod.end, "reportingPeriod.end"),
  };
}

function normaliseReportSubject(subject) {
  if (!subject || typeof subject !== "object" || Array.isArray(subject)) {
    throw new TypeError("subject must be an object.");
  }
  const keys = Object.keys(subject).sort();
  if (canonicalStringify(keys) !== canonicalStringify(["id", "type"])) {
    throw new TypeError("subject must contain exactly type and id.");
  }
  const type = requireNonEmpty(subject.type, "subject.type");
  const id = requireNonEmpty(subject.id, "subject.id");
  if (!/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/.test(type)) {
    throw new TypeError("subject.type must be a machine identifier.");
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(id)) {
    throw new TypeError("subject.id must be an opaque identifier.");
  }
  return { type, id };
}

function buildContentFingerprint({
  subject,
  template,
  reportingPeriod,
  sourceManifest,
  sections,
  claimLedger,
  versionNumber,
}) {
  return stableFingerprint({
    subject,
    template: { key: template.key, version: template.version },
    reportingPeriod,
    sourceManifestFingerprint: sourceManifest.fingerprint,
    sections,
    claimLedgerFingerprint: claimLedger.fingerprint,
    versionNumber,
  });
}

/** @param {any} options */
export function composeReportDraft(options = {}) {
  const {
    artifactId,
    subject,
    templateSelector,
    templateRegistry = reportTemplateRegistry,
    sourceCutoff,
    reportingPeriod = {},
    sources = [],
    sections = [],
    claims = [],
    generatedAt,
    createdBy,
    versionNumber = 1,
    supersedesArtifactId = null,
  } = options;
  if (!templateRegistry || typeof templateRegistry.resolve !== "function") {
    throw new TypeError("templateRegistry must expose resolve(selector).");
  }
  const template = templateRegistry.resolve(templateSelector);
  const reportSubject = normaliseReportSubject(subject);
  const composedAt = normaliseInstant(generatedAt, "generatedAt");
  const composerId = requireNonEmpty(createdBy, "createdBy");
  if (!Number.isInteger(versionNumber) || versionNumber < 1) {
    throw new TypeError("versionNumber must be a positive integer.");
  }
  const period = normaliseReportingPeriod(reportingPeriod);
  const sourceManifest = createSourceManifest({ sourceCutoff, sources });
  const normalisedSections = normaliseSections(template, sections);
  const claimLedger = buildClaimLedger(normaliseClaims(claims), sourceManifest);
  const validation = validateComposition({
    template,
    reportingPeriod: period,
    manifest: sourceManifest,
    sections: normalisedSections,
    claimLedger,
  });
  const contentFingerprint = buildContentFingerprint({
    subject: reportSubject,
    template,
    reportingPeriod: period,
    sourceManifest,
    sections: normalisedSections,
    claimLedger,
    versionNumber,
  });
  const resolvedArtifactId = artifactId
    ? requireNonEmpty(artifactId, "artifactId")
    : `report_${contentFingerprint.split(":")[1]}`;

  return {
    schemaVersion: REPORT_ARTIFACT_SCHEMA_VERSION,
    artifactType: "report",
    artifactId: resolvedArtifactId,
    subject: reportSubject,
    template: {
      registryVersion: templateRegistry.version || REPORT_TEMPLATE_REGISTRY_VERSION,
      key: template.key,
      version: template.version,
      title: template.title,
      purpose: template.purpose,
      funder: template.funder,
      horizon: template.horizon,
      legacyReportType: template.legacyReportType,
    },
    sourceCutoff: sourceManifest.sourceCutoff,
    reportingPeriod: period,
    sourceManifest,
    sections: normalisedSections,
    claimLedger,
    validation,
    lifecycle: {
      state: "draft",
      events: [{
        event: "composed",
        from: null,
        to: "draft",
        at: composedAt,
        actorId: composerId,
        reason: "Initial deterministic composition",
      }],
      reviews: [],
    },
    version: {
      number: versionNumber,
      composedAt,
      createdBy: composerId,
      supersedesArtifactId: supersedesArtifactId ? String(supersedesArtifactId).trim() : null,
      engineVersion: REPORT_COMPOSITION_ENGINE_VERSION,
      contentFingerprint,
    },
  };
}

function reviewEventId(report, transition) {
  return `review_${stableFingerprint({ artifactId: report.artifactId, ...transition }).split(":")[1]}`;
}

/** @param {any} report @param {any} options */
export function transitionReportLifecycle(report, options = {}) {
  const { to, at, actorId, actorRole, reason, reviewId } = options;
  if (!report || report.schemaVersion !== REPORT_ARTIFACT_SCHEMA_VERSION) {
    throw new TypeError("A Core V1 report artifact is required.");
  }
  const from = report.lifecycle?.state;
  const target = requireNonEmpty(to, "to");
  if (!REPORT_LIFECYCLE_STATES.includes(target)) throw new RangeError(`Unknown report lifecycle state ${target}.`);
  if (!(LIFECYCLE_TRANSITIONS[from] || []).includes(target)) {
    throw new RangeError(`Report lifecycle cannot transition from ${from} to ${target}.`);
  }
  if (target === "approved" && report.validation.blockerCount > 0) {
    throw new Error("A report with validation blockers cannot be approved.");
  }

  const transitionAt = normaliseInstant(at, "at");
  const transitionActor = requireNonEmpty(actorId, "actorId");
  const transitionReason = requireNonEmpty(reason, "reason");
  const role = String(actorRole || "").trim();
  if (["approved", "rejected"].includes(target) && !role) {
    throw new TypeError(`${target} transitions require actorRole.`);
  }

  const transition = {
    event: target === "in_review" ? "review_started" : "state_transition",
    from,
    to: target,
    at: transitionAt,
    actorId: transitionActor,
    actorRole: role || null,
    reason: transitionReason,
  };
  const reviews = clonePlain(report.lifecycle.reviews || []);
  if (["approved", "rejected"].includes(target)) {
    reviews.push({
      reviewId: reviewId ? requireNonEmpty(reviewId, "reviewId") : reviewEventId(report, transition),
      decision: target === "approved" ? "approve" : "reject",
      reviewedAt: transitionAt,
      reviewerId: transitionActor,
      reviewerRole: role,
      reason: transitionReason,
      contentFingerprint: report.version.contentFingerprint,
    });
  }

  return {
    ...clonePlain(report),
    lifecycle: {
      state: target,
      events: [...clonePlain(report.lifecycle.events || []), transition],
      reviews,
    },
  };
}

const CORE_RELEASE_BINDING_KEYS = Object.freeze([
  "artifactId",
  "artifactState",
  "artifactStateVersion",
  "authorActorId",
  "compatibilityVersion",
  "contentFingerprint",
  "contentHash",
  "environment",
  "orgId",
  "productionReleaseAuthority",
  "releaseAuthorizationEventId",
  "releaseControlComplete",
  "releaseControllerActorId",
  "releaseEligible",
  "reportHtmlFingerprint",
  "reviewId",
  "reviewerActorId",
  "schemaVersion",
  "subjectId",
  "subjectType",
]);

function reportFingerprintsAreIntact(report) {
  const { fingerprint: manifestFingerprint, ...manifestCore } = report.sourceManifest || {};
  const { fingerprint: ledgerFingerprint, ...ledgerCore } = report.claimLedger || {};
  if (
    stableFingerprint(manifestCore) !== manifestFingerprint
    || stableFingerprint(ledgerCore) !== ledgerFingerprint
  ) {
    return false;
  }
  return buildContentFingerprint({
    subject: report.subject,
    template: report.template,
    reportingPeriod: report.reportingPeriod,
    sourceManifest: report.sourceManifest,
    sections: report.sections,
    claimLedger: report.claimLedger,
    versionNumber: report.version?.number,
  }) === report.version?.contentFingerprint;
}

function isExactCoreReleaseBinding(report, releaseBinding, expectedOrgId) {
  if (!releaseBinding || typeof releaseBinding !== "object" || Array.isArray(releaseBinding)) return false;
  const actualKeys = Object.keys(releaseBinding).sort();
  if (canonicalStringify(actualKeys) !== canonicalStringify(CORE_RELEASE_BINDING_KEYS)) return false;
  const subjectKeys = report.subject && typeof report.subject === "object" && !Array.isArray(report.subject)
    ? Object.keys(report.subject).sort()
    : [];
  const ids = [
    releaseBinding.orgId,
    releaseBinding.subjectType,
    releaseBinding.subjectId,
    releaseBinding.authorActorId,
    releaseBinding.reviewId,
    releaseBinding.reviewerActorId,
    releaseBinding.releaseAuthorizationEventId,
    releaseBinding.releaseControllerActorId,
  ];
  return releaseBinding.schemaVersion === "assesssuite.report-release-binding.v1"
    && releaseBinding.environment === "production"
    && releaseBinding.artifactId === report.artifactId
    && typeof expectedOrgId === "string"
    && expectedOrgId.trim().length > 0
    && releaseBinding.orgId === expectedOrgId
    && canonicalStringify(subjectKeys) === canonicalStringify(["id", "type"])
    && releaseBinding.subjectType === report.subject?.type
    && releaseBinding.subjectId === report.subject?.id
    && releaseBinding.artifactState === "approved"
    && Number.isSafeInteger(releaseBinding.artifactStateVersion)
    && releaseBinding.artifactStateVersion >= 2
    && /^sha256:[a-f0-9]{64}$/.test(releaseBinding.contentHash || "")
    && releaseBinding.contentFingerprint === report.version.contentFingerprint
    && /^sha256:[a-f0-9]{64}$/.test(releaseBinding.reportHtmlFingerprint || "")
    && releaseBinding.compatibilityVersion === "assesssuite.legacy-report-compatibility.v1"
    && ids.every((value) => typeof value === "string" && value.trim().length > 0)
    && releaseBinding.authorActorId === report.version.createdBy
    && releaseBinding.reviewerActorId !== releaseBinding.authorActorId
    && releaseBinding.releaseControllerActorId !== releaseBinding.authorActorId
    && releaseBinding.releaseControllerActorId !== releaseBinding.reviewerActorId
    && releaseBinding.releaseControlComplete === true
    && releaseBinding.releaseEligible === true
    && releaseBinding.productionReleaseAuthority === true
    && report.validation.blockerCount === 0
    && report.validation.status !== "blocked"
    && reportFingerprintsAreIntact(report);
}

export function buildDeterministicExportInput(report, options = {}) {
  if (!report || report.schemaVersion !== REPORT_ARTIFACT_SCHEMA_VERSION) {
    throw new TypeError("A Core V1 report artifact is required.");
  }
  const releaseBinding = options?.releaseBinding ?? null;
  const expectedOrgId = options?.orgId ?? null;
  const reviewReady = report.lifecycle.state === "approved" && report.validation.blockerCount === 0;
  const releaseEligible = isExactCoreReleaseBinding(report, releaseBinding, expectedOrgId);
  return canonicalise({
    schemaVersion: "assesssuite.report-export-input.v1",
    artifactId: report.artifactId,
    reviewReady,
    releaseEligible,
    releaseAuthority: {
      source: "core_relational_release_binding",
      bindingStatus: releaseEligible ? "verified" : "required",
    },
    releaseBinding: releaseEligible ? releaseBinding : null,
    // Core relational state is the only release lifecycle authority. The
    // composition-local state is retained solely as review-readiness evidence.
    lifecycleState: releaseEligible ? releaseBinding.artifactState : "draft",
    reviewReadinessState: report.lifecycle.state,
    subject: report.subject,
    template: report.template,
    sourceCutoff: report.sourceCutoff,
    reportingPeriod: report.reportingPeriod,
    sourceManifest: report.sourceManifest,
    claimLedger: report.claimLedger,
    sections: report.sections,
    validation: report.validation,
    version: report.version,
    reviews: report.lifecycle.reviews,
    renderContract: {
      letterhead: "locked",
      proseBody: "editable",
      outcomeComparisonTable: "locked_data_derived",
      signoff: "locked",
      footer: "locked",
    },
  });
}
