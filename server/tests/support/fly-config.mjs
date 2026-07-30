// Minimal Fly.io TOML [env] block reader, duplicated (not moved) from the
// `parseReviewedFlyConfig` algorithm in
// server/tests/rollback-compatibility.test.mjs:37-56, which is a release
// gate and is not touched by this item. That original returns every
// `section.KEY` pair with the literal quoted RHS retained; this shared
// helper narrows to the `[env]` section only and strips the surrounding
// quotes, returning bare `NAME -> value` pairs — callers must not assume the
// original's quoted shape.

import fs from 'node:fs';

/**
 * Parses the `[env]` block of a Fly.io TOML configuration file.
 * Returns Map<NAME, unquoted value>. Throws on a duplicate key within [env].
 */
export function parseFlyEnv(text) {
  const values = new Map();
  let section = 'root';
  for (const rawLine of String(text).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const sectionMatch = line.match(/^\[\[?([^\]]+)\]\]?$/);
    if (sectionMatch) {
      section = sectionMatch[1];
      continue;
    }
    if (section !== 'env') continue;
    const assignment = line.match(/^([A-Za-z0-9_]+)\s*=\s*(.+)$/);
    if (!assignment) continue;
    const key = assignment[1];
    if (values.has(key)) {
      throw new Error(`[env] repeats ${key}`);
    }
    let value = assignment[2].trim();
    if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    values.set(key, value);
  }
  return values;
}

export function parseFlyEnvFile(filePath) {
  return parseFlyEnv(fs.readFileSync(filePath, 'utf8'));
}
