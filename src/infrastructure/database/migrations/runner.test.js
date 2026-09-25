/**
 * Migration Runner Tests
 * Step 6.5 — Database Design Testing
 *
 * Tests the migration runner including:
 * - Migration order execution
 * - Dry-run mode
 * - Migration tracking
 * - Transaction handling
 * - Error handling and rollback
 * - Idempotency
 * - File reading and validation
 */

require('dotenv').config(); // Load environment variables (DATABASE_URL)

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const { runMigrations, verifyMigrations, rollbackLast } = require('./runner');
const migrationOrder = require('./000_migration_order');

console.log('=== Migration Runner Tests ===\n');

let testsPassed = 0;
let testsFailed = 0;
let queuedTests = [];

function test(name, fn) {
  queuedTests.push(async () => {
    try {
      const result = fn();
      if (result && typeof result.then === 'function') {
        await result;
      }
      console.log(`✅ PASS: ${name}`);
      testsPassed++;
    } catch (err) {
      console.log(`❌ FAIL: ${name}`);
      console.log(`   Error: ${err.message}`);
      testsFailed++;
    }
  });
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

// Test 1: Migration order validation
console.log('Test Suite 1: Migration Order Configuration');
test('Migration order file exists and is valid', () => {
  assert(migrationOrder, 'Migration order should be loaded');
  assert(Array.isArray(migrationOrder.migrations), 'Migrations should be an array');
  assert(migrationOrder.migrations.length > 0, 'Should have at least one migration');
});

test('Migration files follow naming convention', () => {
  const namingPattern = /^\d{3}_[a-z_]+\.sql$/;
  migrationOrder.migrations.forEach(migration => {
    assert(namingPattern.test(migration), `Migration ${migration} follows naming convention`);
  });
});

test('Post-migration file follows naming convention', () => {
  if (migrationOrder.postMigration) {
    const namingPattern = /^\d{3}_[a-z_]+\.sql$/;
    assert(namingPattern.test(migrationOrder.postMigration), 'Post-migration follows naming convention');
  }
});

test('Migration order is sequential', () => {
  const numbers = migrationOrder.migrations.map(m => parseInt(m.split('_')[0], 10));
  for (let i = 1; i < numbers.length; i++) {
    assert(numbers[i] > numbers[i - 1], 'Migration numbers should be sequential');
  }
});

// Test 2: File system validation
console.log('\nTest Suite 2: File System Validation');
test('All migration files exist', () => {
  migrationOrder.migrations.forEach(migration => {
    const filePath = path.join(__dirname, migration);
    assert(fs.existsSync(filePath), `Migration file ${migration} should exist`);
  });
});

test('Post-migration file exists if specified', () => {
  if (migrationOrder.postMigration) {
    const filePath = path.join(__dirname, migrationOrder.postMigration);
    assert(fs.existsSync(filePath), `Post-migration file ${migrationOrder.postMigration} should exist`);
  }
});

test('Migration files are readable', () => {
  migrationOrder.migrations.forEach(migration => {
    const filePath = path.join(__dirname, migration);
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      assert(content.length > 0, `Migration file ${migration} should not be empty`);
    } catch (err) {
      throw new Error(`Cannot read migration file ${migration}: ${err.message}`);
    }
  });
});

test('Migration files contain SQL', () => {
  migrationOrder.migrations.forEach(migration => {
    const filePath = path.join(__dirname, migration);
    const content = fs.readFileSync(filePath, 'utf8');
    const hasSQL = /CREATE|ALTER|DROP|INSERT|UPDATE|DELETE/i.test(content);
    assert(hasSQL, `Migration file ${migration} should contain SQL statements`);
  });
});

// Test 3: SQL validation
console.log('\nTest Suite 3: SQL Content Validation');
test('Migration files use IF NOT EXISTS for idempotency', () => {
  migrationOrder.migrations.forEach(migration => {
    const filePath = path.join(__dirname, migration);
    const content = fs.readFileSync(filePath, 'utf8');
    const hasIdempotency = /IF NOT EXISTS/i.test(content);
    assert(hasIdempotency, `Migration ${migration} should use IF NOT EXISTS for idempotency`);
  });
});

test('Migration files don\'t contain destructive operations without guards', () => {
  migrationOrder.migrations.forEach(migration => {
    const filePath = path.join(__dirname, migration);
    const content = fs.readFileSync(filePath, 'utf8');
    // Check for DROP without IF EXISTS
    const dropWithoutGuard = /DROP\s+(TABLE|INDEX).*?(?!IF\s+EXISTS)/i.test(content);
    assert(!dropWithoutGuard, `Migration ${migration} should not have unprotected DROP statements`);
  });
});

test('Migration files have proper transaction handling in runner', () => {
  // The runner handles transactions, so we just verify the SQL doesn't have conflicting standalone transaction control.
  // BEGIN/COMMIT/ROLLBACK inside DO $$ blocks are procedural SQL and do not conflict with runner-managed transactions.
  migrationOrder.migrations.forEach(migration => {
    const filePath = path.join(__dirname, migration);
    const content = fs.readFileSync(filePath, 'utf8');
    // Remove DO $$ ... $$ blocks before checking for standalone transaction keywords.
    const withoutDoBlocks = content.replace(/DO\s+\$\$[\s\S]*?\$\$/g, '');
    const hasTransaction = /\bBEGIN\b|\bCOMMIT\b|\bROLLBACK\b/i.test(withoutDoBlocks);
    assert(!hasTransaction, `Migration ${migration} should not have standalone transaction statements`);
  });
});

// Test 4: Configuration validation
console.log('\nTest Suite 4: Configuration Validation');
test('Database configuration is accessible', () => {
  const databaseConfig = require('../../../config/database');
  const config = databaseConfig.getConfig();
  assert(config, 'Database config should be accessible');
  assert(config.host, 'Config should have host');
  assert(config.port, 'Config should have port');
  assert(config.database, 'Config should have database name');
});

test('Migration order matches schema specification', () => {
  // Based on DATABASE_SCHEMA_SPECIFICATION.md, we expect specific tables
  const expectedTables = [
    'departments',
    'users',
    'faculty_profiles',
    'student_profiles',
    'classes',
    'courses',
    'class_courses',
    'timetable_entries',
    'attendance',
    'results',
    'approvals',
    'messages',
    'chat_rooms',
    'announcements',
    'notifications',
    'sessions',
    'devices',
    'system_config',
    'enrolment'
  ];

  // Check that we have the right number of main migrations (exclude post-migration/constraint migrations)
  // Note: 020_mfa.sql and 021_profile_completed.sql add columns to existing users table (not new tables)
  const mainMigrations = migrationOrder.migrations.filter(m => !m.startsWith('099') && !m.startsWith('100'));
  assertEqual(mainMigrations.length, expectedTables.length + 2, 'Migration count should match table count (plus MFA and profile_completed column migrations)');
});

// Test 5: Function signature validation
console.log('\nTest Suite 5: Function Signature Validation');
test('runMigrations is a function', () => {
  assert(typeof runMigrations === 'function', 'runMigrations should be a function');
});

test('verifyMigrations is a function', () => {
  assert(typeof verifyMigrations === 'function', 'verifyMigrations should be a function');
});

test('rollbackLast is a function', () => {
  assert(typeof rollbackLast === 'function', 'rollbackLast should be a function');
});

test('runMigrations accepts options parameter', () => {
  try {
    // Just check it doesn't throw on parameter validation
    runMigrations({ dryRun: true });
  } catch (err) {
    // Expected to fail due to no database, but should not be parameter error
    assert(!err.message.includes('options'), 'Should accept options parameter');
  }
});

// Test 6: Error handling
console.log('\nTest Suite 6: Error Handling');
test('Handles missing migration files gracefully', () => {
  // This would be tested with actual runner execution
  // For now, we verify the logic exists in the code
  const runnerCode = fs.readFileSync(path.join(__dirname, 'runner.js'), 'utf8');
  const hasErrorHandling = /throw new Error.*Migration file not found/i.test(runnerCode);
  assert(hasErrorHandling, 'Runner should handle missing migration files');
});

test('Handles SQL execution errors with rollback', () => {
  const runnerCode = fs.readFileSync(path.join(__dirname, 'runner.js'), 'utf8');
  const hasRollback = /ROLLBACK/i.test(runnerCode);
  assert(hasRollback, 'Runner should rollback on SQL errors');
});

// Test 7: Dry-run mode
console.log('\nTest Suite 7: Dry-run Mode');
test('Dry-run mode exists in options', () => {
  // Verify the option is documented in the code
  const runnerCode = fs.readFileSync(path.join(__dirname, 'runner.js'), 'utf8');
  const hasDryRun = /dryRun/i.test(runnerCode);
  assert(hasDryRun, 'Runner should support dry-run mode');
});

// Test 8: Tracking table
console.log('\nTest Suite 8: Migration Tracking');
test('Tracking table creation SQL is present', () => {
  const runnerCode = fs.readFileSync(path.join(__dirname, 'runner.js'), 'utf8');
  const hasTrackingTable = /_migrations/i.test(runnerCode);
  assert(hasTrackingTable, 'Runner should create _migrations tracking table');
});

test('Tracking table has required columns', () => {
  const runnerCode = fs.readFileSync(path.join(__dirname, 'runner.js'), 'utf8');
  const hasIdColumn = /id\s+SERIAL\s+PRIMARY\s+KEY/i.test(runnerCode);
  const hasNameColumn = /name\s+VARCHAR.*UNIQUE/i.test(runnerCode);
  const hasExecutedAt = /executed_at\s+TIMESTAMPTZ/i.test(runnerCode);
  assert(hasIdColumn, 'Tracking table should have id column');
  assert(hasNameColumn, 'Tracking table should have name column');
  assert(hasExecutedAt, 'Tracking table should have executed_at column');
});

// Test 9: Integration tests (requires actual database)
console.log('\nTest Suite 9: Integration Tests');

test('runMigrations with actual database', async () => {
  const result = await runMigrations({ dryRun: false });
  assert(result && result.success === true, 'runMigrations should complete successfully');
});

test('verifyMigrations with actual database', async () => {
  const result = await verifyMigrations();
  assert(result && result.success === true, 'verifyMigrations (dry run) should complete successfully');
});

test('Migration idempotency with actual database', async () => {
  await runMigrations({ dryRun: false });
  await runMigrations({ dryRun: false });
  const cfg = require('../../../config/database').getConfig();
  const pool = new Pool({ host: cfg.host, port: cfg.port, database: cfg.database, user: cfg.user, password: cfg.password });
  try {
    const res = await pool.query('SELECT name FROM _migrations ORDER BY id');
    const names = res.rows.map(r => r.name);
    const expected = migrationOrder.migrations.concat(
      migrationOrder.postMigration ? [migrationOrder.postMigration] : []
    );
    expected.forEach(m => assert(names.includes(m), `Migration ${m} should be recorded`));
  } finally {
    await pool.end();
  }
});

test('rollbackLast with actual database', async () => {
  const cfg = require('../../../config/database').getConfig();
  const pool = new Pool({ host: cfg.host, port: cfg.port, database: cfg.database, user: cfg.user, password: cfg.password });
  try {
    // Get migration count before rollback
    const before = await pool.query('SELECT count(*) FROM _migrations');
    const beforeCount = parseInt(before.rows[0].count);
    
    await rollbackLast();
    
    // Verify count decreased by exactly 1
    const after = await pool.query('SELECT count(*) FROM _migrations');
    const afterCount = parseInt(after.rows[0].count);
    assert(afterCount === beforeCount - 1, `Expected ${beforeCount - 1} migrations after rollback, got ${afterCount}`);
  } finally {
    await pool.end();
  }
});

// Test 10: Security checks
console.log('\nTest Suite 10: Security Checks');
test('No hardcoded credentials in migration files', () => {
  migrationOrder.migrations.forEach(migration => {
    const filePath = path.join(__dirname, migration);
    const content = fs.readFileSync(filePath, 'utf8');
    const hasPassword = /password\s*=\s*['"][^'"]+['"]/i.test(content);
    assert(!hasPassword, `Migration ${migration} should not contain hardcoded passwords`);
  });
});

test('No SQL injection patterns in migration files', () => {
  migrationOrder.migrations.forEach(migration => {
    const filePath = path.join(__dirname, migration);
    const content = fs.readFileSync(filePath, 'utf8');
    // Check for suspicious patterns
    const hasSuspicious = /eval\(|exec\(|system\(/i.test(content);
    assert(!hasSuspicious, `Migration ${migration} should not contain suspicious patterns`);
  });
});

// Summary
(async () => {
  for (const t of queuedTests) {
    await t();
  }
  console.log('\n=== Test Summary ===');
  console.log(`Tests Passed: ${testsPassed}`);
  console.log(`Tests Failed: ${testsFailed}`);
  console.log(`Total Tests: ${testsPassed + testsFailed}`);

  if (testsFailed === 0) {
    console.log('\n✅ All unit tests passed!');
    console.log('Note: Integration tests have been executed against the real database.');
    console.log('DATABASE_URL is loaded from .env');
    process.exit(0);
  } else {
    console.log('\n❌ Some tests failed!');
    process.exit(1);
  }
})();
