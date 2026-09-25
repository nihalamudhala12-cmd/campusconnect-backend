const { Pool } = require('pg');
const cfg = require('../../../config/database').getConfig();
const pool = new Pool(cfg);

const sql = `SELECT table_name, column_name, is_nullable
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name NOT LIKE '_%'
  ORDER BY table_name, ordinal_position`;

pool.query(sql).then(r => {
  console.log('Total columns:', r.rows.length);
  console.log('\nAll columns:');
  r.rows.forEach(x => console.log('  ' + x.table_name + '.' + x.column_name + ' = ' + x.is_nullable));
  pool.end();
}).catch(e => { console.error(e.message); pool.end(); process.exit(1); });