import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testsDir, '..', '..');
const pageSource = fs.readFileSync(
  path.join(repoRoot, 'src', 'pages', 'TreatmentProtocols.jsx'),
  'utf8',
);

test('treatment-protocol search keeps reviewed rows and restores the grounded custom-condition fallback', () => {
  assert.match(pageSource, /base44\.entities\.TreatmentProtocol\.list\(\)/);
  assert.match(pageSource, /No reviewed treatment protocol matches/);
  assert.match(pageSource, /exactCatalogueCondition/);
  assert.match(pageSource, /!isCatalogueLoading && !catalogueError && customCondition/);
  assert.match(pageSource, /Generate AI-assisted protocol for/);
  assert.match(pageSource, /base44\.functions\.invoke\("searchEvidence"/);
  assert.match(pageSource, /base44\.integrations\.Core\.InvokeLLM/);
  assert.match(pageSource, /response_json_schema: PROTOCOL_RESPONSE_SCHEMA/);
  assert.match(pageSource, /validateReferences\(groundedReferences\)/);
  assert.ok(
    pageSource.indexOf('base44.functions.invoke("searchEvidence"')
      < pageSource.indexOf('base44.integrations.Core.InvokeLLM'),
    'verified evidence retrieval must precede custom protocol generation',
  );
  assert.doesNotMatch(pageSource, /TreatmentProtocol\.filter/);
});

test('reviewed catalogue preparation is null-safe, deduplicated and sorted before selection', () => {
  assert.match(pageSource, /for \(const row of Array\.isArray\(rows\) \? rows : \[\]\)/);
  assert.match(pageSource, /typeof row\?\.condition_name === "string"/);
  assert.match(pageSource, /uniqueByName\.has\(key\)/);
  assert.match(pageSource, /\[\.\.\.uniqueByName\.values\(\)\]\.sort/);
  assert.match(pageSource, /condition_name\.localeCompare/);
  assert.match(pageSource, /const reviewedProtocol = condition\?\.protocol/);
  assert.match(pageSource, /if \(reviewedProtocol\)/);
  assert.match(pageSource, /onClick=\{\(\) => loadProtocol\(condition\)\}/);
  // WP3 hardening: a reviewed catalogue row that does not fit the shared
  // render contract (src/lib/protocolResponse.js) falls back to the raw row
  // rather than the normalised one, so a malformed reviewed row never
  // regresses to nothing being shown at all.
  assert.match(pageSource, /setProtocolData\(reviewed\.ok \? reviewed\.protocol : protocol\)/);
  assert.match(pageSource, /<AIDisclosureNote \/>/);
  assert.match(pageSource, /<ImportToSOAPModal/);
});

// WP1: what is written into the clinical record must carry the same
// provenance the clinician was shown. The import provenance is therefore
// driven by the SAME predicate as the on-screen "AI-assisted draft" badge
// (`selectedCondition?.protocol`), so the two can never disagree.
test('protocol import provenance is driven by the same predicate as the on-screen badge', () => {
  assert.match(pageSource, /import \{ PROTOCOL_PROVENANCE \} from "@\/lib\/clinical\/protocolImport";/);
  assert.match(
    pageSource,
    /provenance=\{selectedCondition\?\.protocol \? PROTOCOL_PROVENANCE\.REVIEWED : PROTOCOL_PROVENANCE\.AI\}/,
  );
  // The badge predicate itself must stay the negation of the same expression.
  assert.match(pageSource, /\{!selectedCondition\?\.protocol && \(/);
});
