// Live Schema Verification - Step 6.5 Issue #1
// Verifies the actual PostgreSQL database state.
const {Pool} = require('pg');
const pool = new Pool({host:'localhost',port:5432,database:'campusconnect',user:'postgres',password:'postgres123'});

const EXPECTED_ENTITIES = [
  'users','departments','faculty_profiles','student_profiles',
  'classes','courses','class_courses','timetable_entries',
  'attendance','results','approvals','messages',
  'chat_rooms','announcements','notifications'
];

async function main() {
  const client = await pool.connect();
  const issues = [];
  const out = (s) => console.log(s);
  try {
    out('========================================');
    out('LIVE SCHEMA VERIFICATION (Issue #1)');
    out('========================================\n');

    // A. Entity count
    const tables = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' AND table_name NOT LIKE '\\_%' ESCAPE '\\' ORDER BY table_name`);
    const tableNames = tables.rows.map(r => r.table_name);
    out('A. ENTITY COUNT: ' + tableNames.length);
    tableNames.forEach(t => out('  - ' + t));
    for (const expected of EXPECTED_ENTITIES) {
      if (!tableNames.includes(expected)) issues.push('Missing entity: ' + expected);
    }
    out(tableNames.length === EXPECTED_ENTITIES.length ? '  PASS\n' : '  FAIL\n');

    // B. Columns
    out('B. TABLE COLUMNS:');
    for (const table of EXPECTED_ENTITIES) {
      const cols = await client.query(`SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`, [table]);
      out('\n  ' + table + ':');
      cols.rows.forEach(c => {
        const nn = c.is_nullable === 'NO' ? 'NOT NULL' : 'NULL';
        const def = c.column_default === null ? 'none' : c.column_default;
        out('    - ' + c.column_name + ' : ' + c.data_type + ' / ' + nn + ' / default=' + def);
      });
    }

    // C. Primary Keys
    out('\n\nC. PRIMARY KEYS:');
    for (const table of EXPECTED_ENTITIES) {
      const pks = await client.query(`SELECT kcu.column_name, c.data_type FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema JOIN information_schema.columns c ON c.table_schema = kcu.table_schema AND c.table_name = kcu.table_name AND c.column_name = kcu.column_name WHERE tc.table_schema='public' AND tc.table_name=$1 AND tc.constraint_type='PRIMARY KEY' ORDER BY kcu.ordinal_position`, [table]);
      if (pks.rows.length === 0) {
        issues.push('No PK on ' + table);
        out('  X ' + table + ': NO PK');
      } else {
        const cols = pks.rows.map(r => r.column_name + '(' + r.data_type + ')').join(', ');
        const allUUID = pks.rows.every(r => r.data_type === 'uuid');
        out('  - ' + table + ': PK = [' + cols + '] ' + (allUUID ? '[UUID]' : '[NOT UUID]'));
        if (!allUUID) issues.push('PK on ' + table + ' is not UUID');
      }
    }

    // D. Unique Constraints
    out('\nD. UNIQUE CONSTRAINTS:');
    const uniq = await client.query(`SELECT tc.table_name, tc.constraint_name, kcu.column_name FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name WHERE tc.table_schema='public' AND tc.constraint_type='UNIQUE' AND tc.table_name NOT LIKE '\\_%' ESCAPE '\\' ORDER BY tc.table_name, tc.constraint_name`);
    uniq.rows.forEach(r => out('  - ' + r.table_name + '.' + r.column_name + ' (' + r.constraint_name + ')'));

    // E. Check Constraints
    out('\nE. CHECK CONSTRAINTS:');
    const checks = await client.query(`SELECT tc.table_name, tc.constraint_name, cc.check_clause FROM information_schema.table_constraints tc JOIN information_schema.check_constraints cc ON tc.constraint_name = cc.constraint_name WHERE tc.table_schema='public' AND tc.constraint_type='CHECK' AND tc.table_name NOT LIKE '\\_%' ESCAPE '\\' ORDER BY tc.table_name, tc.constraint_name`);
    checks.rows.forEach(r => out('  - ' + r.table_name + ': ' + r.constraint_name + ' -> ' + r.check_clause));

    // F. Foreign Keys
    out('\nF. FOREIGN KEYS:');
    const fks = await client.query(`SELECT tc.table_name, tc.constraint_name, kcu.column_name, ccu.table_name AS foreign_table, ccu.column_name AS foreign_column, rc.update_rule, rc.delete_rule FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name JOIN information_schema.referential_constraints rc ON rc.constraint_name = tc.constraint_name JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name WHERE tc.table_schema='public' AND tc.constraint_type='FOREIGN KEY' AND tc.table_name NOT LIKE '\\_%' ESCAPE '\\' ORDER BY tc.table_name, tc.constraint_name`);
    fks.rows.forEach(r => out('  - ' + r.table_name + '.' + r.column_name + ' -> ' + r.foreign_table + '.' + r.foreign_column + ' ON DELETE ' + r.delete_rule + ' ON UPDATE ' + r.update_rule + ' (' + r.constraint_name + ')'));

    // G. Indexes
    out('\nG. INDEXES:');
    const idx = await client.query(`SELECT schemaname, tablename, indexname FROM pg_indexes WHERE schemaname='public' AND tablename NOT LIKE '\\_%' ESCAPE '\\' ORDER BY tablename, indexname`);
    idx.rows.forEach(r => out('  - ' + r.tablename + ': ' + r.indexname));

    out('\n\nTotal issues: ' + issues.length);
    if (issues.length) issues.forEach(i => out('  ! ' + i));
    await client.release();
    await pool.end();
    process.exit(issues.length === 0 ? 0 : 1);
  } catch (err) {
    console.error('FAIL: ' + err.message);
    await client.release();
    await pool.end();
    process.exit(1);
  }
}

main();