const { Pool } = require('pg');
const p = new Pool({host:'localhost',port:5432,database:'campusconnect',user:'postgres',password:'postgres123'});
p.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='system_config' ORDER BY ordinal_position").then(r=>{
  r.rows.forEach(r2=>console.log(r2.column_name+': '+r2.data_type));
  p.end();
}).catch(e=>{console.error('ERR:',e.message);p.end();});
