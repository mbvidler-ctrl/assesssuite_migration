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
    && /(?:test|probe|fixture|wrong|invalid|too-short)/i.test(value);
}

function isCredentialBearingName(name) {
  const segments = String(name)
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  return !segments.some((segment) => [
    'checksum', 'digest', 'fingerprint', 'hash', 'offset', 'path', 'preflight',
    'prestate', 'readback', 'sha', 'sha256', 'sha512', 'staged', 'state', 'status',
    'text',
  ].includes(segment));
}

function isHighEntropySensitiveValue(value) {
  const candidate = String(value);
  if (candidate.length < 16) return false;
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[+_./=-]/]
    .filter((pattern) => pattern.test(candidate)).length;
  return classes >= 3 && entropy(candidate) >= 3.5;
}

function hasConstructedSensitiveLiteral(value, file) {
  if (isReviewedTestCanary(value, file)) return false;
  const literalSurface = String(value)
    // Runtime-owned values are references, not bytes embedded in the diff.
    .replace(/\b(?:process\.)?env\.[A-Za-z_][A-Za-z0-9_]*/gi, ' ')
    .replace(/\b(?:config|secrets?)\.[A-Za-z_$][A-Za-z0-9_$]*/gi, ' ')
    .replace(/\$\{?[A-Za-z_][A-Za-z0-9_]*\}?/g, ' ')
    // Function and command identifiers describe how a value is obtained. Keep
    // their arguments so split or interpolated literal material is recomposed.
    .replace(/\b[A-Za-z_$][A-Za-z0-9_$]*(?=\s*\()/g, ' ')
    .replace(/\.[A-Za-z_$][A-Za-z0-9_$]*/g, ' ');
  const candidate = (literalSurface.match(/[A-Za-z0-9+_./=-]+/g) || []).join('');
  if (candidate.length < 16 || isReviewedTestCanary(candidate, file)) return false;
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[+_./=-]/]
    .filter((pattern) => pattern.test(candidate)).length;
  return classes >= 3 && entropy(candidate) >= 3.5;
}

export function scanReleaseDiff(diff) {
  const findings = [];
  const addedSegments = [];
  let segmentFile = '';
  let segmentLines = [];
  const flushSegment = () => {
    if (segmentLines.length) addedSegments.push({ file: segmentFile, lines: segmentLines });
    segmentLines = [];
  };
  for (const rawLine of String(diff).split(/\r?\n/)) {
    if (rawLine.startsWith('+++ b/')) {
      flushSegment();
      segmentFile = rawLine.slice(6);
    } else if (rawLine.startsWith('+') && !rawLine.startsWith('+++')) {
      segmentLines.push(rawLine.slice(1));
    } else {
      flushSegment();
    }
  }
  flushSegment();

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

    let foundLiteralSensitiveAssignment = false;
    let sawSensitiveAssignment = false;
    const assignment = /\b([A-Za-z0-9_]*(?:API[_-]?KEY|SECRET|TOKEN|PASSWORD)[A-Za-z0-9_]*)\s*([:=])\s*(?:(['"])([^'"\r\n]+)\3|([A-Za-z0-9+_./=-]{16,}))/gi;
    for (const match of line.matchAll(assignment)) {
      const value = match[4] || match[5];
      if (!isCredentialBearingName(match[1])) {
        const metadataRuntimeReference = /^\$(?:\{?[A-Za-z_][A-Za-z0-9_]*\}?)$/.test(value)
          || /^(?:process\.)?env\.[A-Za-z_][A-Za-z0-9_]*$/i.test(value)
          || /^[A-Za-z_$][A-Za-z0-9_$]*(?:\.[A-Za-z_$][A-Za-z0-9_$]*)+$/.test(value);
        if (metadataRuntimeReference) continue;
        if (isHighEntropySensitiveValue(value) && !isReviewedTestCanary(value, file)) {
          findings.push({ file, kind: 'literal-sensitive-assignment', name: match[1] });
          foundLiteralSensitiveAssignment = true;
        }
        continue;
      }
      sawSensitiveAssignment = true;
      if (isReviewedTestCanary(value, file)) continue;
      const shellLikeFile = /\.(?:ya?ml|sh|bash)$/i.test(file);
      const exactEnvironmentReference = /^\$(?:\{?[A-Z_][A-Z0-9_]*\}?)$/.test(value);
      const codeConcatenationReference = /^\s*\+\s*[A-Za-z_$][A-Za-z0-9_$]*(?:\.[A-Za-z_$][A-Za-z0-9_$]*)*\s*\+\s*(?:\\[nrt])?\s*$/.test(value);
      if (match[3] && (
        exactEnvironmentReference
        || codeConcatenationReference
        || (shellLikeFile && /^\$(?:\(|\{?[A-Za-z_])/.test(value))
      )) {
        if (hasConstructedSensitiveLiteral(value, file)) {
          findings.push({ file, kind: 'literal-sensitive-assignment', name: match[1] });
          foundLiteralSensitiveAssignment = true;
        }
        continue;
      }
      if (!match[3]) {
        // An unquoted identifier or member expression is a runtime reference,
        // not credential material embedded in the release diff.
        const isCodeObjectReference = /\.(?:[cm]?[jt]sx?)$/i.test(file)
          && (match[2] === ':' || value.includes('.'))
          && /^[A-Za-z_$][A-Za-z0-9_$]*(?:\.[A-Za-z_$][A-Za-z0-9_$]*)*$/.test(value);
        if (isCodeObjectReference) continue;
        if (/^(?:process\.)?env\.|^(?:config|secrets?)\./i.test(value)) continue;
        if (!isHighEntropySensitiveValue(value)) continue;
      }
      findings.push({ file, kind: 'literal-sensitive-assignment', name: match[1] });
      foundLiteralSensitiveAssignment = true;
    }

    if (!foundLiteralSensitiveAssignment && !sawSensitiveAssignment && /\.(?:ya?ml|sh|bash)$/i.test(file)) {
      const shellConstruction = line.match(
        /\b([A-Za-z0-9_]*(?:API[_-]?KEY|SECRET|TOKEN|PASSWORD)[A-Za-z0-9_]*)\s*[:=]\s*(.+)$/i,
      );
      if (shellConstruction
        && isCredentialBearingName(shellConstruction[1])
        && hasConstructedSensitiveLiteral(shellConstruction[2], file)) {
        findings.push({
          file,
          kind: 'literal-sensitive-assignment',
          name: shellConstruction[1],
        });
        foundLiteralSensitiveAssignment = true;
      }
    }

    if (!foundLiteralSensitiveAssignment && /\.(?:[cm]?[jt]sx?)$/i.test(file)) {
      const codeConstruction = line.match(
        /\b([A-Za-z0-9_]*(?:API[_-]?KEY|SECRET|TOKEN|PASSWORD)[A-Za-z0-9_]*)\s*[:=]\s*(\[[^\]]+\]\s*\.join\s*\([^)]*\))/i,
      );
      if (codeConstruction
        && isCredentialBearingName(codeConstruction[1])
        && hasConstructedSensitiveLiteral(codeConstruction[2], file)) {
        findings.push({
          file,
          kind: 'literal-sensitive-assignment',
          name: codeConstruction[1],
        });
      }
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

  for (const segment of addedSegments) {
    const content = segment.lines.join('\n');
    if (/\.(?:[cm]?[jt]sx?)$/i.test(segment.file)) {
      const multilineCodeConstruction = /\b([A-Za-z0-9_]*(?:API[_-]?KEY|SECRET|TOKEN|PASSWORD)[A-Za-z0-9_]*)\s*[:=]\s*(\[[^\]]{0,4096}\]\s*\.join\s*\([^)]*\))/gi;
      for (const match of content.matchAll(multilineCodeConstruction)) {
        if (!match[2].includes('\n') || !isCredentialBearingName(match[1])) continue;
        if (hasConstructedSensitiveLiteral(match[2], segment.file)) {
          findings.push({ file: segment.file, kind: 'literal-sensitive-assignment', name: match[1] });
        }
      }
    }
    if (/\.(?:ya?ml|sh|bash)$/i.test(segment.file)) {
      const multilineShellConstruction = /\b([A-Za-z0-9_]*(?:API[_-]?KEY|SECRET|TOKEN|PASSWORD)[A-Za-z0-9_]*)\s*[:=]\s*("\$\([\s\S]{0,4096}?\)")/gi;
      for (const match of content.matchAll(multilineShellConstruction)) {
        if (!match[2].includes('\n') || !isCredentialBearingName(match[1])) continue;
        if (hasConstructedSensitiveLiteral(match[2], segment.file)) {
          findings.push({ file: segment.file, kind: 'literal-sensitive-assignment', name: match[1] });
        }
      }
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
