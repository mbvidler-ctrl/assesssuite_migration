import crypto from 'node:crypto';
import fs from 'node:fs';

/**
 * Implementation checksums identify source semantics, not a platform-specific
 * checkout representation. Git stores the product source with LF line endings,
 * while a Windows worktree may materialise selected files with CRLF. Normalise
 * UTF-8 source text before hashing so the same committed implementation has
 * one stable identity in local validation and Linux CI.
 */
export function normaliseSourceText(source) {
  return Buffer.isBuffer(source) ? source.toString('utf8') : String(source);
}

export function canonicalSourceText(source) {
  return normaliseSourceText(source)
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n');
}

export function normalisedSourceSha256(source) {
  return crypto
    .createHash('sha256')
    .update(canonicalSourceText(source), 'utf8')
    .digest('hex');
}

export function normalisedFileSha256(filePath) {
  return normalisedSourceSha256(fs.readFileSync(filePath));
}
