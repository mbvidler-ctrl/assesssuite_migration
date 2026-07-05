// Shared helpers for surfacing THOROUGH assessment results — totals AND
// individual item answers — consistently into the SOAP objective and the
// completed-assessment viewer. All functions are pure and read only from the
// stored ClientAssessment.additional_data (plus, for questionnaires, the item
// wording); they never fabricate values.

export const ITEM_BLOCK_MARKER = "Individual Item Responses:";

// Measurement types whose viewer branch ALREADY renders a full per-item /
// per-trial table, so the generic "All recorded responses" block should not
// also render (it would duplicate). Summary-only families are absent here and
// therefore get the generic block.
const BESPOKE_ITEM_RENDERERS = new Set([
  "10_second_repeated_jump",
  "skinfold",
  "rom_assessment",
  "womac",
  "hand_grip_strength",
  "back_scratch",
  "12_minute_walk_run",
  "cooper_test",
  "balke_ware",
  "four_stage_balance_test",
]);

export function hasBespokeItemRenderer(measurementType) {
  return BESPOKE_ITEM_RENDERERS.has(measurementType);
}

// Normalise the heterogeneous per-item shapes runners persist
// (additional_data.items | responses{object|array} | raw_scores{object}) into a
// single canonical items[] array. `questions` is the ordered item list for
// questionnaires (e.g. DASS21_QUESTIONS); `options` maps a numeric answer to a
// response label (e.g. DASS21_OPTIONS). Returns [] when no per-item data
// exists (degrade silently).
export function deriveItems(additionalData, { questions = null, options = null } = {}) {
  if (!additionalData || typeof additionalData !== "object") return [];

  // 1) Already canonical.
  if (Array.isArray(additionalData.items) && additionalData.items.length > 0) {
    return additionalData.items;
  }

  // Pick the source map of index -> answer value.
  let source = null;
  if (additionalData.responses !== undefined && additionalData.responses !== null) {
    source = additionalData.responses;
  } else if (additionalData.raw_scores !== undefined && additionalData.raw_scores !== null) {
    source = additionalData.raw_scores;
  }
  if (source === null) return [];

  const entries = Array.isArray(source)
    ? source.map((value, index) => [index, value])
    : Object.entries(source).map(([k, value]) => [Number(k), value]);

  entries.sort((a, b) => a[0] - b[0]);

  return entries
    .filter(([index]) => Number.isFinite(index))
    .map(([index, value]) => {
      const q = questions && questions[index] ? questions[index] : null;
      const responseLabel =
        options && Number.isInteger(value) && options[value] !== undefined
          ? options[value]
          : null;
      return {
        number: index + 1,
        question_text: q ? q.text : null,
        category: q && q.category ? q.category : null,
        value,
        response_label: responseLabel,
      };
    });
}

// Render a canonical items[] array as an indented SOAP text block.
export function buildItemBlockText(items) {
  if (!Array.isArray(items) || items.length === 0) return "";
  const lines = [ITEM_BLOCK_MARKER];
  for (const it of items) {
    const q = it.question_text ? `${it.question_text}` : `Item ${it.number}`;
    lines.push(`  Q${it.number}. ${q}`);
    const answer =
      it.response_label != null
        ? `${it.value} — ${it.response_label}`
        : `${it.value}`;
    lines.push(`    Answer: ${answer}`);
  }
  return lines.join("\n");
}

// True when a soap_text string already contains a per-item block, so callers
// do not append a second one.
export function soapTextHasItemBlock(soapText) {
  if (!soapText) return false;
  return soapText.includes(ITEM_BLOCK_MARKER) || /(^|\n)\s*Q1\.\s/.test(soapText);
}
