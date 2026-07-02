// Mongo-style filter evaluator, sort, and projection helpers for the local shim.
// Supports: equality, $in, $nin, $ne, $gt, $gte, $lt, $lte, $exists, $regex
// (with $options 'i'), $or, $and, and dot-path nested fields.

/**
 * Resolves a dot-path (e.g. "a.b.c") against a record, returning undefined
 * where any intermediate segment is missing.
 */
function getPath(record, path) {
  const segments = path.split('.');
  let current = record;
  for (const segment of segments) {
    if (current === null || current === undefined) return undefined;
    current = current[segment];
  }
  return current;
}

/**
 * Evaluates a single operator object (e.g. { $gt: 5, $lt: 10 }) against a value.
 */
function evaluateOperators(value, operators) {
  for (const [op, operand] of Object.entries(operators)) {
    switch (op) {
      case '$in':
        if (!Array.isArray(operand) || !operand.some((candidate) => looseEquals(value, candidate))) {
          return false;
        }
        break;
      case '$nin':
        if (Array.isArray(operand) && operand.some((candidate) => looseEquals(value, candidate))) {
          return false;
        }
        break;
      case '$ne':
        if (looseEquals(value, operand)) return false;
        break;
      case '$gt':
        if (!(value > operand)) return false;
        break;
      case '$gte':
        if (!(value >= operand)) return false;
        break;
      case '$lt':
        if (!(value < operand)) return false;
        break;
      case '$lte':
        if (!(value <= operand)) return false;
        break;
      case '$exists': {
        const exists = value !== undefined;
        if (exists !== Boolean(operand)) return false;
        break;
      }
      case '$regex': {
        const flags = operators.$options || '';
        const pattern = operand instanceof RegExp ? operand.source : String(operand);
        const regex = new RegExp(pattern, flags);
        if (typeof value !== 'string' || !regex.test(value)) return false;
        break;
      }
      case '$options':
        // Handled alongside $regex above.
        break;
      default:
        // Unknown operator: fail closed rather than silently matching.
        return false;
    }
  }
  return true;
}

function looseEquals(a, b) {
  if (a instanceof Date || b instanceof Date) {
    return new Date(a).getTime() === new Date(b).getTime();
  }
  return a === b;
}

function isOperatorObject(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).some((key) => key.startsWith('$'))
  );
}

/**
 * Evaluates a single field condition against a record.
 */
function evaluateFieldCondition(record, field, condition) {
  const value = getPath(record, field);
  if (isOperatorObject(condition)) {
    return evaluateOperators(value, condition);
  }
  return looseEquals(value, condition);
}

/**
 * Evaluates a full Mongo-style query object against a record.
 * Supports top-level $or / $and combinators alongside flat field conditions.
 */
export function matchesQuery(record, query) {
  if (!query || typeof query !== 'object') return true;

  for (const [key, condition] of Object.entries(query)) {
    if (key === '$or') {
      if (!Array.isArray(condition) || !condition.some((sub) => matchesQuery(record, sub))) {
        return false;
      }
      continue;
    }
    if (key === '$and') {
      if (!Array.isArray(condition) || !condition.every((sub) => matchesQuery(record, sub))) {
        return false;
      }
      continue;
    }
    if (!evaluateFieldCondition(record, key, condition)) {
      return false;
    }
  }
  return true;
}

/**
 * Parses a sort spec ("-created_date" or "created_date,-name") into a
 * comparator function.
 */
export function buildComparator(sortSpec) {
  if (!sortSpec) return null;
  const fields = String(sortSpec)
    .split(',')
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((raw) => {
      if (raw.startsWith('-')) return { field: raw.slice(1), direction: -1 };
      return { field: raw, direction: 1 };
    });
  if (fields.length === 0) return null;

  return (a, b) => {
    for (const { field, direction } of fields) {
      const av = getPath(a, field);
      const bv = getPath(b, field);
      if (av === bv) continue;
      if (av === undefined || av === null) return 1 * direction;
      if (bv === undefined || bv === null) return -1 * direction;
      if (av < bv) return -1 * direction;
      if (av > bv) return 1 * direction;
    }
    return 0;
  };
}

/**
 * Applies sort, skip, and limit to an array of records (in that order).
 */
export function applySortSkipLimit(records, { sort, skip, limit } = {}) {
  let result = records.slice();
  const comparator = buildComparator(sort);
  if (comparator) result.sort(comparator);
  const skipNum = Number(skip) || 0;
  if (skipNum > 0) result = result.slice(skipNum);
  const limitNum = Number(limit);
  if (Number.isFinite(limitNum) && limitNum > 0) result = result.slice(0, limitNum);
  return result;
}

/**
 * Applies a fields projection (comma-joined string or array of field names).
 * Platform built-ins (id, created_date, updated_date, created_by) are always
 * retained regardless of projection.
 */
export function applyProjection(record, fields) {
  if (!fields) return record;
  const fieldList = Array.isArray(fields) ? fields : String(fields).split(',');
  const wanted = new Set(fieldList.map((f) => f.trim()).filter(Boolean));
  if (wanted.size === 0) return record;
  const alwaysKeep = ['id', 'created_date', 'updated_date', 'created_by'];
  const projected = {};
  for (const key of Object.keys(record)) {
    if (wanted.has(key) || alwaysKeep.includes(key)) {
      projected[key] = record[key];
    }
  }
  return projected;
}
