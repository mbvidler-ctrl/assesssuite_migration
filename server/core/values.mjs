import { CoreContractError } from './errors.mjs';

const OPAQUE_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const MACHINE_IDENTIFIER_RE = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;

export function assertPlainObject(value, field) {
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    throw new CoreContractError('CORE_INVALID_OBJECT', `${field} must be a plain object`);
  }
  return value;
}

export function assertExactKeys(value, { allowed, required = [], field }) {
  assertPlainObject(value, field);
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!allowedSet.has(key)) {
      throw new CoreContractError('CORE_UNKNOWN_FIELD', `${field} contains an unsupported field`);
    }
  }
  for (const key of required) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      throw new CoreContractError('CORE_REQUIRED_FIELD', `${field}.${key} is required`);
    }
  }
  return value;
}

export function assertOpaqueId(value, field, { nullable = false } = {}) {
  if (nullable && (value === null || value === undefined)) return null;
  if (typeof value !== 'string' || !OPAQUE_ID_RE.test(value)) {
    throw new CoreContractError('CORE_INVALID_ID', `${field} must be an opaque identifier`);
  }
  return value;
}

export function assertMachineIdentifier(value, field, { maxLength = 96 } = {}) {
  if (
    typeof value !== 'string' ||
    value.length > maxLength ||
    !MACHINE_IDENTIFIER_RE.test(value)
  ) {
    throw new CoreContractError(
      'CORE_INVALID_MACHINE_IDENTIFIER',
      `${field} must be a machine identifier`,
    );
  }
  return value;
}

export function assertEnum(value, allowedValues, field) {
  if (!allowedValues.includes(value)) {
    throw new CoreContractError('CORE_INVALID_STATE', `${field} is not an allowed value`);
  }
  return value;
}

export function assertIsoTimestamp(value, field) {
  if (typeof value !== 'string') {
    throw new CoreContractError('CORE_INVALID_TIMESTAMP', `${field} must be an ISO timestamp`);
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) {
    throw new CoreContractError(
      'CORE_INVALID_TIMESTAMP',
      `${field} must use canonical ISO-8601 UTC form`,
    );
  }
  return value;
}

export function uniqueOpaqueIds(values, field) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new CoreContractError('CORE_INVALID_SCOPE', `${field} must contain at least one identifier`);
  }
  const normalized = values.map((value, index) => assertOpaqueId(value, `${field}[${index}]`));
  const unique = [...new Set(normalized)];
  if (unique.length !== normalized.length) {
    throw new CoreContractError('CORE_DUPLICATE_SCOPE', `${field} must not contain duplicates`);
  }
  return unique;
}

export function optionalMachineIdentifier(value, field) {
  return value === undefined || value === null
    ? null
    : assertMachineIdentifier(value, field);
}
