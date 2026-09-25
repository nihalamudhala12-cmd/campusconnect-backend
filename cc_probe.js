const pg = require('pg');
const c = new pg.Client({host:'localhost',port:5432,user:'postgres',password:'postgres123',database:'campusconnect'});
c.connect().then(async()=>{
  const users = await c.query("SELECT email, role, department_id, status, password_hash IS NOT NULL AS has_pw, mfa_enabled, profile_completed FROM users ORDER BY email");
  console.log('USERS:', JSON.stringify(users.rows, null, 2));
  const depts = await c.query('SELECT id, code, name FROM departments');
  console.log('DEPTS:', JSON.stringify(depts.rows));
  const profs = await c.query('SELECT COUNT(*) FROM faculty_profiles'); console.log('faculty_profiles:', profs.rows[0].count);
  const students = await c.query('SELECT COUNT(*) FROM student_profiles'); console.log('student_profiles:', students.rows[0].count);
  const att = await c.query('SELECT COUNT(*) FROM attendance'); console.log('attendance:', att.rows[0].count);
  const res = await c.query('SELECT COUNT(*) FROM results'); console.log('results:', res.rows[0].count);
  const ann = await c.query('SELECT COUNT(*) FROM announcements'); console.log('announcements:', ann.rows[0].count);
  const notif = await c.query('SELECT COUNT(*) FROM notifications'); console.log('notifications:', notif.rows[0].count);
  const msg = await c.query('SELECT COUNT(*) FROM messages'); console.log('messages:', msg.rows[0].count);
  const appr = await c.query('SELECT COUNT(*) FROM approvals'); console.log('approvals:', appr.rows[0].count);
  c.end();
}).catch(e=>{console.log('ERR',e.message);process.exit(1);});