/**
 * Stable, content-free error used at the Core boundary.
 *
 * `code` is safe to persist in an audit event or return through an API. The
 * error never retains the rejected payload, which prevents clinical content
 * from being copied into logs by an outer error handler.
 */
export class CoreContractError extends Error {
  constructor(code, message, { httpStatus = 400, cause } = {}) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'CoreContractError';
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export function failContract(code, message, options) {
  throw new CoreContractError(code, message, options);
}
