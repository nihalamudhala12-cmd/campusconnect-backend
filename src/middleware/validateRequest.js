/**
 * Request Validation Middleware
 * Step 6.1 — Backend Foundation
 *
 * Provides a reusable validation wrapper for req.body, req.query, and req.params.
 * Schema parameter can be:
 *   1. A function: (req) => { valid: boolean, errors: [{ field, message }] }
 *   2. An object with body/query/params functions or rules:
 *      {
 *        body: (body) => errors[],
 *        query: (query) => errors[],
 *        params: (params) => errors[],
 *      }
 *
 * Forwards validation failures to Express error middleware as a ValidationError (422).
 */

const { ValidationError } = require('../errors');

/**
 * Validate incoming request against a schema definition.
 *
 * @param {Function|object} schema
 * @returns {Function} Express middleware function
 */
function validateRequest(schema) {
  return (req, _res, next) => {
    if (!schema) return next();

    const errors = [];

    if (typeof schema === 'function') {
      const result = schema(req);
      if (result) {
        if (Array.isArray(result.errors)) {
          errors.push(...result.errors);
        } else if (typeof result.error === 'string') {
          errors.push({ message: result.error });
        } else if (result.valid === false && result.message) {
          errors.push({ message: result.message });
        }
      }
    } else if (typeof schema === 'object') {
      if (typeof schema.body === 'function') {
        const bodyErrors = schema.body(req.body || {});
        if (Array.isArray(bodyErrors)) errors.push(...bodyErrors);
      }
      if (typeof schema.query === 'function') {
        const queryErrors = schema.query(req.query || {});
        if (Array.isArray(queryErrors)) errors.push(...queryErrors);
      }
      if (typeof schema.params === 'function') {
        const paramsErrors = schema.params(req.params || {});
        if (Array.isArray(paramsErrors)) errors.push(...paramsErrors);
      }
    }

    if (errors.length > 0) {
      return next(new ValidationError('Validation failed', errors));
    }

    next();
  };
}

module.exports = validateRequest;
