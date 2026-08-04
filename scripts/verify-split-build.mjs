#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const landingRoot = path.join(repoRoot, 'apps', 'landing', 'dist');
const platformRoot = path.join(repoRoot, 'dist');
const landingUsageEndpoint = 'https://app.assesssuite.com/api/usage/page-load';

const fail = (message) => {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
};

function assertDirectory(directory, label) {
  if (!fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) {
    fail(`${label} artifact is missing at ${path.relative(repoRoot, directory)}`);
    return false;
  }
  return true;
}

function artifactText(directory) {
  const extensions = new Set(['.css', '.html', '.js', '.json', '.map', '.mjs', '.txt']);
  const contents = [];
  const visit = (candidate) => {
    for (const entry of fs.readdirSync(candidate, { withFileTypes: true })) {
      const resolved = path.join(candidate, entry.name);
      if (entry.isDirectory()) visit(resolved);
      else if (extensions.has(path.extname(entry.name))) contents.push(fs.readFileSync(resolved, 'utf8'));
    }
  };
  visit(directory);
  return contents.join('\n');
}

const landingReady = assertDirectory(landingRoot, 'landing');
const platformReady = assertDirectory(platformRoot, 'platform');

if (landingReady) {
  const landing = artifactText(landingRoot);
  const usageEndpointOccurrences = landing.split(landingUsageEndpoint).length - 1;
  if (usageEndpointOccurrences !== 1) {
    fail(`landing artifact must contain exactly one approved usage endpoint; found ${usageEndpointOccurrences}`);
  }

  // Remove the one approved, bodyless usage sentinel before applying the
  // blanket backend-marker prohibition. Any other API path still fails.
  const landingWithoutApprovedUsageEndpoint = landing.replace(landingUsageEndpoint, '');
  const bannedLandingMarkers = [
    ['/api/', 'API route marker'],
    ['/functions/', 'function route marker'],
    ['X-App-Id', 'application authorization header marker'],
    ['/api/apps/', 'Base44 API client route marker'],
    ['Bearer ${', 'bearer-token construction marker'],
    ['local-assesssuite', 'authenticated application id'],
    ['appLogs', 'authenticated application logging marker'],
    ['AuthProvider', 'authentication provider'],
    ['media.base44.com', 'external Base44 media dependency'],
    ['fonts.googleapis.com', 'external Google Fonts dependency'],
    ['fonts.gstatic.com', 'external Google Fonts asset dependency'],
    ['AssessSuite Website Terms of Use', 'draft website-terms title'],
    ['The proposed website operator is Assess Suite Pty Ltd', 'draft website-terms content'],
    ['AssessSuite Vulnerability Disclosure Policy', 'draft vulnerability-disclosure title'],
    ['current absence of `/.well-known/security.txt`', 'draft vulnerability-disclosure content'],
  ];

  for (const [marker, label] of bannedLandingMarkers) {
    if (landingWithoutApprovedUsageEndpoint.includes(marker)) {
      fail(`landing artifact contains ${label}: ${marker}`);
    }
  }

  if (!landing.includes('https://app.assesssuite.com')) {
    fail('landing artifact does not contain the secure application origin');
  }

  for (const marker of [
    '@font-face',
    'Plus Jakarta Sans',
    'font-display:swap',
    '/fonts/plus-jakarta-sans/PlusJakartaSans-Variable.woff2',
  ]) {
    if (!landing.includes(marker)) fail(`landing artifact is missing local font marker: ${marker}`);
  }

  const landingFont = path.join(
    landingRoot,
    'fonts',
    'plus-jakarta-sans',
    'PlusJakartaSans-Variable.woff2',
  );
  if (!fs.existsSync(landingFont) || !fs.statSync(landingFont).isFile()) {
    fail('landing artifact is missing the self-hosted Plus Jakarta Sans font');
  } else {
    const font = fs.readFileSync(landingFont);
    if (font.length === 0 || font.subarray(0, 4).toString('ascii') !== 'wOF2') {
      fail('landing Plus Jakarta Sans asset is not a valid non-empty WOFF2 file');
    }
  }
}

if (platformReady) {
  const platform = artifactText(platformRoot);
  const bannedPlatformMarkers = [
    ['/_vercel/insights', 'Vercel Web Analytics intake path'],
    ['va.vercel-scripts.com', 'Vercel Web Analytics script host'],
  ];

  for (const [marker, label] of bannedPlatformMarkers) {
    if (platform.includes(marker)) fail(`platform artifact contains ${label}: ${marker}`);
  }
}

if (!process.exitCode) {
  console.log('PASS: compiled landing and platform artifacts preserve the split-hosting boundary.');
}
