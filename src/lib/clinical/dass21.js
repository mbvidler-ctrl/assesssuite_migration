// Relative import (not the @/ alias): this module is also loaded by the Node
// seeder and server scripts, where the Vite alias does not resolve.
import { todayLocal } from "../localDate.js";
// Canonical DASS-21 constants — single source of truth shared by the runner,
// the SOAP objective writer, and the completed-assessment viewer, so the item
// wording and the severity cutoffs cannot drift between surfaces.
//
// Severity cutoffs and the ×2 subscale multiplier are those of the published
// DASS manual: Lovibond, S.H. & Lovibond, P.F. (1995), Manual for the
// Depression Anxiety Stress Scales (2nd ed.), Psychology Foundation of
// Australia. Provenance is recorded in the clinical-claims audit register
// (docs/qa/20260705-clinical-claims-audit-register.md, row CL-DASS21-BANDS).

export const DASS21_QUESTIONS = [
  { category: "S", text: "I found it hard to wind down" },
  { category: "A", text: "I was aware of dryness of my mouth" },
  { category: "D", text: "I couldn't seem to experience any positive feeling at all" },
  { category: "A", text: "I experienced breathing difficulty (e.g., excessively rapid breathing, breathlessness in the absence of physical exertion)" },
  { category: "D", text: "I found it difficult to work up the initiative to do things" },
  { category: "S", text: "I tended to over-react to situations" },
  { category: "A", text: "I experienced trembling (e.g., in the hands)" },
  { category: "S", text: "I felt that I was using a lot of nervous energy" },
  { category: "A", text: "I was worried about situations in which I might panic and make a fool of myself" },
  { category: "D", text: "I felt that I had nothing to look forward to" },
  { category: "S", text: "I found myself getting agitated" },
  { category: "S", text: "I found it difficult to relax" },
  { category: "D", text: "I felt down-hearted and blue" },
  { category: "S", text: "I was intolerant of anything that kept me from getting on with what I was doing" },
  { category: "A", text: "I felt I was close to panic" },
  { category: "D", text: "I was unable to become enthusiastic about anything" },
  { category: "D", text: "I felt I wasn't worth much as a person" },
  { category: "S", text: "I felt that I was rather touchy" },
  { category: "A", text: "I was aware of the action of my heart in the absence of physical exertion (e.g., sense of heart rate increase, heart missing a beat)" },
  { category: "A", text: "I felt scared without any good reason" },
  { category: "D", text: "I felt that life was meaningless" }
];

export const DASS21_OPTIONS = [
  "Did not apply to me at all",
  "Applied to me to some degree, or some of the time",
  "Applied to me to a considerable degree, or a good part of time",
  "Applied to me very much, or most of the time"
];

// Subscale severity bands for the ×2 (DASS-42-equivalent) subscale scores.
export const DASS21_BANDS = {
  depression: [
    { max: 9, level: "Normal" },
    { max: 13, level: "Mild" },
    { max: 20, level: "Moderate" },
    { max: 27, level: "Severe" },
    { max: Infinity, level: "Extremely Severe" },
  ],
  anxiety: [
    { max: 7, level: "Normal" },
    { max: 9, level: "Mild" },
    { max: 14, level: "Moderate" },
    { max: 19, level: "Severe" },
    { max: Infinity, level: "Extremely Severe" },
  ],
  stress: [
    { max: 14, level: "Normal" },
    { max: 18, level: "Mild" },
    { max: 25, level: "Moderate" },
    { max: 33, level: "Severe" },
    { max: Infinity, level: "Extremely Severe" },
  ],
};

export const DASS21_SOURCE = "Lovibond & Lovibond (1995), DASS Manual (2nd ed.)";

// Returns the severity level string for a ×2 subscale score. Data-driven from
// the published bands above — never an invented category.
export function getDassLevel(score, category) {
  const bands = DASS21_BANDS[category];
  if (!bands) return null;
  const band = bands.find((b) => score <= b.max);
  return band ? band.level : null;
}

// Build the full DASS-21 ClientAssessment payload from a 21-length raw-score
// map ({ [index]: 0-3 }). Single source used by the runner and the seed so item
// wording, the ×2 subscale multiplier, and the severity bands cannot diverge.
// The soap_text carries the subscale summary AND every individual item answer.
export function buildDass21Payload(rawScores, notes = "") {
  const catLabel = { D: "Depression", A: "Anxiety", S: "Stress" };
  let d = 0, a = 0, s = 0;
  DASS21_QUESTIONS.forEach((q, i) => {
    const v = Number(rawScores[i]) || 0;
    if (q.category === "D") d += v;
    else if (q.category === "A") a += v;
    else s += v;
  });
  const depression = d * 2, anxiety = a * 2, stress = s * 2;
  const depLevel = getDassLevel(depression, "depression");
  const anxLevel = getDassLevel(anxiety, "anxiety");
  const strLevel = getDassLevel(stress, "stress");
  const items = DASS21_QUESTIONS.map((q, i) => ({
    number: i + 1,
    question_text: q.text,
    category: q.category,
    value: Number(rawScores[i]) || 0,
    response_label: DASS21_OPTIONS[Number(rawScores[i]) || 0],
  }));
  const summary = `• DASS-21\n  Depression: ${depression}/42 — ${depLevel}\n  Anxiety: ${anxiety}/42 — ${anxLevel}\n  Stress: ${stress}/42 — ${strLevel}`;
  const itemBlock = "Individual Item Responses:\n" + items
    .map((it) => `  Q${it.number}. ${it.question_text} [${catLabel[it.category]}]\n    Answer: ${it.value} — ${it.response_label}`)
    .join("\n");
  return {
    status: "completed",
    result_value: depression + anxiety + stress,
    additional_data: {
      soap_text: `${summary}\n\n${itemBlock}`,
      depression_score: depression,
      anxiety_score: anxiety,
      stress_score: stress,
      depression_interpretation: depLevel,
      anxiety_interpretation: anxLevel,
      stress_interpretation: strLevel,
      raw_scores: { ...rawScores },
      items,
      measurement_type: "dass21",
    },
    notes,
    assessment_date: todayLocal(),
  };
}

// UI colour classes kept out of the shared logic; the runner maps level->colour.
export const DASS21_LEVEL_STYLES = {
  Normal: { color: "text-green-600", bg: "bg-green-50" },
  Mild: { color: "text-yellow-600", bg: "bg-yellow-50" },
  Moderate: { color: "text-orange-600", bg: "bg-orange-50" },
  Severe: { color: "text-red-600", bg: "bg-red-50" },
  "Extremely Severe": { color: "text-red-800", bg: "bg-red-100" },
};
