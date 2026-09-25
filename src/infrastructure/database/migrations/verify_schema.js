/**
 * Schema Verification Script - Part 1 (Entities & PKs)
 */
const { Pool } = require('pg');
const databaseConfig = require('../../../config/database');

const EXPECTED_ENTITIES = [
  'users', 'departments', 'faculty_profiles', 'student_profiles',
  'classes', 'courses', 'class_courses', 'timetable_entries',
  'attendance', 'results', 'approvals', 'messages',
  'chat_rooms', 'announcements', 'notifications'
];

async function main() {
  const pool = new Pool(databaseConfig.getConfig());
  const client = await pool.connect();
  const issues = [];

  try {
    console.log('STEP 6.5 DATABASE DESIGN VERIFICATION\n');

    // A. Entity count
    const tables = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        AND table_name NOT LIKE '\\_%' ESCAPE '\\'
      ORDER BY table_name
    `);
    const tableNames = tables.rows.map(r => r.table_name);
    console.log('A. ENTITY COUNT:', tableNames.length);
    tableNames.forEach(t => console.log('  -', t));
    for (const expected of EXPECTED_ENTITIES) {
      if (!tableNames.includes(expected)) issues.push('Missing entity: ' + expected);
    }
    console.log(tableNames.length === EXPECTED_ENTITIES.length ? '  OK\n' : '  MISMATCH\n');

    // B. PKs
    console.log('B. PRIMARY KEYS:');
    for (const table of EXPECTED_ENTITIES) {
      const pks = await client.query(`
        SELECT column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = $1 AND tc.constraint_type = 'PRIMARY KEY'
        ORDER BY kcu.ordinal_position
      `, [table]);
      if (pks.rows.length === 0) {
        issues.push('No PK on ' + table);
        console.log('  X', table, 'NO PK');
      } else {
        const cols = pks.rows.map(r => r.column_name).join(', ');
        console.log('  -', table, ': PK =', cols);
      }
    }
    console.log('');

    // Save state for part 2
    console.log('PART 1 DONE');
    console.log('Total issues so far:', issues.length);

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
