const { Pool } = require('pg');
const p = new Pool({ connectionString: 'postgresql://postgres:postgres123@localhost:5432/campusconnect' });
(async () => {
  const r = await p.query("SELECT name FROM _migrations ORDER BY id");
  console.log('Executed migrations:', r.rows.map(x => x.name));
  const t = await p.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' AND table_name NOT LIKE '\\_%' ORDER BY table_name");
  console.log('Tables:', t.rows.map(x => x.table_name));
  const c = await p.query("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='system_config' ORDER BY ordinal_position");
  console.log('system_config cols:', JSON.stringify(c.rows));
  await p.end();
})();