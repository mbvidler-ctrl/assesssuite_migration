#!/usr/bin/env node

import { Resolver } from 'node:dns/promises';
import { pathToFileURL } from 'node:url';

const DEFAULT_DOMAIN = 'assesssuite.com';
const ABSENT_DNS_CODES = new Set(['ENODATA', 'ENOTFOUND', 'ENOENT']);

function normalizeDomain(value) {
  const domain = String(value || '').trim().toLowerCase().replace(/\.$/, '');
  if (!domain || domain.length > 253 || !domain.includes('.')) {
    throw new Error(`invalid domain: ${JSON.stringify(value)}`);
  }
  for (const label of domain.split('.')) {
    if (!/^(?!-)[a-z0-9-]{1,63}(?<!-)$/.test(label)) {
      throw new Error(`invalid domain: ${JSON.stringify(value)}`);
    }
  }
  return domain;
}

function flattenTxt(records = []) {
  return records.map((fragments) => fragments.join('').trim()).filter(Boolean);
}

async function resolveOrEmpty(query, name) {
  try {
    return { records: await query(name), error: null };
  } catch (error) {
    if (ABSENT_DNS_CODES.has(error?.code)) return { records: [], error: null };
    return { records: [], error: `${error?.code || error?.name || 'DNS_ERROR'}: ${error?.message || error}` };
  }
}

export async function checkEmailDns(domainInput, resolver = new Resolver()) {
  const domain = normalizeDomain(domainInput);
  const names = {
    dmarc: `_dmarc.${domain}`,
    send: `send.${domain}`,
    dkim: `resend._domainkey.${domain}`,
  };

  const [dmarcResult, sendTxtResult, sendMxResult, dkimResult] = await Promise.all([
    resolveOrEmpty((name) => resolver.resolveTxt(name), names.dmarc),
    resolveOrEmpty((name) => resolver.resolveTxt(name), names.send),
    resolveOrEmpty((name) => resolver.resolveMx(name), names.send),
    resolveOrEmpty((name) => resolver.resolveTxt(name), names.dkim),
  ]);

  const dmarcRecords = flattenTxt(dmarcResult.records)
    .filter((record) => /^v\s*=\s*dmarc1(?:\s*;|$)/i.test(record));
  const sendTxtRecords = flattenTxt(sendTxtResult.records);
  const sendSpfRecords = sendTxtRecords
    .filter((record) => /^v\s*=\s*spf1(?:\s|$)/i.test(record));
  const dkimRecords = flattenTxt(dkimResult.records);

  const checks = [
    {
      id: 'dmarc',
      name: names.dmarc,
      ok: !dmarcResult.error && dmarcRecords.length === 1,
      detail: dmarcResult.error
        || `found ${dmarcRecords.length} DMARC record(s); exactly 1 required`,
    },
    {
      id: 'send-spf',
      name: names.send,
      ok: !sendTxtResult.error
        && sendSpfRecords.some((record) => /(?:^|\s)include:amazonses\.com(?:\s|$)/i.test(record)),
      detail: sendTxtResult.error
        || `found ${sendSpfRecords.length} SPF record(s); require include:amazonses.com`,
    },
    {
      id: 'send-mx',
      name: names.send,
      ok: !sendMxResult.error && sendMxResult.records.length > 0,
      detail: sendMxResult.error
        || `found ${sendMxResult.records.length} MX record(s); at least 1 required`,
    },
    {
      id: 'resend-dkim',
      name: names.dkim,
      ok: !dkimResult.error && dkimRecords.length > 0,
      detail: dkimResult.error
        || `found ${dkimRecords.length} TXT record(s); at least 1 required`,
    },
  ];

  return { domain, ok: checks.every((check) => check.ok), checks };
}

function configuredDomain(argv, environment) {
  const args = argv.slice(2);
  if (args[0] === '--domain') {
    if (!args[1] || args.length > 2) throw new Error('usage: check-email-dns.mjs [domain]');
    return args[1];
  }
  if (args.length > 1) throw new Error('usage: check-email-dns.mjs [domain]');
  return args[0] || environment.EMAIL_DOMAIN || DEFAULT_DOMAIN;
}

export async function main(argv = process.argv, environment = process.env, resolver) {
  let report;
  try {
    report = await checkEmailDns(configuredDomain(argv, environment), resolver);
  } catch (error) {
    console.error(`[email-dns] FAIL - ${error.message}`);
    return 2;
  }

  console.log(`[email-dns] ${report.ok ? 'PASS' : 'FAIL'} - ${report.domain}`);
  for (const check of report.checks) {
    console.log(`  ${check.ok ? 'PASS' : 'FAIL'} ${check.id} (${check.name}): ${check.detail}`);
  }
  return report.ok ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main();
}
