import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildPhysioCatalogueManifest } from './physio-catalogue.mjs';
import { PHYSIO_ROUTE_ASSIGNMENTS } from './physio-route-assignments.mjs';

const OUTPUT_PATH = fileURLToPath(
  new URL('../../src/components/assessments/assessmentRunnerRegistry.generated.js', import.meta.url),
);

const FORBIDDEN_ROUTE_TERMS = new Set([
  'fallback',
  'generic',
  'generic-test-runner',
  'manual',
  'manual-result-capture',
]);

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function buildPhysioAssessmentRoutes(manifest = buildPhysioCatalogueManifest()) {
  invariant(manifest.canonicalAssessments.length === 236, 'Physio route generation requires exactly 236 canonicals');
  const canonicalIds = new Set(manifest.canonicalAssessments.map(({ canonicalId }) => canonicalId));
  const assignmentIds = Object.keys(PHYSIO_ROUTE_ASSIGNMENTS);
  invariant(assignmentIds.length === 236, 'Maintained route assignment map must contain exactly 236 entries');
  invariant(assignmentIds.every((canonicalId) => canonicalIds.has(canonicalId)), 'Route assignment map contains an unknown canonical ID');

  const routes = manifest.canonicalAssessments.map((canonical) => {
    const assignment = PHYSIO_ROUTE_ASSIGNMENTS[canonical.canonicalId];
    invariant(assignment.host, `${canonical.name} has no route host assignment`);
    invariant(assignment.runnerKey, `${canonical.name} has no runner-key assignment`);
    invariant(assignment.scoringKey, `${canonical.name} has no scoring-key assignment`);
    invariant(!FORBIDDEN_ROUTE_TERMS.has(assignment.host), `${canonical.name} uses forbidden host ${assignment.host}`);
    invariant(!FORBIDDEN_ROUTE_TERMS.has(assignment.runnerKey), `${canonical.name} uses forbidden runner ${assignment.runnerKey}`);
    invariant(assignment.runnerKey !== 'test-runner', `${canonical.name} has a non-specific TestRunner route`);

    const aliases = [...new Set(canonical.content.aliases || [])]
      .filter((alias) => alias && alias !== canonical.name)
      .sort((left, right) => left.localeCompare(right));
    return Object.freeze({
      canonicalId: canonical.canonicalId,
      name: canonical.name,
      ...assignment,
      ...(aliases.length > 0 ? { aliases: Object.freeze(aliases) } : {}),
    });
  });

  invariant(routes.length === 236, 'Physio route registry must contain exactly 236 routes');
  invariant(new Set(routes.map(({ canonicalId }) => canonicalId)).size === 236, 'Route canonical IDs are not unique');
  invariant(new Set(routes.map(({ name }) => name)).size === 236, 'Route canonical names are not unique');

  const exactNames = new Map();
  for (const route of routes) {
    for (const name of [route.name, ...(route.aliases || [])]) {
      const existing = exactNames.get(name);
      invariant(
        !existing || existing === route.canonicalId,
        `Exact route name or alias ${JSON.stringify(name)} maps to both ${existing} and ${route.canonicalId}`,
      );
      exactNames.set(name, route.canonicalId);
    }
  }

  return Object.freeze(routes);
}

export function renderPhysioAssessmentRouteRegistry(routes = buildPhysioAssessmentRoutes()) {
  const digest = sha256(JSON.stringify(routes));
  const rows = routes.map((route) => `  Object.freeze(${JSON.stringify(route)}),`).join('\n');
  return [
    '// Generated from the pinned 236-record Physio canonical manifest.',
    '// Runtime routing is exact by canonical ID/name/declared alias; no substring fallback is permitted.',
    `export const ASSESSMENT_ROUTE_REGISTRY_DIGEST = '${digest}';`,
    '',
    'export const GENERATED_ASSESSMENT_ROUTES = Object.freeze([',
    rows,
    ']);',
    '',
  ].join('\n');
}

export function assertCheckedInAssessmentRouteRegistry() {
  const expected = renderPhysioAssessmentRouteRegistry();
  const actual = fs.readFileSync(OUTPUT_PATH, 'utf8').replace(/\r\n/g, '\n');
  invariant(actual === expected, 'Checked-in assessment route registry is stale; run generator with --write');
  return true;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  const rendered = renderPhysioAssessmentRouteRegistry();
  if (process.argv.includes('--write')) {
    fs.writeFileSync(OUTPUT_PATH, rendered, 'utf8');
    process.stdout.write(`${JSON.stringify({
      outputPath: OUTPUT_PATH,
      routeCount: buildPhysioAssessmentRoutes().length,
      digest: sha256(JSON.stringify(buildPhysioAssessmentRoutes())),
    }, null, 2)}\n`);
  } else {
    assertCheckedInAssessmentRouteRegistry();
    process.stdout.write('Assessment route registry is current.\n');
  }
}
