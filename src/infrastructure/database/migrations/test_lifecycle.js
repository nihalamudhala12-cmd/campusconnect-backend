/**
 * Announcement Lifecycle Test
 * Verifies announcement workflow and CHECK constraints
 */
const { Pool } = require('pg');
const cfg = require('../../../config/database').getConfig();
const pool = new Pool(cfg);
const { generateUUIDv7 } = require('../utils/uuid');

async function main() {
  const client = await pool.connect();
  let pass = 0, fail = 0;

  try {
    console.log('Testing announcement lifecycle...\n');

    // Setup test data
    const deptId = generateUUIDv7();
    const userId = generateUUIDv7();
    await client.query(
      `INSERT INTO departments (id, name, code) VALUES ($1, $2, $3)`,
      [deptId, 'Test Dept LC', 'TLC' + Date.now()]
    );
    await client.query(
      `INSERT INTO users (id, name, email, role, department_id) VALUES ($1, $2, $3, $4, $5)`,
      [userId, 'Test User LC', 'lc' + Date.now() + '@test.edu', 'HOD', deptId]
    );

    // Test 1: DEPARTMENT audience requires department_id
    try {
      await client.query(
        `INSERT INTO announcements (id, title, content, created_by, audience, status) VALUES ($1, $2, $3, $4, 'DEPARTMENT', 'ACTIVE')`,
        [generateUUIDv7(), 'Test', 'Body', userId]
      );
      console.log('Test 1 FAIL: should have rejected DEPARTMENT without department_id');
      fail++;
    } catch (err) {
      if (err.code === '23514') { // check violation
        console.log('Test 1 PASS: DEPARTMENT without dept_id rejected');
        pass++;
      } else {
        console.log('Test 1 FAIL: unexpected error', err.message);
        fail++;
      }
    }

    // Test 2: ALL audience requires department_id IS NULL
    try {
      await client.query(
        `INSERT INTO announcements (id, title, content, created_by, department_id, audience, status) VALUES ($1, $2, $3, $4, $5, 'ALL', 'ACTIVE')`,
        [generateUUIDv7(), 'Test', 'Body', userId, deptId]
      );
      console.log('Test 2 FAIL: should have rejected ALL with department_id');
      fail++;
    } catch (err) {
      if (err.code === '23514') {
        console.log('Test 2 PASS: ALL with dept_id rejected');
        pass++;
      } else {
        console.log('Test 2 FAIL: unexpected error', err.message);
        fail++;
      }
    }

    // Test 3: Valid DEPARTMENT announcement
    try {
      const annId = generateUUIDv7();
      await client.query(
        `INSERT INTO announcements (id, title, content, created_by, department_id, audience, status) VALUES ($1, $2, $3, $4, $5, 'DEPARTMENT', 'ACTIVE')`,
        [annId, 'Test', 'Body', userId, deptId]
      );
      console.log('Test 3 PASS: Valid DEPARTMENT announcement accepted');
      pass++;
    } catch (err) {
      console.log('Test 3 FAIL:', err.message);
      fail++;
    }

    // Test 4: Valid ALL announcement
    try {
      const annId = generateUUIDv7();
      await client.query(
        `INSERT INTO announcements (id, title, content, created_by, audience, status, type) VALUES ($1, $2, $3, $4, 'ALL', 'ACTIVE', 'ANNOUNCEMENT')`,
        [annId, 'Test', 'Body', userId]
      );
      console.log('Test 4 PASS: Valid ALL announcement accepted');
      pass++;
    } catch (err) {
      console.log('Test 4 FAIL:', err.message);
      fail++;
    }

    // Test 5: ALERT type valid
    try {
      const annId = generateUUIDv7();
      await client.query(
        `INSERT INTO announcements (id, title, content, created_by, department_id, audience, status, type) VALUES ($1, $2, $3, $4, $5, 'DEPARTMENT', 'ACTIVE', 'ALERT')`,
        [annId, 'Alert Test', 'Body', userId, deptId]
      );
      console.log('Test 5 PASS: Valid ALERT type accepted');
      pass++;
    } catch (err) {
      console.log('Test 5 FAIL:', err.message);
      fail++;
    }

    // Test 6: PENDING_INSTITUTION_WIDE with department_id (preserves department context)
    try {
      const annId = generateUUIDv7();
      await client.query(
        `INSERT INTO announcements (id, title, content, created_by, department_id, audience, status) VALUES ($1, $2, $3, $4, $5, 'PENDING_INSTITUTION_WIDE', 'PENDING_AUTHORIZATION')`,
        [annId, 'Pending Test', 'Body', userId, deptId]
      );
      console.log('Test 6 PASS: PENDING_INSTITUTION_WIDE with dept_id accepted');
      pass++;
    } catch (err) {
      console.log('Test 6 FAIL:', err.message);
      fail++;
    }

    // Cleanup
    await client.query('DELETE FROM announcements WHERE created_by = $1', [userId]);
    await client.query('DELETE FROM users WHERE id = $1', [userId]);
    await client.query('DELETE FROM departments WHERE id = $1', [deptId]);

    console.log('\nTotal: ' + pass + ' pass, ' + fail + ' fail');
    console.log(fail === 0 ? 'STATUS: PASS' : 'STATUS: FAIL');
    process.exit(fail === 0 ? 0 : 1);
  } catch (err) {
    console.error('FAIL:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();