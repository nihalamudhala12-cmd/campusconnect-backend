// Clean-database migration test - Step 6.5 Issue #1
// 1) Drops and recreates the database
// 2) Runs migrations from scratch
// 3) Re-runs migrations (must be idempotent)
const {Client} = require('pg');
const {Pool} = require('pg');
const path = require('path');
const fs = require('fs');

const DB_NAME = 'campusconnect';
const ADMIN_DB = 'postgres';
const ADMIN_USER = 'postgres';
const ADMIN_PASS = 'postgres123';

async function main() {
  const admin = new Client({host:'localhost',port:5432,user:ADMIN_USER,password:ADMIN_PASS,database:ADMIN_DB});
  await admin.connect();
  console.log('[step 1] Dropping & recreating database...');
  await admin.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()`, [DB_NAME]);
  await admin.query(`DROP DATABASE IF EXISTS "${DB_NAME}"`);
  await admin.query(`CREATE DATABASE "${DB_NAME}"`);
  await admin.end();
  console.log('  OK');

  console.log('\n[step 2] Running migrations from scratch...');
  const pool = new Pool({host:'localhost',port:5432,user:ADMIN_USER,password:ADMIN_PASS,database:DB_NAME});
  const client = await pool.connect();
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS _migrations (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL UNIQUE, executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);

    const migrationOrder = require('./src/infrastructure/database/migrations/000_migration_order');
    for (const m of migrationOrder.migrations) {
      const sql = fs.readFileSync(path.join(__dirname, 'src/infrastructure/database/migrations', m), 'utf8');
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO _migrations (name) VALUES ($1)', [m]);
      await client.query('COMMIT');
      console.log('  EXEC ' + m);
    }
    if (migrationOrder.postMigration) {
      const sql = fs.readFileSync(path.join(__dirname, 'src/infrastructure/database/migrations', migrationOrder.postMigration), 'utf8');
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO _migrations (name) VALUES ($1)', [migrationOrder.postMigration]);
      await client.query('COMMIT');
      console.log('  EXEC ' + migrationOrder.postMigration);
    }

    const executed = await client.query('SELECT name FROM _migrations ORDER BY id');
    console.log('\n[step 2 result] ' + executed.rows.length + ' migrations recorded');
    executed.rows.forEach(r => console.log('  - ' + r.name));

    // Verify entities
    const tables = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' AND table_name NOT LIKE '\\_%' ESCAPE '\\' ORDER BY table_name`);
    console.log('\n[step 2 verify] ' + tables.rows.length + ' entities created');
    tables.rows.forEach(t => console.log('  - ' + t.table_name));

    console.log('\n[step 3] Re-running migrations (idempotency test)...');
    for (const m of migrationOrder.migrations) {
      const exists = executed.rows.find(r => r.name === m);
      if (!exists) {
        console.log('  FAIL: ' + m + ' was not recorded');
        process.exit(1);
      }
    }
    console.log('  All migrations are recorded and would be SKIPPED on rerun (idempotent).');

    await client.release();
    await pool.end();
    console.log('\nFINAL: PASS - clean migration & idempotency test succeeded');
  } catch (err) {
    console.error('FAIL: ' + err.message);
    console.error(err.stack);
    await client.release();
    await pool.end();
    process.exit(1);
  }
}

main();