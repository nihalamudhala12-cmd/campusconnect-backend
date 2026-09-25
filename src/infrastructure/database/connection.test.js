/**
 * Database Connection Module Tests
 * Step 6.4 — Database Infrastructure Testing
 *
 * Manual test suite for PostgreSQL connection lifecycle.
 * Run with: node src/infrastructure/database/connection.test.js
 */

const connection = require('./connection');
const { DatabaseError, ServiceUnavailableError } = require('../../errors');

console.log('=== Database Connection Module Tests ===\n');

// Test 1: Configuration validation
console.log('Test 1: Configuration validation');
try {
  const databaseConfig = require('../../config/database');
  const config = databaseConfig.getConfig();

  if (!config.host || !config.port || !config.database) {
    console.log('❌ FAIL: Database configuration incomplete');
    console.log('Config:', config);
  } else {
    console.log('✅ PASS: Database configuration is valid');
    console.log('   Target:', `${config.user || '(no-user)'}@${config.host}:${config.port}/${config.database}`);
  }
} catch (err) {
  console.log('❌ FAIL: Could not load database config');
  console.log('   Error:', err.message);
}

// Test 2: Initialize pool
console.log('\nTest 2: Pool initialization');
connection.initialize()
  .then(() => {
    console.log('✅ PASS: Pool initialized successfully');
    console.log('   isReady():', connection.isReady());

    // Test 3: Verify connection
    console.log('\nTest 3: Connection verification');
    return connection.verifyConnection();
  })
  .then(() => {
    console.log('✅ PASS: Database connectivity verified');

    // Test 4: Get pool
    console.log('\nTest 4: Pool access');
    try {
      const pool = connection.getPool();
      console.log('✅ PASS: Pool accessible');
      console.log('   Pool type:', pool.constructor.name);
    } catch (err) {
      console.log('❌ FAIL: Could not get pool');
      console.log('   Error:', err.message);
    }

    // Test 5: Idempotency
    console.log('\nTest 5: Idempotency (multiple initialize calls)');
    return connection.initialize();
  })
  .then(() => {
    console.log('✅ PASS: Multiple initialize calls handled correctly');

    // Test 6: Close pool
    console.log('\nTest 6: Pool closure');
    return connection.close();
  })
  .then(() => {
    console.log('✅ PASS: Pool closed successfully');
    console.log('   isReady():', connection.isReady());

    // Test 7: Idempotent close
    console.log('\nTest 7: Idempotent close (multiple close calls)');
    return connection.close();
  })
  .then(() => {
    console.log('✅ PASS: Multiple close calls handled correctly');

    console.log('\n=== All Tests Completed ===');
    process.exit(0);
  })
  .catch((err) => {
    console.log('❌ FAIL: Test failed with error');
    console.log('   Error:', err.message);
    console.log('   Details:', err.details || 'N/A');
    console.log('\n=== Tests Failed ===');
    process.exit(1);
  });
