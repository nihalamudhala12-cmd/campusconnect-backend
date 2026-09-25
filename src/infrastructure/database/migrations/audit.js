/**
 * Schema Audit Script
 * Comprehensive audit of the migrated database.
 */

const { Pool } = require('pg');
const databaseConfig = require('../../../config/database');

const EXPECTED_ENTITIES = [
  'users', 'departments', 'faculty_profiles', 'student_profiles',
  'classes', 'courses', 'class_courses', 'timetable_entries',
  'attendance', 'results', 'approvals', 'messages',
  'chat_rooms', 'announcements', 'notifications'
];

const lines = [];
function out(msg) { console.log(msg); lines.push(msg); }

async function main() {
  const pool = new Pool(databaseConfig.getConfig());
  const client = await pool.connect();
  const issues = [];

  try {
    out('========================================');
    out('STEP 6.5 DATABASE DESIGN AUDIT REPORT');
    out('========================================\n');

    // SECTION A: Entity count
    out('A. ENTITY COUNT');
    const tables = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        AND table_name NOT LIKE '\\_%' ESCAPE '\\'
      ORDER BY table_name
    `);
    const tableNames = tables.rows.map(r => r.table_name);
    out('  Found ' + tableNames.length + ' entities:');
    tableNames.forEach(t => out('    - ' + t));
    let allPresent = true;
    for (const expected of EXPECTED_ENTITIES) {
      if (!tableNames.includes(expected)) {
        issues.push('Missing entity: ' + expected);
        allPresent = false;
      }
    }
    out(allPresent ? '  PASS: 15 entities match\n' : '  FAIL\n');

    // SECTION B: PKs
    out('B. PRIMARY KEYS');
    for (const table of EXPECTED_ENTITIES) {
      const pks = await client.query(`
        SELECT column_name, data_type
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = $1 AND tc.constraint_type = 'PRIMARY KEY'
        ORDER BY kcu.ordinal_position
      `, [table]);
      if (pks.rows.length === 0) {
        issues.push('No PK on ' + table);
        out('  FAIL: ' + table + ' has no PK');
      } else {
        const cols = pks.rows.map(r => r.column_name + '(' + r.data_type + ')').join(', ');
        const allUUID = pks.rows.every(r => r.data_type === 'uuid');
        out('  ' + table + ': PK = [' + cols + '] ' + (allUUID ? '[UUID]' : '[NOT UUID]'));
        if (!allUUID) issues.push('PK on ' + table + ' is not UUID');
      }
    }
    out('');

    await client.release();
    await pool.end();
    process.exit(issues.length === 0 ? 0 : 1);
  } catch (err) {
    console.error('FAIL:', err.message);
    await client.release();
    await pool.end();
    process.exit(1);
  }
}

main();