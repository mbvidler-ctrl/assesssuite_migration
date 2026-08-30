import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const COMMON_REQUIRED_MARKERS = Object.freeze([
  'I have read and agree to the',
  'Optional: send me product updates and marketing by email',
  'Accredited Exercise Physiologist (AEP)',
]);

export const COMMON_FORBIDDEN_MARKERS = Object.freeze([
  'Country of Practice',
  "I confirm this practice's use of AssessSuite is limited to adult patients",
  'adult patients (18 and over)',
]);

export const CANDIDATE_REQUIRED_MARKERS = Object.freeze([
  'Extract Data from',
  'Starting extraction confirms that',
  'the patient or representative has received the required notice and the practice has documented consent or another valid authority',
  'the parent, guardian or other authorised representative has received the required notice and the practice has documented consent or another valid authority',
  'for AssessSuite and OpenAI to process this referral. No patient record changes until you review and confirm the extracted data.',
  'Your current practice could not be resolved. Refresh the page or check your practice membership.',
]);

export const CANDIDATE_FORBIDDEN_MARKERS = Object.freeze([
  'Confirm Patient 13+ & Extract Data from',
  'By selecting Confirm Patient 13+ & Extract',
  'Owning practice',
  'The server calculates the age category',
  'I confirm the practice has documented the patient',
]);

function requireRegularFile(file, label) {
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error(`${label} is not one regular file`);
  }
}

export function validateProductionPublicSurface(distRoot) {
  const root = path.resolve(distRoot);
  const htmlPath = path.join(root, 'index.html');
  requireRegularFile(htmlPath, 'Production index');
  const html = fs.readFileSync(htmlPath, 'utf8');
  const match = html.match(/<script[^>]+type=["']module["'][^>]+src=["']([^"']+)["']/i)
    || html.match(/<script[^>]+src=["']([^"']+)["'][^>]+type=["']module["']/i);
  if (!match || !/^\/assets\/[A-Za-z0-9._-]+\.js$/.test(match[1])) {
    throw new Error('Production HTML does not reference one canonical local JavaScript asset');
  }
  const assetPath = path.resolve(root, `.${match[1]}`);
  if (!assetPath.startsWith(`${root}${path.sep}`)) {
    throw new Error('Production entry asset escaped the compiled root');
  }
  requireRegularFile(assetPath, 'Production entry asset');
  const bundle = fs.readFileSync(assetPath, 'utf8');
  if (!/<!doctype html>/i.test(html) || bundle.length < 10_000) {
    throw new Error('Production static assets are incomplete');
  }

  for (const marker of [...COMMON_REQUIRED_MARKERS, ...CANDIDATE_REQUIRED_MARKERS]) {
    if (!bundle.includes(marker)) throw new Error(`Production bundle is missing required marker: ${marker}`);
  }
  const lowerBundle = bundle.toLowerCase();
  for (const marker of [...COMMON_FORBIDDEN_MARKERS, ...CANDIDATE_FORBIDDEN_MARKERS]) {
    if (lowerBundle.includes(marker.toLowerCase())) {
      throw new Error(`Production bundle retains forbidden marker: ${marker}`);
    }
  }
  return Object.freeze({
    result: 'PASS',
    asset_path: match[1],
    bundle_bytes: Buffer.byteLength(bundle),
    required_markers: COMMON_REQUIRED_MARKERS.length + CANDIDATE_REQUIRED_MARKERS.length,
    forbidden_markers: COMMON_FORBIDDEN_MARKERS.length + CANDIDATE_FORBIDDEN_MARKERS.length,
  });
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 3) throw new Error('Usage: validate-production-public-surface.mjs <dist-root>');
  process.stdout.write(`${JSON.stringify(validateProductionPublicSurface(process.argv[2]))}\n`);
}
