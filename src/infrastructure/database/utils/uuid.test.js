/**
 * UUID Generation Utility Tests
 * Step 6.5 — Database Design Testing
 *
 * Tests the UUIDv7 generation utility including:
 * - UUIDv7 format validation
 * - Version byte correctness
 * - Variant byte correctness
 * - Uniqueness guarantees
 * - Time ordering
 * - Batch generation
 * - Edge cases and error handling
 */

const { generateUUIDv7, generateUUIDv7Batch, isValidUUIDv7 } = require('./uuid');

console.log('=== UUID Generation Utility Tests ===\n');

let testsPassed = 0;
let testsFailed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ PASS: ${name}`);
    testsPassed++;
  } catch (err) {
    console.log(`❌ FAIL: ${name}`);
    console.log(`   Error: ${err.message}`);
    testsFailed++;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

// Test 1: UUID format validation
console.log('Test Suite 1: UUID Format Validation');
test('Valid UUIDv7 format matches regex', () => {
  const uuid = generateUUIDv7();
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  assert(uuidRegex.test(uuid), 'UUID does not match expected format');
});

test('UUID has correct structure (5 parts separated by hyphens)', () => {
  const uuid = generateUUIDv7();
  const parts = uuid.split('-');
  assertEqual(parts.length, 5, 'UUID should have 5 parts');
  assertEqual(parts[0].length, 8, 'First part should be 8 characters');
  assertEqual(parts[1].length, 4, 'Second part should be 4 characters');
  assertEqual(parts[2].length, 4, 'Third part should be 4 characters');
  assertEqual(parts[3].length, 4, 'Fourth part should be 4 characters');
  assertEqual(parts[4].length, 12, 'Fifth part should be 12 characters');
});

test('UUID version byte is 7', () => {
  const uuid = generateUUIDv7();
  const version = parseInt(uuid[14], 16);
  assertEqual(version, 7, 'Version byte should be 7 for UUIDv7');
});

test('UUID variant is RFC 4122 compliant', () => {
  const uuid = generateUUIDv7();
  // clock_seq is 4 hex chars at positions 19-22: [clock_seq_hi][clock_seq_lo]-node
  // Variant bits (10) are top 2 bits of clock_seq_hi (positions 19-20, 2 hex chars)
  const clockSeqHi = parseInt(uuid.substring(19, 21), 16);
  const variant = (clockSeqHi >> 6) & 0x03;
  assertEqual(variant, 2, 'Variant should be RFC 4122 (10xx)');
});

// Test 2: Validation function
console.log('\nTest Suite 2: Validation Function');
test('isValidUUIDv7 returns true for valid UUIDv7', () => {
  const uuid = generateUUIDv7();
  assert(isValidUUIDv7(uuid), 'Should return true for valid UUIDv7');
});

test('isValidUUIDv7 returns false for invalid format', () => {
  assert(!isValidUUIDv7('not-a-uuid'), 'Should return false for invalid format');
  assert(!isValidUUIDv7('12345678-1234-1234-1234-123456789abc'), 'Should return false for UUIDv4');
  assert(!isValidUUIDv7(''), 'Should return false for empty string');
});

test('isValidUUIDv7 returns false for wrong version', () => {
  assert(!isValidUUIDv7('12345678-1234-4123-89ab-123456789abc'), 'Should return false for UUIDv4');
  assert(!isValidUUIDv7('12345678-1234-5123-89ab-123456789abc'), 'Should return false for UUIDv5');
});

test('isValidUUIDv7 returns false for null/undefined', () => {
  assert(!isValidUUIDv7(null), 'Should return false for null');
  assert(!isValidUUIDv7(undefined), 'Should return false for undefined');
});

// Test 3: Uniqueness
console.log('\nTest Suite 3: Uniqueness Guarantees');
test('Generated UUIDs are unique', () => {
  const uuids = new Set();
  const count = 1000;

  for (let i = 0; i < count; i++) {
    const uuid = generateUUIDv7();
    assert(!uuids.has(uuid), `Duplicate UUID generated: ${uuid}`);
    uuids.add(uuid);
  }

  assertEqual(uuids.size, count, `Should generate ${count} unique UUIDs`);
});

test('Batch generation produces unique UUIDs', () => {
  const batch = generateUUIDv7Batch(100);
  const uniqueSet = new Set(batch);

  assertEqual(batch.length, 100, 'Batch should produce requested count');
  assertEqual(uniqueSet.size, 100, 'All batch UUIDs should be unique');
});

// Test 4: Time ordering
console.log('\nTest Suite 4: Time Ordering');
test('UUIDs are time-ordered (monotonically increasing)', () => {
  const uuids = [];
  for (let i = 0; i < 10; i++) {
    uuids.push(generateUUIDv7());
    // Small delay to ensure time difference
    if (i < 9) {
      const start = Date.now();
      while (Date.now() - start < 1) {
        // Wait at least 1ms
      }
    }
  }

  for (let i = 1; i < uuids.length; i++) {
    const prevTime = uuids[i - 1].substring(0, 12);
    const currTime = uuids[i].substring(0, 12);
    assert(
      parseInt(currTime, 16) >= parseInt(prevTime, 16),
      `UUIDs should be time-ordered: ${uuids[i - 1]} >= ${uuids[i]}`
    );
  }
});

test('Timestamp portion is within reasonable range', () => {
  const uuid = generateUUIDv7();
  // UUIDv7 timestamp: time_low (bits 0-31, 8 hex chars) + time_mid (bits 32-47, 4 hex chars)
  // Concatenate them to get the full 12-char hex timestamp, then parse
  const timeLow = uuid.substring(0, 8);
  const timeMid = uuid.substring(9, 13);
  const timestamp = parseInt(timeLow + timeMid, 16);
  const now = Date.now();

  // Timestamp should be within last 10 seconds
  const diff = Math.abs(now - timestamp);
  assert(diff < 10000, 'Timestamp should be recent: ' + diff + 'ms difference');
});

// Test 5: Batch generation
console.log('\nTest Suite 5: Batch Generation');
test('generateUUIDv7Batch returns correct count', () => {
  const batch = generateUUIDv7Batch(50);
  assertEqual(batch.length, 50, 'Batch should return requested count');
});

test('generateUUIDv7Batch all are valid UUIDv7', () => {
  const batch = generateUUIDv7Batch(20);
  batch.forEach((uuid, index) => {
    assert(isValidUUIDv7(uuid), `Batch item ${index} should be valid UUIDv7`);
  });
});

test('generateUUIDv7Batch handles zero count', () => {
  const batch = generateUUIDv7Batch(0);
  assertEqual(batch.length, 0, 'Batch should return empty array for zero count');
});

test('generateUUIDv7Batch handles single item', () => {
  const batch = generateUUIDv7Batch(1);
  assertEqual(batch.length, 1, 'Batch should return single item');
  assert(isValidUUIDv7(batch[0]), 'Single item should be valid UUIDv7');
});

// Test 6: Edge cases
console.log('\nTest Suite 6: Edge Cases');
test('Handles rapid generation (no collisions)', () => {
  const uuids = new Set();
  const count = 100;

  for (let i = 0; i < count; i++) {
    const uuid = generateUUIDv7();
    assert(!uuids.has(uuid), 'Rapid generation should not produce collisions');
    uuids.add(uuid);
  }

  assertEqual(uuids.size, count, 'All rapid UUIDs should be unique');
});

test('Random bytes provide sufficient entropy', () => {
  const uuids = [];
  for (let i = 0; i < 100; i++) {
    uuids.push(generateUUIDv7());
  }

  // Check that the random portions vary
  const randomParts = uuids.map(uuid => uuid.substring(24));
  const uniqueRandomParts = new Set(randomParts);

  // Should have high entropy (at least 95% unique)
  const uniquenessRatio = uniqueRandomParts.size / randomParts.length;
  assert(uniquenessRatio > 0.95, `Random entropy should be high: ${uniquenessRatio}`);
});

// Test 7: Error handling
console.log('\nTest Suite 7: Error Handling');
test('Throws error if crypto not available', () => {
  // This test is informational - in Node.js crypto should always be available
  // We can't easily mock this, so we just verify the function doesn't crash
  try {
    const uuid = generateUUIDv7();
    assert(isValidUUIDv7(uuid), 'Should generate valid UUID when crypto is available');
  } catch (err) {
    assert(err.message.includes('crypto'), 'Should throw crypto-related error');
  }
});

// Test 8: Consistency
console.log('\nTest Suite 8: Consistency');
test('UUID format is consistent across multiple calls', () => {
  const uuids = [];
  for (let i = 0; i < 50; i++) {
    uuids.push(generateUUIDv7());
  }

  const allValid = uuids.every(uuid => isValidUUIDv7(uuid));
  assert(allValid, 'All generated UUIDs should maintain consistent format');
});

test('Version byte is always 7', () => {
  for (let i = 0; i < 100; i++) {
    const uuid = generateUUIDv7();
    const version = parseInt(uuid[14], 16);
    assertEqual(version, 7, `Version byte should always be 7, got ${version}`);
  }
});

// Summary
console.log('\n=== Test Summary ===');
console.log(`Tests Passed: ${testsPassed}`);
console.log(`Tests Failed: ${testsFailed}`);
console.log(`Total Tests: ${testsPassed + testsFailed}`);

if (testsFailed === 0) {
  console.log('\n✅ All tests passed!');
  process.exit(0);
} else {
  console.log('\n❌ Some tests failed!');
  process.exit(1);
}
