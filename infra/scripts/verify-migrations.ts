/**
 * Verify Migration Status
 * 
 * This script checks which migrations have been applied to the database
 * and which are still pending. Useful for debugging migration issues.
 */

import { readdirSync } from 'node:fs';
import { createPool, MIGRATIONS_DIR } from './db';

async function main(): Promise<void> {
  const pool = createPool();
  const client = await pool.connect();
  
  try {
    console.log("🔍 Checking migration status...\n");

    // Check if migrations table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'schema_migrations'
      ) as exists
    `);

    if (!tableCheck.rows[0].exists) {
      console.log("⚠️  schema_migrations table does not exist!");
      console.log("   Run 'pnpm migrate' to create it and apply migrations.\n");
      return;
    }

    // Get applied migrations
    const appliedRes = await client.query<{ filename: string; applied_at: Date }>(
      'SELECT filename, applied_at FROM schema_migrations ORDER BY filename'
    );
    const applied = new Map(
      appliedRes.rows.map(r => [r.filename, r.applied_at])
    );

    // Get all migration files
    const files = readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort();

    console.log("📊 Migration Status:\n");
    console.log("File                                    | Status         | Applied At");
    console.log("-".repeat(80));

    let pendingCount = 0;
    let appliedCount = 0;

    for (const file of files) {
      const appliedAt = applied.get(file);
      if (appliedAt) {
        console.log(
          `${file.padEnd(40)} | ✅ Applied     | ${appliedAt.toISOString()}`
        );
        appliedCount++;
      } else {
        console.log(
          `${file.padEnd(40)} | ⏳ PENDING     | -`
        );
        pendingCount++;
      }
    }

    console.log("-".repeat(80));
    console.log(`\nSummary: ${appliedCount} applied, ${pendingCount} pending\n`);

    if (pendingCount > 0) {
      console.log("⚠️  You have pending migrations!");
      console.log("   Run 'pnpm migrate' to apply them.\n");
    } else {
      console.log("✅ All migrations are up to date!\n");
    }

    // Check specific critical constraint
    console.log("🔍 Checking critical constraints...\n");

    const constraintCheck = await client.query(`
      SELECT conname, pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conrelid = 'rooms'::regclass 
        AND conname = 'rooms_time_control_valid'
    `);

    if (constraintCheck.rows.length === 0) {
      console.log("❌ rooms.time_control constraint NOT FOUND");
      console.log("   This will cause room creation to fail!");
      console.log("   Migration 0002_update_time_control_values.sql is probably not applied.\n");
    } else {
      const definition = constraintCheck.rows[0].definition;
      console.log(`✅ rooms.time_control constraint exists:`);
      console.log(`   ${definition}`);
      
      // Check if it has the correct values
      const hasBlitz = definition.includes("'blitz'") || definition.includes('"blitz"');
      const hasStandard = definition.includes("'standard'") || definition.includes('"standard"');
      const hasDeep = definition.includes("'deep'") || definition.includes('"deep"');
      const hasOldRapid = definition.includes("'rapid'") || definition.includes('"rapid"');
      const hasOldExtended = definition.includes("'extended'") || definition.includes('"extended"');

      if (hasBlitz && hasStandard && hasDeep && !hasOldRapid && !hasOldExtended) {
        console.log("   ✅ Constraint has correct values (blitz, standard, deep)\n");
      } else {
        console.log("   ⚠️  Constraint may have incorrect values!");
        console.log("      Expected: blitz, standard, deep");
        console.log("      Check if migration 0002_update_time_control_values.sql ran correctly.\n");
      }
    }

  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
