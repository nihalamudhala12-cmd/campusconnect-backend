/**
 * Drop and recreate the campusconnect database
 * Step 6.5 — Database Design (verification helper)
 */

const { Client } = require('pg');

const DB_NAME = 'campusconnect';
const ADMIN_DB = 'postgres';

async function main() {
  const admin = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres123',
    database: ADMIN_DB,
  });

  try {
    await admin.connect();

    // Terminate any active connections to the target database
    await admin.query(`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = $1 AND pid <> pg_backend_pid()
    `, [DB_NAME]);

    // Drop database
    await admin.query(`DROP DATABASE IF EXISTS "${DB_NAME}"`);
    console.log(`OK: dropped ${DB_NAME}`);

    // Create database
    await admin.query(`CREATE DATABASE "${DB_NAME}"`);
    console.log(`OK: created ${DB_NAME}`);

    await admin.end();
    process.exit(0);
  } catch (err) {
    console.error('FAIL:', err.message);
    process.exit(1);
  }
}

main();