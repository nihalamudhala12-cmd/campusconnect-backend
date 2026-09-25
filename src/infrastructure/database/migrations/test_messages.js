/**
 * Messages & Approvals FK Behavior Test
 */
const { Pool } = require('pg');
const cfg = require('../../../config/database').getConfig();
const pool = new Pool(cfg);
const { generateUUIDv7 } = require('../utils/uuid');

async function main() {
  const client = await pool.connect();
  let pass = 0, fail = 0;

  try {
    console.log('Testing messages & approvals FK behavior...\n');

    // Setup
    const deptId = generateUUIDv7();
    const senderId = generateUUIDv7();
    const receiverId = generateUUIDv7();
    await client.query(
      `INSERT INTO departments (id, name, code) VALUES ($1, $2, $3)`,
      [deptId, 'Test Msg Dept', 'TMD' + Date.now()]
    );
    await client.query(
      `INSERT INTO users (id, name, email, role, department_id) VALUES ($1, $2, $3, $4, $5)`,
      [senderId, 'Sender', 's' + Date.now() + '@t.edu', 'FACULTY', deptId]
    );
    await client.query(
      `INSERT INTO users (id, name, email, role, department_id) VALUES ($1, $2, $3, $4, $5)`,
      [receiverId, 'Receiver', 'r' + Date.now() + '@t.edu', 'STUDENT', deptId]
    );

    // Test 1: Message with same sender = receiver should fail
    try {
      await client.query(
        `INSERT INTO messages (id, sender_id, receiver_id, body) VALUES ($1, $2, $2, $3)`,
        [generateUUIDv7(), senderId, 'self message']
      );
      console.log('Test 1 FAIL: should have rejected self-message');
      fail++;
    } catch (err) {
      if (err.code === '23514') {
        console.log('Test 1 PASS: self-message rejected');
        pass++;
      } else {
        console.log('Test 1 FAIL: unexpected error', err.message);
        fail++;
      }
    }

    // Test 2: Valid message
    try {
      await client.query(
        `INSERT INTO messages (id, sender_id, receiver_id, body) VALUES ($1, $2, $3, $4)`,
        [generateUUIDv7(), senderId, receiverId, 'hello']
      );
      console.log('Test 2 PASS: valid message accepted');
      pass++;
    } catch (err) {
      console.log('Test 2 FAIL:', err.message);
      fail++;
    }

    // Test 3: Approvals with reviewed_by SET NULL
    const reviewerId = generateUUIDv7();
    await client.query(
      `INSERT INTO users (id, name, email, role, department_id) VALUES ($1, $2, $3, $4, $5)`,
      [reviewerId, 'Reviewer', 'rev' + Date.now() + '@t.edu', 'HOD', deptId]
    );
    const aprId = generateUUIDv7();
    await client.query(
      `INSERT INTO approvals (id, type, requested_by, department_id, status, reviewed_by) VALUES ($1, 'LEAVE', $2, $3, 'APPROVED', $4)`,
      [aprId, senderId, deptId, reviewerId]
    );
    // Delete reviewer - reviewed_by should become NULL
    await client.query(`DELETE FROM users WHERE id = $1`, [reviewerId]);
    const checkApr = await client.query(`SELECT reviewed_by FROM approvals WHERE id = $1`, [aprId]);
    if (checkApr.rows[0].reviewed_by === null) {
      console.log('Test 3 PASS: reviewed_by became NULL after user deletion');
      pass++;
    } else {
      console.log('Test 3 FAIL: reviewed_by not NULL:', checkApr.rows[0].reviewed_by);
      fail++;
    }

    // Test 4: Cannot delete a user who is requested_by in an approval (RESTRICT)
    const anotherUserId = generateUUIDv7();
    await client.query(
      `INSERT INTO users (id, name, email, role, department_id) VALUES ($1, $2, $3, $4, $5)`,
      [anotherUserId, 'Other', 'o' + Date.now() + '@t.edu', 'STUDENT', deptId]
    );
    const aprId2 = generateUUIDv7();
    await client.query(
      `INSERT INTO approvals (id, type, requested_by, status) VALUES ($1, 'LEAVE', $2, 'PENDING')`,
      [aprId2, senderId]
    );
    try {
      await client.query(`DELETE FROM users WHERE id = $1`, [senderId]);
      console.log('Test 4 FAIL: should have been restricted');
      fail++;
    } catch (err) {
      if (err.code === '23503') {
        console.log('Test 4 PASS: RESTRICT prevented deletion of user with active approval');
        pass++;
      } else {
        console.log('Test 4 FAIL: unexpected error', err.message);
        fail++;
      }
    }

    // Cleanup
    await client.query('DELETE FROM approvals');
    await client.query('DELETE FROM messages');
    await client.query('DELETE FROM users WHERE id IN ($1, $2, $3)', [senderId, receiverId, anotherUserId]);
    await client.query('DELETE FROM departments WHERE id = $1', [deptId]);

    console.log('\nTotal: ' + pass + ' pass, ' + fail + ' fail');
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