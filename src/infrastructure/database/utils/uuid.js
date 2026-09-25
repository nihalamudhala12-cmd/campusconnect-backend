/**
 * UUID Generation Utility for CampusConnect
 * Step 6.5 — Database Design
 *
 * PURPOSE
 *   Provides UUID generation at the application boundary.
 *   PostgreSQL does not natively support UUIDv7 generation.
 *   This module generates UUIDv7 compliant identifiers in application code
 *   before INSERT operations.
 *
 * UUID STRATEGY
 *   - Primary keys use UUIDv7 (time-ordered, database-independent)
 *   - Generation happens in application code (Node.js) before INSERT
 *   - No database extension or native function is claimed
 *
 * SCOPE
 *   - Generate UUIDv7 for all entity primary keys
 *   - All entities use the same generation mechanism
 *
 * OUT OF SCOPE
 *   - Database-level UUID generation (not available natively for v7)
 *   - Migration of existing data to UUIDv7
 */

/**
 * Validate UUIDv7 format
 * @param {string} uuid - UUID string to validate
 * @returns {boolean} True if valid UUIDv7 format
 */
function isValidUUIDv7(uuid) {
  if (!uuid || typeof uuid !== 'string') return false;

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(uuid)) return false;

  // Extract version byte (should be 7 for UUIDv7)
  const version = parseInt(uuid[14], 16);
  return version === 7;
}

/**
 * Generate a UUIDv7 (time-ordered UUID)
 * Based on draft-ietf-uuidrev-rfc4122bis
 *
 * @returns {string} UUIDv7 string in standard format (xxxxxxxx-xxxx-7xxx-yxxx-xxxxxxxxxxxx)
 * @throws {Error} If crypto.getRandomValues is not available
 */
function generateUUIDv7() {
  if (typeof crypto === 'undefined' || !crypto.getRandomValues) {
    throw new Error('crypto.getRandomValues is not available in this environment');
  }

  const now = Date.now();
  // Convert to hex without padding first
  const timestampHex = now.toString(16);

  // Get random bytes (8 bytes needed for node portion + 2 for clock_seq)
  const randomBytes = new Uint8Array(8);
  crypto.getRandomValues(randomBytes);

  // UUIDv7 structure (RFC 4122):
  // time_low (8 hex) - time_mid (4 hex) - time_high_and_version (4 hex)
  // - clock_seq_and_reserved (2 hex) + clock_seq_low (2 hex) - node (12 hex)
  //
  // Timestamp: 48 bits (6 bytes) = 12 hex chars
  // Current Date.now() produces 11 hex chars; pad to 12 for 48-bit alignment
  const paddedTimestamp = timestampHex.padStart(12, '0');

  const timeLow = paddedTimestamp.substring(0, 8);
  const timeMid = paddedTimestamp.substring(8, 12);
  // time_high_and_ver = version (7) in upper 4 bits, lower 12 bits are 0
  const timeHighAndVer = '7000';

  // clock_seq: 6 bits from random + 2 bits variant (10) + 8 bits random
  const clockSeq = (((randomBytes[0] & 0x3F) | 0x80).toString(16).padStart(2, '0')) +
                    randomBytes[1].toString(16).padStart(2, '0');

  // node: 48 bits of pseudo-random (UUIDv7 uses all random, not IEEE MAC)
  const node = (randomBytes[2] & 0xFF).toString(16).padStart(2, '0') +
               (randomBytes[3] & 0xFF).toString(16).padStart(2, '0') +
               (randomBytes[4] & 0xFF).toString(16).padStart(2, '0') +
               (randomBytes[5] & 0xFF).toString(16).padStart(2, '0') +
               (randomBytes[6] & 0xFF).toString(16).padStart(2, '0') +
               (randomBytes[7] & 0xFF).toString(16).padStart(2, '0');

  const uuid = `${timeLow}-${timeMid}-${timeHighAndVer}-${clockSeq}-${node}`;

  // Validate the generated UUID
  if (!isValidUUIDv7(uuid)) {
    throw new Error('Generated UUID failed validation');
  }

  return uuid;
}

/**
 * Generate multiple UUIDv7 values
 * @param {number} count - Number of UUIDs to generate
 * @returns {string[]} Array of UUIDv7 strings
 */
function generateUUIDv7Batch(count) {
  const uuids = [];
  for (let i = 0; i < count; i++) {
    uuids.push(generateUUIDv7());
  }
  return uuids;
}

module.exports = {
  generateUUIDv7,
  generateUUIDv7Batch,
  isValidUUIDv7
};
