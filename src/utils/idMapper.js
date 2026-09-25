/**
 * ID Mapper & Validation Utilities
 * Step 6.6 — Database Integration Hardening (DB-AUD-03)
 *
 * Provides identifier validation and parsing for UUIDs and business codes.
 * Ensures invalid identifier inputs yield controlled HTTP 400 Bad Request errors
 * before reaching PostgreSQL queries.
 *
 * Layer Dependency:
 *   idMapper → errors/BadRequestError
 */

const { BadRequestError } = require('../errors');

// Standard UUID regex (v1-v7)
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-7][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Business code regex (alphanumeric, hyphens, underscores, 2-50 chars)
const CODE_REGEX = /^[A-Z0-9_\-]{2,50}$/i;

/**
 * Test whether a string is a valid UUID.
 * @param {string} str
 * @returns {boolean}
 */
function validateUUID(str) {
  if (!str || typeof str !== 'string') return false;
  return UUID_REGEX.test(str.trim());
}

/**
 * Test whether a string is a valid business code.
 * @param {string} str
 * @returns {boolean}
 */
function validateCode(str) {
  if (!str || typeof str !== 'string') return false;
  return CODE_REGEX.test(str.trim());
}

/**
 * Parse an incoming identifier parameter (UUID or code).
 * Returns { type: 'UUID'|'CODE', value: string }.
 * Throws BadRequestError (400) if format is invalid.
 *
 * @param {string} input Incoming identifier parameter
 * @param {string} [entityName='Identifier'] Entity label for error message
 * @returns {{ type: 'UUID'|'CODE', value: string }}
 */
function parseIdOrCode(input, entityName = 'Identifier') {
  if (!input || typeof input !== 'string') {
    throw new BadRequestError(`${entityName} parameter is required`);
  }

  const trimmed = input.trim();

  if (validateUUID(trimmed)) {
    return { type: 'UUID', value: trimmed };
  }

  if (validateCode(trimmed)) {
    return { type: 'CODE', value: trimmed };
  }

  throw new BadRequestError(`Invalid ${entityName} format: '${input}'`);
}

module.exports = {
  validateUUID,
  validateCode,
  parseIdOrCode,
};
