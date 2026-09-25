const { Pool } = require('pg');
const p = new Pool({host:'localhost',port:5432,database:'campusconnect',user:'postgres',password:'postgres123'});
p.query("SELECT table_name, string_agg(column_name, ', ' ORDER BY ordinal_position) as cols FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('users','classes','courses','class_courses','enrolment','timetable_entries','results','attendance','announcements','notifications','messages','approvals','chat_rooms','departments','faculty_profiles','student_profiles','system_config') GROUP BY table_name ORDER BY table_name").then(r=>{
  r.rows.forEach(r2=>console.log(r2.table_name+': '+r2.cols));
  p.end();
}).catch(e=>{console.error('ERR:',e.message);p.end()});
