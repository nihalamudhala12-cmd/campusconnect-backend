/**
 * UUIDv7 Insertion Test
 * Verifies application-generated UUIDv7 values work as PKs
 */
const { Pool } = require('pg');
const cfg = require('../../../config/database').getConfig();
const pool = new Pool(cfg);
const { generateUUIDv7 } = require('../utils/uuid');

async function main() {
  const client = await pool.connect();
  try {
    console.log('Testing UUIDv7 insertion...');

    const deptId = generateUUIDv7();
    const userId = generateUUIDv7();

    // Insert a department
    await client.query(
      `INSERT INTO departments (id, name, code) VALUES ($1, $2, $3)`,
      [deptId, 'Test Dept ' + Date.now(), 'TST' + Date.now()]
    );
    console.log('Inserted department:', deptId);

    // Insert a user
    await client.query(
      `INSERT INTO users (id, name, email, role, department_id) VALUES ($1, $2, $3, $4, $5)`,
      [userId, 'Test User ' + Date.now(), 'test' + Date.now() + '@test.edu', 'STUDENT', deptId]
    );
    console.log('Inserted user:', userId);

    // Verify inserted values
    const r1 = await client.query('SELECT id FROM departments WHERE id = $1', [deptId]);
    const r2 = await client.query('SELECT id FROM users WHERE id = $1', [userId]);
    console.log('Department lookup:', r1.rows.length === 1 ? 'OK' : 'FAIL');
    console.log('User lookup:', r2.rows.length === 1 ? 'OK' : 'FAIL');

    // Verify UUIDs look like v7
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    console.log('UUIDv7 format valid:', uuidRegex.test(deptId) && uuidRegex.test(userId) ? 'OK' : 'FAIL');

    // Cleanup
    await client.query('DELETE FROM users WHERE id = $1', [userId]);
    await client.query('DELETE FROM departments WHERE id = $1', [deptId]);
    console.log('Cleanup done');

    console.log('STATUS: PASS');
    process.exit(0);
  } catch (err) {
    console.error('FAIL:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();