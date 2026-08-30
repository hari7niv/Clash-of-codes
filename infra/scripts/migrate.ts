import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createPool, MIGRATIONS_DIR } from './db';

/**
 * Minimal forward-only migration runner. Each *.sql file in infra/migrations is
 * applied once, inside its own transaction, and recorded in schema_migrations.
 */
async function main(): Promise<void> {
  const pool = createPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename   TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const appliedRes = await client.query<{ filename: string }>('SELECT filename FROM schema_migrations');
    const applied = new Set(appliedRes.rows.map((r) => r.filename));

    const files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    let appliedCount = 0;
let skippedCount = 0;

for (const file of files) {
  if (applied.has(file)) {
    console.log(`skip   ${file}`);
    skippedCount += 1;
    continue;
  }

  const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');

  console.log(`apply  ${file}`);

  await client.query('BEGIN');

  try {
    await client.query(sql);

    await client.query(
      'INSERT INTO schema_migrations (filename) VALUES ($1)',
      [file],
    );

    await client.query('COMMIT');
    appliedCount += 1;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}

console.log(
  `\nDone. Applied ${appliedCount} migration(s), ` +
  `${skippedCount} already up to date.`,
);  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
