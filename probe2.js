const { Pool } = require('pg');
const p = new Pool({ connectionString: 'postgresql://postgres:postgres123@localhost:5432/campusconnect' });
(async () => {
  const r = await p.query("SELECT id, attendance_date, pg_typeof(attendance_date) AS t, attendance_date::text AS txt FROM attendance LIMIT 3");
  console.log(JSON.stringify(r.rows, null, 2));
  const c = await p.query("SELECT udt_name FROM information_schema.columns WHERE table_name='attendance' AND column_name='attendance_date'");
  console.log('udt:', c.rows);
  await p.end();
})();