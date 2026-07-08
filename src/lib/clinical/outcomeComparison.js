// I2 / Launch Gate G9: deterministic baseline-vs-current outcome comparison.
//
// Shapes a client's completed ClientAssessment records (already enriched with
// the catalogue name / unit / normative_direction) into per-instrument
// comparison rows: baseline score and date (earliest completed), most recent
// score and date, absolute change, and a direction-aware interpretation.
// Two rules, consistent with generateInterpretation.js and the workspace
// fabrication prohibition:
//
//  1. Every number is computed strictly from stored result values. Nothing is
//     invented, extrapolated, or smoothed.
//  2. "Improved" / "Declined" is asserted ONLY where the catalogue records a
//     direction of benefit (normative_direction: higher_better | lower_better).
//     Where the direction is unknown the change is stated neutrally
//     ("Score increased" / "Score decreased") with no clinical meaning attached.
//
// One data-shaping function (buildOutcomeComparison) feeds both surfaces:
// the wizard's inline <OutcomeTable/> component and the HTML-string serialiser
// (outcomeComparisonHtml) embedded into saved report_html.

import { format } from "date-fns";

function toFiniteNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function formatDate(raw) {
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return format(parsed, "dd/MM/yyyy");
}

function normaliseDirection(direction) {
  if (direction === "higher_better" || direction === "lower_better") return direction;
  return "neutral";
}

// Round for display/comparison so float noise never asserts a change.
function round2(value) {
  return Math.round(value * 100) / 100;
}

export function formatScore(value) {
  if (!Number.isFinite(value)) return "";
  return String(round2(value));
}

export function formatChange(change, unit = "") {
  if (!Number.isFinite(change)) return "";
  const sign = change > 0 ? "+" : "";
  return `${sign}${formatScore(change)}${unit ? ` ${unit}` : ""}`;
}

// Interpretation of a (display-rounded) change under a direction of benefit.
// tone: "good" | "bad" | "neutral" | "unknown" — a rendering hint only.
function interpretChange(change, direction) {
  if (change === 0) return { label: "No change", tone: "neutral" };
  if (direction === "neutral") {
    return change > 0
      ? { label: "Score increased", tone: "unknown" }
      : { label: "Score decreased", tone: "unknown" };
  }
  const improved = direction === "higher_better" ? change > 0 : change < 0;
  return improved
    ? { label: "Improved", tone: "good" }
    : { label: "Declined", tone: "bad" };
}

export const SINGLE_POINT_LABEL = "Baseline only — no comparison available";

// Group completed assessments by instrument and derive one comparison row per
// instrument. Records without a finite numeric result_value (e.g. SOAP-text
// only entries) are excluded — they carry nothing to compare numerically.
// Returns [] for empty / absent input (degrade silently).
export function buildOutcomeComparison(assessments) {
  const source = Array.isArray(assessments) ? assessments : [];
  const groups = new Map();

  for (const record of source) {
    if (!record) continue;
    const value = toFiniteNumber(record.result_value);
    if (value === null) continue;
    const dateRaw = record.assessment_date || record.created_date || null;
    const time = dateRaw ? new Date(dateRaw).getTime() : NaN;
    const name = (record.name || "").trim();
    const key = record.assessment_id || name.toLowerCase() || record.id;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({
      record,
      value,
      dateRaw,
      time: Number.isFinite(time) ? time : 0,
    });
  }

  const rows = [];
  for (const [key, entries] of groups.entries()) {
    entries.sort((a, b) => a.time - b.time);
    const baseline = entries[0];
    const latest = entries[entries.length - 1];
    const named = entries.find((e) => e.record.name) || baseline;
    const withUnit = entries.find((e) => e.record.unit_of_measure);
    const withDirection = entries.find((e) => e.record.normative_direction);
    const unit = withUnit ? withUnit.record.unit_of_measure : "";
    const direction = normaliseDirection(withDirection?.record.normative_direction);

    const base = {
      key,
      name: named.record.name || "Unknown assessment",
      unit,
      direction,
      count: entries.length,
      baselineValue: baseline.value,
      baselineDate: formatDate(baseline.dateRaw),
    };

    if (entries.length < 2) {
      rows.push({
        ...base,
        hasComparison: false,
        latestValue: null,
        latestDate: null,
        change: null,
        interpretation: { label: SINGLE_POINT_LABEL, tone: "single" },
      });
    } else {
      const change = round2(latest.value - baseline.value);
      rows.push({
        ...base,
        hasComparison: true,
        latestValue: latest.value,
        latestDate: formatDate(latest.dateRaw),
        change,
        interpretation: interpretChange(change, direction),
      });
    }
  }

  rows.sort((a, b) => a.name.localeCompare(b.name));
  return rows;
}

export const OUTCOME_DIRECTION_NOTE =
  "Change is interpreted against each measure's recorded direction of benefit; where no direction is recorded, the change in score is stated without clinical interpretation.";

const esc = (t) =>
  String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function scoreCell(value, unit, date) {
  const bits = `${formatScore(value)}${unit ? ` ${unit}` : ""}`;
  return `${esc(bits)}${date ? `<br/><span style="color:#64748b;font-size:11px;">${esc(date)}</span>` : ""}`;
}

// Serialise the same comparison rows to a clean HTML table for saved
// report_html. Uses the report stylesheets' `table.outcome` class (the same
// class the pipe-table converter renderRichText emits) so printed output
// aligns. Returns "" when there is nothing to tabulate.
export function outcomeComparisonHtml(assessments, { className = "outcome" } = {}) {
  const rows = buildOutcomeComparison(assessments);
  if (rows.length === 0) return "";

  const header =
    "<thead><tr><th>Assessment</th><th>Baseline</th><th>Most Recent</th><th>Change</th><th>Interpretation</th></tr></thead>";

  const body = rows
    .map((row) => {
      if (!row.hasComparison) {
        return `<tr><td>${esc(row.name)}</td><td>${scoreCell(row.baselineValue, row.unit, row.baselineDate)}</td><td>—</td><td>—</td><td>${esc(SINGLE_POINT_LABEL)}</td></tr>`;
      }
      return `<tr><td>${esc(row.name)}</td><td>${scoreCell(row.baselineValue, row.unit, row.baselineDate)}</td><td>${scoreCell(row.latestValue, row.unit, row.latestDate)}</td><td>${esc(formatChange(row.change, row.unit))}</td><td>${esc(row.interpretation.label)}</td></tr>`;
    })
    .join("");

  const note = rows.some((r) => r.hasComparison)
    ? `<p style="font-size:11px;color:#64748b;margin:4px 0 8px;">${esc(OUTCOME_DIRECTION_NOTE)}</p>`
    : "";

  return `<table class="${className}">${header}<tbody>${body}</tbody></table>${note}`;
}
