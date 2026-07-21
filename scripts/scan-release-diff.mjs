import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

function entropy(value) {
  const counts = new Map();
  for (const char of value) counts.set(char, (counts.get(char) || 0) + 1);
  return [...counts.values()].reduce((sum, count) => {
    const probability = count / value.length;
    return sum - probability * Math.log2(probability);
  }, 0);
}

function isReviewedTestCanary(value, file) {
  if (/synthetic|example|placeholder|selftest|change-me-local|canary/i.test(value)) return true;
  return /(?:^|\/)(?:server\/tests|server\/selftest\.mjs|scripts\/.*(?:test|selftest))/i.test(file)
    && /(?:test|probe|fixture)/i.test(value);
}

export function scanReleaseDiff(diff) {
  const findings = [];
  let file = '';
  for (const rawLine of String(diff).split(/\r?\n/)) {
    if (rawLine.startsWith('+++ b/')) {
      file = rawLine.slice(6);
      continue;
    }
    if (!rawLine.startsWith('+') || rawLine.startsWith('+++')) continue;
    const line = rawLine.slice(1);

    if (/BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/.test(line)) {
      findings.push({ file, kind: 'private-key-header' });
      continue;
    }
    for (const pattern of [
      /\bsk_(?:live|test)_[A-Za-z0-9]{16,}\b/g,
      /\bwhsec_[A-Za-z0-9]{16,}\b/g,
      /\bsk-[A-Za-z0-9_-]{20,}\b/g,
      /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g,
      /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
      /\bAKIA[A-Z0-9]{16}\b/g,
      /\bAIza[A-Za-z0-9_-]{30,}\b/g,
      /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g,
      /\bFlyV1\s+[A-Za-z0-9_.=-]{20,}\b/g,
    ]) {
      if (pattern.test(line)) findings.push({ file, kind: 'provider-secret-format' });
    }

    const assignment = /\b([A-Za-z0-9_]*(?:API[_-]?KEY|SECRET|TOKEN|PASSWORD)[A-Za-z0-9_]*)\s*([:=])\s*(?:(['"])([^'"\r\n]+)\3|([A-Za-z0-9+_./=-]{16,}))/gi;
    for (const match of line.matchAll(assignment)) {
      const value = match[4] || match[5];
      if (isReviewedTestCanary(value, file)) continue;
      if (!match[3]) {
        // An unquoted identifier or member expression is a runtime reference,
        // not credential material embedded in the release diff.
        const isCodeObjectReference = match[2] === ':'
          && /\.(?:[cm]?[jt]sx?)$/i.test(file)
          && /^[A-Za-z_$][A-Za-z0-9_$]*(?:\.[A-Za-z_$][A-Za-z0-9_$]*)*$/.test(value);
        if (isCodeObjectReference) continue;
        if (/^(?:process\.)?env\.|^(?:config|secrets?)\./i.test(value)) continue;
        const classes = [/[a-z]/, /[A-Z]/, /\d/, /[+_./=-]/].filter((pattern) => pattern.test(value)).length;
        if (classes < 3 || entropy(value) < 3.5) continue;
      }
      findings.push({ file, kind: 'literal-sensitive-assignment', name: match[1] });
    }

    const quotedToken = /(['"])([A-Za-z0-9+_=.-]{32,})\1/g;
    for (const match of line.matchAll(quotedToken)) {
      const value = match[2];
      if (isReviewedTestCanary(value, file)) continue;
      if (/^[a-f0-9]{40,64}$/i.test(value)) continue;
      if (/synthetic|example|placeholder|sha(?:256|512)|integrity|assesssuite/i.test(value)) continue;
      if (/v20\d\d-\d\d-\d\d/i.test(value) || /^[A-Z][A-Z0-9_]+$/.test(value)) continue;
      const classes = [/[a-z]/, /[A-Z]/, /\d/, /[+_=.-]/].filter((pattern) => pattern.test(value)).length;
      if (classes >= 3 && entropy(value) >= 4.4) findings.push({ file, kind: 'high-entropy-literal' });
    }
  }
  return findings;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const diffPath = process.argv[2];
  if (!diffPath) throw new Error('Usage: node scripts/scan-release-diff.mjs <diff-file>');
  const findings = scanReleaseDiff(fs.readFileSync(diffPath, 'utf8'));
  if (findings.length) {
    console.error(JSON.stringify(findings, null, 2));
    process.exit(1);
  }
  console.log('Release diff secret scan passed.');
}
