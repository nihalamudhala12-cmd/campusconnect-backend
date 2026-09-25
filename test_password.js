const bcrypt = require('bcrypt');
const pg = require('pg');

async function testPasswords() {
  const pool = new pg.Pool({host:'localhost',port:5432,user:'postgres',password:'postgres123',database:'campusconnect'});
  
  try {
    const result = await pool.query('SELECT email,password_hash FROM users WHERE email IN (\'student@test.com\',\'principal@test.com\')');
    
    console.log('Testing passwords for:');
    result.rows.forEach(row => {
      console.log(`  ${row.email}: ${row.password_hash.substring(0,30)}...`);
    });
    
    const passwords = [
      'password','password123','Password123!','Password@123',
      'Student123','student123','Student!123','student@123',
      'CampusConnect123!','Campus@123','CCStudent123!','StudentConnect123!',
      'Principal123','principal123','Principal!123','principal@123',
      'HOD123','hod123','HOD!123','hod@123',
      'Faculty123','faculty123','Faculty!123','faculty@123',
      'Admin123','admin123','Admin!123','admin@123',
      'demo123','Demo123','demo!123','demo@123',
      'test123','Test123','test!123','test@123',
      'welcome123','Welcome123','Welcome!123','Welcome@123',
      'letmein123','Letmein123','Letmein!123','Letmein@123',
      '12345678','123456789','abc123','qwerty'
    ];
    
    console.log('\\nTesting student@test.com (MFA enabled):');
    const studentHash = result.rows.find(r => r.email === 'student@test.com').password_hash;
    for (const pw of passwords) {
      bcrypt.compare(pw, studentHash).then(match => {
        if (match) console.log(`  ✓ MATCH: ${pw}`);
      });
    }
    
    console.log('\\nTesting principal@test.com (no MFA):');
    const principalHash = result.rows.find(r => r.email === 'principal@test.com').password_hash;
    for (const pw of passwords) {
      bcrypt.compare(pw, principalHash).then(match => {
        if (match) console.log(`  ✓ MATCH: ${pw}`);
      });
    }
    
  } finally {
    await pool.end();
  }
}

testPasswords();