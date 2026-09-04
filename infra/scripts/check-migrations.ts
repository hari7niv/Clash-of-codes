import { readdirSync } from 'node:fs';
import { createPool, MIGRATIONS_DIR } from './db';

/**
 * Check if there are pending migrations that haven't been applied.
 * Returns: { upToDate: boolean, pending: string[], applied: string[] }
 * 
 * This can be called at API server startup to warn developers about
 * missing migrations rather than letting them discover it through
 * cryptic runtime errors.
 */
export async function checkMigrations(): Promise<{
  upToDate: boolean;
  pending: string[];
  applied: string[];
}> {
  const pool = createPool();
  const client = await pool.connect();
  
  try {
    // Ensure migrations table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename   TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const appliedRes = await client.query<{ filename: string }>(
      'SELECT filename FROM schema_migrations ORDER BY filename'
    );
    const applied = appliedRes.rows.map((r) => r.filename);
    const appliedSet = new Set(applied);

    const files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    const pending = files.filter((f) => !appliedSet.has(f));

    return {
      upToDate: pending.length === 0,
      pending,
      applied,
    };
  } finally {
    client.release();
    await pool.end();
  }
}

/**
 * Standalone CLI tool to check migration status
 */
async function main(): Promise<void> {
  const status = await checkMigrations();

  console.log('\n📋 Migration Status');
  console.log('==================\n');

  console.log(`Applied: ${status.applied.length} migration(s)`);
  status.applied.forEach((f) => console.log(`  ✓ ${f}`));

  if (status.pending.length > 0) {
    console.log(`\n⚠️  Pending: ${status.pending.length} migration(s)`);
    status.pending.forEach((f) => console.log(`  ⚠  ${f}`));
    console.log('\n❌ Database is OUT OF DATE!');
    console.log('   Run: pnpm migrate\n');
    process.exit(1);
  } else {
    console.log('\n✅ Database is up to date!\n');
  }
}

// Run as CLI if executed directly
if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
  main().catch((err) => {
    console.error('Check failed:', err);
    process.exit(1);
  });
}
