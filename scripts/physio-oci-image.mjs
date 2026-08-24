#!/usr/bin/env node

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const fail = (message) => {
  throw new Error(`Physio OCI image contract: ${message}`);
};

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

function option(name) {
  const index = process.argv.indexOf(`--${name}`);
  if (index < 0 || !process.argv[index + 1]) fail(`missing --${name}`);
  return process.argv[index + 1];
}

function exactObject(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
      || JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...keys].sort())) {
    fail(`${label} keys differ`);
  }
}

function digestBlob(layout, descriptor, label) {
  exactObject(descriptor, ['mediaType', 'digest', 'size'], label);
  if (!/^sha256:[0-9a-f]{64}$/.test(descriptor.digest)
      || !Number.isSafeInteger(descriptor.size) || descriptor.size <= 0) {
    fail(`${label} descriptor differs`);
  }
  const file = path.join(layout, 'blobs', 'sha256', descriptor.digest.slice(7));
  if (!fs.statSync(file, { throwIfNoEntry: false })?.isFile() || fs.lstatSync(file).isSymbolicLink()) {
    fail(`${label} blob is absent or unsafe`);
  }
  const bytes = fs.readFileSync(file);
  if (bytes.length !== descriptor.size || `sha256:${sha256(bytes)}` !== descriptor.digest) {
    fail(`${label} blob digest or size differs`);
  }
  return { file, bytes };
}

function inspectLayout({ layout, tag, applicationSha, localImageId }) {
  const root = path.resolve(layout);
  if (!/^[-A-Za-z0-9._]{1,128}$/.test(tag)) fail('tag differs');
  if (!/^[0-9a-f]{40}$/.test(applicationSha)) fail('application SHA differs');
  if (!/^sha256:[0-9a-f]{64}$/.test(localImageId)) fail('local image ID differs');
  exactObject(readJson(path.join(root, 'oci-layout')), ['imageLayoutVersion'], 'oci-layout');
  if (readJson(path.join(root, 'oci-layout')).imageLayoutVersion !== '1.0.0') fail('OCI layout version differs');
  const index = readJson(path.join(root, 'index.json'));
  exactObject(index, ['schemaVersion', 'mediaType', 'manifests'], 'index');
  if (index.schemaVersion !== 2
      || index.mediaType !== 'application/vnd.oci.image.index.v1+json'
      || !Array.isArray(index.manifests) || index.manifests.length !== 1) {
    fail('OCI index must contain exactly one manifest');
  }
  const indexDescriptor = index.manifests[0];
  exactObject(indexDescriptor, ['annotations', 'digest', 'mediaType', 'size'], 'index manifest');
  if (indexDescriptor.annotations?.['org.opencontainers.image.ref.name'] !== tag
      || indexDescriptor.mediaType !== 'application/vnd.oci.image.manifest.v1+json') {
    fail('OCI index tag or media type differs');
  }
  const manifestBlob = digestBlob(root, {
    mediaType: indexDescriptor.mediaType,
    digest: indexDescriptor.digest,
    size: indexDescriptor.size,
  }, 'manifest');
  const manifest = JSON.parse(manifestBlob.bytes.toString('utf8'));
  exactObject(manifest, ['schemaVersion', 'mediaType', 'config', 'layers'], 'manifest');
  if (manifest.schemaVersion !== 2 || manifest.mediaType !== indexDescriptor.mediaType
      || !Array.isArray(manifest.layers) || manifest.layers.length < 1) {
    fail('OCI manifest differs');
  }
  if (manifest.config.mediaType !== 'application/vnd.oci.image.config.v1+json'
      || manifest.config.digest !== localImageId) {
    fail('OCI config is not the canary-proven local image config');
  }
  const configBlob = digestBlob(root, manifest.config, 'config');
  const config = JSON.parse(configBlob.bytes.toString('utf8'));
  if (config.os !== 'linux' || config.architecture !== 'amd64'
      || config.config?.Labels?.['org.opencontainers.image.revision'] !== applicationSha
      || config.config?.Labels?.['com.assesssuite.profession'] !== 'physio'
      || config.config?.Labels?.['com.assesssuite.app-id'] !== 'local-assesssuite-physio'
      || !Array.isArray(config.rootfs?.diff_ids)
      || config.rootfs.diff_ids.length !== manifest.layers.length) {
    fail('OCI config identity, platform, or layer relation differs');
  }
  const layers = manifest.layers.map((descriptor, indexValue) => {
    if (descriptor.mediaType !== 'application/vnd.oci.image.layer.v1.tar+gzip') {
      fail(`layer ${indexValue} media type differs`);
    }
    digestBlob(root, descriptor, `layer ${indexValue}`);
    return { media_type: descriptor.mediaType, digest: descriptor.digest, size: descriptor.size };
  });
  return {
    contract_version: 'assesssuite-physio-oci-descriptors/1.0.0',
    result: 'PASS',
    application: 'assesssuite-physio-production',
    application_sha: applicationSha,
    profession_id: 'physio',
    tag,
    manifest_media_type: indexDescriptor.mediaType,
    manifest_digest: indexDescriptor.digest,
    manifest_size: indexDescriptor.size,
    manifest_raw_sha256: sha256(manifestBlob.bytes),
    config: {
      media_type: manifest.config.mediaType,
      digest: manifest.config.digest,
      size: manifest.config.size,
      raw_sha256: sha256(configBlob.bytes),
    },
    layers,
    local_image_id: localImageId,
  };
}

function stable(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function parseHeaders(file, expectedStatus) {
  const text = fs.readFileSync(file, 'utf8').replaceAll('\r\n', '\n');
  const lines = text.split('\n').filter(Boolean);
  const statusLines = lines.filter((line) => /^HTTP\/[0-9.]+\s+[0-9]{3}(?:\s|$)/i.test(line));
  if (statusLines.length !== 1) fail('registry response contains an ambiguous status chain');
  const match = statusLines[0].match(/^HTTP\/[0-9.]+\s+([0-9]{3})(?:\s|$)/i);
  if (!match || Number(match[1]) !== expectedStatus) fail('registry response status differs');
  const values = new Map();
  for (const line of lines.slice(1)) {
    const separator = line.indexOf(':');
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    const rows = values.get(key) ?? [];
    rows.push(value);
    values.set(key, rows);
  }
  return { status: expectedStatus, values };
}

function oneHeader(headers, name) {
  const rows = headers.values.get(name) ?? [];
  if (rows.length !== 1 || !rows[0]) fail(`registry ${name} header differs`);
  return rows[0];
}

function verifyRegistryReadback({ headHeaders, headStatus, getHeaders, getStatus, body, descriptors, receipt, mode }) {
  const head = parseHeaders(headHeaders, headStatus);
  const get = parseHeaders(getHeaders, getStatus);
  const raw = fs.readFileSync(body);
  if (raw.length <= 0 || raw.length > 4 * 1024 * 1024) fail('registry response body size differs');
  if (mode === 'absent') {
    if (headStatus !== 404 || getStatus !== 404) fail('registry absence requires exact HEAD and GET 404');
    const payload = JSON.parse(raw.toString('utf8'));
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)
        || !Array.isArray(payload.errors) || payload.errors.length !== 1
        || !['MANIFEST_UNKNOWN', 'NAME_UNKNOWN'].includes(payload.errors[0]?.code)) {
      fail('registry absence body is not exact MANIFEST_UNKNOWN or NAME_UNKNOWN');
    }
    fs.writeFileSync(receipt, stable({
      contract_version: 'assesssuite-registry-protocol-readback/1.0.0',
      result: 'ABSENT_EXACT_HEAD_GET_404',
      provider_error_code: payload.errors[0].code,
      head_headers_sha256: sha256(fs.readFileSync(headHeaders)),
      get_headers_sha256: sha256(fs.readFileSync(getHeaders)),
      get_body_sha256: sha256(raw),
    }), { flag: 'wx', mode: 0o600 });
    return;
  }
  if (mode !== 'present' || headStatus !== 200 || getStatus !== 200) {
    fail('registry present readback requires exact HEAD and GET 200');
  }
  const source = readJson(descriptors);
  const digest = oneHeader(head, 'docker-content-digest');
  const headLength = oneHeader(head, 'content-length');
  const headType = oneHeader(head, 'content-type').split(';', 1)[0].trim();
  const getDigest = oneHeader(get, 'docker-content-digest');
  const getLength = oneHeader(get, 'content-length');
  const getType = oneHeader(get, 'content-type').split(';', 1)[0].trim();
  if (digest !== source.manifest_digest || getDigest !== digest
      || headLength !== String(source.manifest_size) || getLength !== headLength
      || headType !== source.manifest_media_type || getType !== headType
      || raw.length !== source.manifest_size || `sha256:${sha256(raw)}` !== source.manifest_digest) {
    fail('registry descriptor triple or raw manifest bytes differ from frozen OCI descriptor');
  }
  const manifest = JSON.parse(raw.toString('utf8'));
  if (manifest.mediaType !== source.manifest_media_type
      || manifest.config?.digest !== source.config.digest
      || JSON.stringify(manifest.layers?.map(({ mediaType, digest: layerDigest, size }) => ({
        media_type: mediaType, digest: layerDigest, size,
      }))) !== JSON.stringify(source.layers)) {
    fail('registry manifest descriptor graph differs');
  }
  fs.writeFileSync(receipt, stable({
    contract_version: 'assesssuite-registry-protocol-readback/1.0.0',
    result: 'PRESENT_EXACT_DESCRIPTOR',
    manifest_digest: digest,
    manifest_size: Number(headLength),
    manifest_media_type: headType,
    head_headers_sha256: sha256(fs.readFileSync(headHeaders)),
    get_headers_sha256: sha256(fs.readFileSync(getHeaders)),
    get_body_sha256: sha256(raw),
  }), { flag: 'wx', mode: 0o600 });
}

const command = process.argv[2];
if (command === 'write-descriptors') {
  const receipt = option('receipt');
  const row = inspectLayout({
    layout: option('layout'),
    tag: option('tag'),
    applicationSha: option('application-sha'),
    localImageId: option('local-image-id'),
  });
  fs.writeFileSync(receipt, stable(row), { flag: 'wx', mode: 0o600 });
  process.stdout.write(`${row.manifest_digest}\n`);
} else if (command === 'verify-descriptors') {
  const receipt = option('receipt');
  const expected = readJson(receipt);
  const actual = inspectLayout({
    layout: option('layout'),
    tag: option('tag'),
    applicationSha: option('application-sha'),
    localImageId: option('local-image-id'),
  });
  if (stable(actual) !== stable(expected)) fail('descriptor receipt differs from OCI layout');
  process.stdout.write(`${actual.manifest_digest}\n`);
} else if (command === 'verify-registry-readback') {
  verifyRegistryReadback({
    headHeaders: option('head-headers'),
    headStatus: Number(option('head-status')),
    getHeaders: option('get-headers'),
    getStatus: Number(option('get-status')),
    body: option('body'),
    descriptors: option('descriptors'),
    receipt: option('receipt'),
    mode: option('mode'),
  });
} else {
  fail('command must be write-descriptors, verify-descriptors, or verify-registry-readback');
}
