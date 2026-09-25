const pg = require('pg');
const c = new pg.Client({host:'localhost',port:5432,user:'postgres',password:'postgres123',database:'campusconnect'});
c.connect().then(async()=>{
  const r = await c.query("SELECT email, role, department_id, created_at FROM users WHERE email = 'rbactest@test.com'");
  console.log('rbactest user:', JSON.stringify(r.rows));
  await c.query("DELETE FROM users WHERE email = 'rbactest@test.com'");
  const r2 = await c.query("SELECT COUNT(*) FROM users WHERE email = 'rbactest@test.com'");
  console.log('After cleanup, rbactest count:', r2.rows[0].count);
  // Also check for cross@test.com
  const r3 = await c.query("SELECT COUNT(*) FROM users WHERE email = 'cross@test.com'");
  console.log('cross@test.com exists:', r3.rows[0].count);
  if (r3.rows[0].count > 0) { await c.query("DELETE FROM users WHERE email = 'cross@test.com'"); }
  const r4 = await c.query("SELECT COUNT(*) FROM users");
  console.log('Total users now:', r4.rows[0].count);
  c.end();
}).catch(e=>{console.log('ERR',e.message);process.exit(1);});