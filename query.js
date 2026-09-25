const c = require('./infrastructure/database/connection');

async function main() {
  try {
    await c.initialize();
    const r = await c.getPool().query('SELECT id, role, department_id, status FROM users ORDER BY id');
    console.log(JSON.stringify(r.rows, null, 2));
    await c.close(1000);
    process.exit(0);
  } catch (e) {
    console.error(e);
    await c.close(1000).catch(() => {});
    process.exit(1);
  }
}

main();