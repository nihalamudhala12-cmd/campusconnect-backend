const pg = require('pg');
const client = new pg.Client({host:'localhost',port:5432,user:'postgres',password:'postgres123',database:'campusconnect'});
client.connect().then(async()=>{
  const tables = await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename");
  console.log('Tables:', tables.rows.map(r=>r.tablename).join(', '));
  const userCount = await client.query('SELECT COUNT(*) FROM users');
  console.log('Users count:', userCount.rows[0].count);
  const deptCount = await client.query('SELECT COUNT(*) FROM departments');
  console.log('Departments count:', deptCount.rows[0].count);
  const testUsers = await client.query("SELECT email, role, password_hash IS NOT NULL AS has_hash FROM users WHERE email IN ('student@test.com','principal@test.com','hod@test.com','faculty@test.com')");
  console.log('Test users:', JSON.stringify(testUsers.rows));
  client.end();
}).catch(e=>{console.log('Error:',e.message);process.exit(1);});
