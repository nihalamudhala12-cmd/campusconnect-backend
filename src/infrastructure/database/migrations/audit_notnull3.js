const { Pool } = require('pg');
const cfg = require('../../../config/database').getConfig();
const pool = new Pool(cfg);

const sql = `SELECT table_name, column_name, is_nullable
  FROM information_schema.columns
  WHERE table_schema = 'public'
  ORDER BY table_name, ordinal_position`;

pool.query(sql).then(r => {
  console.log('Total columns:', r.rows.length);
  console.log('\nNOT NULL columns:');
  r.rows.filter(x => x.is_nullable === 'NO').forEach(x => console.log('  ' + x.table_name + '.' + x.column_name));
  console.log('\nNULLABLE columns:');
  r.rows.filter(x => x.is_nullable === 'YES').forEach(x => console.log('  ' + x.table_name + '.' + x.column_name));
  pool.end();
}).catch(e => { console.error(e.message); pool.end(); process.exit(1); });