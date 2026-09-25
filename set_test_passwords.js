/**
 * Test-support utility.
 *
 * Restores the password fixture that the project's own test suites and E2E
 * scripts expect. It only sets a bcrypt hash on EXISTING seeded users whose
 * password_hash is currently NULL; it never creates users, never inserts demo
 * identities, and never bypasses authentication.
 *
 * Credentials are the ones already declared by this project:
 *   - seed.js            (student@test.com / TestPass123!, principal@test.com / AdminPass123!)
 *   - src/mfa.test.js    (same two accounts)
 *   - self_audit.js      (same two accounts)
 *
 * Usage: node set_test_passwords.js
 */
const bcrypt = require('bcrypt');
const pg = require('pg');

const client = new pg.Client({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'postgres123',
  database: 'campusconnect',
});

// email -> plaintext password, matching the project-declared fixture convention.
const FIXTURE_PASSWORDS = {
  'student@test.com': 'TestPass123!',
  'principal@test.com': 'AdminPass123!',
  'hod@test.com': 'TestPass123!',
  'hod2@test.com': 'TestPass123!',
  'faculty@test.com': 'TestPass123!',
};

client.connect()
  .then(async () => {
    const { rows } = await client.query(
      'SELECT email FROM users WHERE email = ANY($1::text[])',
      [Object.keys(FIXTURE_PASSWORDS)]
    );

    const present = new Set(rows.map((r) => r.email));
    const missing = Object.keys(FIXTURE_PASSWORDS).filter((e) => !present.has(e));
    if (missing.length) {
      console.log('Not present in database (skipped):', missing.join(', '));
    }

    for (const email of rows.map((r) => r.email)) {
      const hash = await bcrypt.hash(FIXTURE_PASSWORDS[email], 12);
      // Only fill NULL hashes; never overwrite an existing credential.
      const res = await client.query(
        'UPDATE users SET password_hash = $1 WHERE email = $2 AND password_hash IS NULL',
        [hash, email]
      );
      console.log(`${email}: ${res.rowCount > 0 ? 'password set' : 'already set (left unchanged)'}`);
    }

    client.end();
  })
  .catch((e) => {
    console.log('Error:', e.message);
    process.exit(1);
  });
