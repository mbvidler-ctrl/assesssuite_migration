// P-B: deterministic, direction-aware normative interpretation.
//
// Given a client result and a normative reference, produce the numeric
// comparison sentence the clinician asked for ("...score of x is 1.4 times
// lower than [reference]..."). Two hard safety rules, both from the workspace
// fabrication prohibition and the briefing:
//
//  1. Everything numeric is templated STRICTLY from stored numbers (mean, SD,
//     percentiles, the client's own score). Nothing is invented.
//  2. The clinical-inference clause ("...which may indicate [y]; further [z]
//     testing may be warranted") is NEVER generated here. It is emitted only
//     when the norm carries a CURATED clinical_inference entry authored/verified
//     by a clinician for the computed band. Absent that, it is omitted.
//
// The comparison also carries a direction-of-benefit flag so it never asserts a
// "higher = better" meaning on a lower-is-better test (e.g. Timed Up and Go).
// Returns null when there is no usable normative reference (degrade silently).

// Select the normative row matching a client's age and gender, or null.
export function selectNorm(normativeData, age, gender) {
  if (!Array.isArray(normativeData) || normativeData.length === 0) return null;
  if (!Number.isFinite(age)) return null;
  return (
    normativeData.find(
      (n) =>
        age >= n.age_min &&
        age <= n.age_max &&
        (n.gender === gender || n.gender === "both")
    ) || null
  );
}

// Normalise the direction flag; unknown -> 'neutral' (state raw relationship only).
function normDirection(direction) {
  if (direction === "higher_better" || direction === "lower_better") return direction;
  return "neutral";
}

function computeBand(resultValue, norm) {
  const { mean, std_dev, percentile_25, percentile_75 } = norm;
  if (Number.isFinite(percentile_25) && Number.isFinite(percentile_75) && Number.isFinite(mean)) {
    if (resultValue >= percentile_75) return "above_p75";
    if (resultValue >= mean) return "above_mean";
    if (resultValue >= percentile_25) return "below_mean_within_iqr";
    return "below_p25";
  }
  if (Number.isFinite(std_dev) && std_dev > 0 && Number.isFinite(mean)) {
    const z = (resultValue - mean) / std_dev;
    if (z >= 1) return "above_1sd";
    if (z <= -1) return "below_1sd";
    return "within_1sd";
  }
  if (Number.isFinite(mean)) return resultValue >= mean ? "above_mean" : "below_mean";
  return "unknown";
}

// Raw statistical position, independent of whether high or low is desirable.
function rawPosition(resultValue, norm) {
  const high = Number.isFinite(norm.percentile_75) ? norm.percentile_75 : norm.mean;
  const low = Number.isFinite(norm.percentile_25) ? norm.percentile_25 : norm.mean;
  if (resultValue >= high) return "high";
  if (resultValue < low) return "low";
  return "typical";
}

// Direction-aware performance label + ClientAssessment enum.
function performanceFrom(position, direction) {
  if (direction === "neutral") {
    if (position === "high") return { label: "Above the reference mean", enum: "above_average" };
    if (position === "low") return { label: "Below the reference mean", enum: "below_average" };
    return { label: "Within the typical range", enum: "average" };
  }
  const highIsGood = direction === "higher_better";
  if (position === "typical") return { label: "Within the typical range", enum: "average" };
  const good = (position === "high") === highIsGood;
  return good
    ? { label: "Above average", enum: "above_average" }
    : { label: "Below average", enum: "below_average" };
}

export function generateInterpretation({
  resultValue,
  norm,
  subjectName = "The client",
  unit = "",
  ageLabel = null,
  genderLabel = null,
} = {}) {
  if (norm == null || typeof norm !== "object") return null;
  if (!Number.isFinite(resultValue) || !Number.isFinite(norm.mean)) return null;

  const direction = normDirection(norm.direction);
  const u = unit ? ` ${unit}` : "";
  const cohortBits = [];
  if (genderLabel && genderLabel !== "both") cohortBits.push(genderLabel);
  if (ageLabel) cohortBits.push(`aged ${ageLabel}`);
  const cohort = cohortBits.length ? ` for ${cohortBits.join(" ")}` : "";

  // Numeric comparison to the mean (always true regardless of direction).
  let relation;
  if (resultValue > norm.mean) {
    const factor = (resultValue / norm.mean).toFixed(1);
    relation = `${factor} times higher than`;
  } else if (resultValue < norm.mean) {
    const factor = (norm.mean / resultValue).toFixed(1);
    relation = `${factor} times lower than`;
  } else {
    relation = "at";
  }

  const zScore =
    Number.isFinite(norm.std_dev) && norm.std_dev > 0
      ? (resultValue - norm.mean) / norm.std_dev
      : null;
  const zText = zScore != null ? ` (z = ${zScore.toFixed(1)})` : "";

  const meanClause =
    relation === "at"
      ? `${subjectName}'s score of ${resultValue}${u} is at the reference mean (${norm.mean}${u})${cohort}${zText}.`
      : `${subjectName}'s score of ${resultValue}${u} is ${relation} the reference mean (${norm.mean}${u})${cohort}${zText}.`;

  const position = rawPosition(resultValue, norm);
  const perf = performanceFrom(position, direction);

  // Direction clause only when we actually know the direction of benefit.
  let directionClause = "";
  if (direction !== "neutral") {
    const dirWord = direction === "higher_better" ? "higher" : "lower";
    const benefit = direction === "higher_better" ? "better" : "better"; // dirWord already encodes it
    directionClause = ` For this measure, ${dirWord} scores indicate better performance; this result is ${perf.label.toLowerCase()}.`;
  }

  // Curated clinical inference ONLY (never generated). Keyed by band; a
  // '*' key may hold a default curated clause for the assessment.
  const band = computeBand(resultValue, norm);
  let inferenceClause = "";
  if (norm.clinical_inference && typeof norm.clinical_inference === "object") {
    const curated = norm.clinical_inference[band] || norm.clinical_inference["*"];
    if (typeof curated === "string" && curated.trim()) {
      inferenceClause = ` ${curated.trim()}`;
    }
  }

  const provenance = norm.source ? ` [Norm source: ${norm.source}]` : "";

  return {
    comparisonText: `${meanClause}${directionClause}${inferenceClause}${provenance}`,
    performanceLevel: perf.label,
    normativeEnum: perf.enum,
    zScore,
    band,
    source: norm.source || null,
    hasCuratedInference: Boolean(inferenceClause),
  };
}
