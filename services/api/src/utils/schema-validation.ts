/**
 * Schema Validation - Startup checks to ensure DB schema matches code expectations
 * 
 * This prevents cryptic runtime errors caused by pending migrations.
 * If any validation fails, the server logs a loud warning but continues to start
 * (to avoid breaking development workflows), but the warning should be addressed immediately.
 */

import { db } from "../db/client.js";
import { sql } from "drizzle-orm";

interface ValidationResult {
  passed: boolean;
  check: string;
  expected: string;
  actual: string;
  severity: "error" | "warning";
}

/**
 * Validate that critical database constraints match code expectations
 */
export async function validateSchemaOnStartup(): Promise<void> {
  console.log("\n🔍 Running schema validation checks...");
  
  const results: ValidationResult[] = [];

  // Check 1: time_control constraint on rooms table
  try {
    const constraintCheck = await db.execute(sql`
      SELECT conname, pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conrelid = 'rooms'::regclass 
        AND conname = 'rooms_time_control_valid'
    `);

    const constraint = constraintCheck.rows[0];
    const expectedValues = ["blitz", "standard", "deep"];
    
    if (!constraint) {
      results.push({
        passed: false,
        check: "rooms.time_control constraint",
        expected: `CHECK (time_control IN ('blitz', 'standard', 'deep'))`,
        actual: "CONSTRAINT NOT FOUND",
        severity: "error"
      });
    } else {
      const definition = String(constraint.definition);
      const hasAllValues = expectedValues.every(val => 
        definition.includes(`'${val}'`) || definition.includes(`"${val}"`)
      );
      const hasOldValues = definition.includes("'rapid'") || definition.includes("'extended'");
      
      if (!hasAllValues || hasOldValues) {
        results.push({
          passed: false,
          check: "rooms.time_control constraint",
          expected: `CHECK (time_control IN ('blitz', 'standard', 'deep'))`,
          actual: definition,
          severity: "error"
        });
      } else {
        results.push({
          passed: true,
          check: "rooms.time_control constraint",
          expected: "Valid values: blitz, standard, deep",
          actual: "✓ Correct",
          severity: "warning"
        });
      }
    }
  } catch (err) {
    results.push({
      passed: false,
      check: "rooms.time_control constraint",
      expected: "Readable constraint",
      actual: `Error checking: ${err instanceof Error ? err.message : String(err)}`,
      severity: "error"
    });
  }

  // Check 2: Verify critical migrations are applied
  try {
    const migrationsCheck = await db.execute(sql`
      SELECT filename FROM schema_migrations
      WHERE filename IN (
        '0002_update_time_control_values.sql',
        '0003_add_user_preferences.sql',
        '0003_room_fields_and_membership.sql'
      )
      ORDER BY filename
    `);

    const appliedMigrations = migrationsCheck.rows.map(r => String(r.filename));
    const requiredMigrations = [
      '0002_update_time_control_values.sql',
      '0003_add_user_preferences.sql',
      '0003_room_fields_and_membership.sql'
    ];

    const missingMigrations = requiredMigrations.filter(
      m => !appliedMigrations.includes(m)
    );

    if (missingMigrations.length > 0) {
      results.push({
        passed: false,
        check: "Required migrations",
        expected: requiredMigrations.join(", "),
        actual: `Missing: ${missingMigrations.join(", ")}`,
        severity: "error"
      });
    } else {
      results.push({
        passed: true,
        check: "Required migrations",
        expected: "All critical migrations applied",
        actual: "✓ All present",
        severity: "warning"
      });
    }
  } catch (err) {
    results.push({
      passed: false,
      check: "Required migrations",
      expected: "Readable migrations table",
      actual: `Error checking: ${err instanceof Error ? err.message : String(err)}`,
      severity: "warning" // Don't block startup if migrations table doesn't exist yet
    });
  }

  // Check 3: Verify user_preferences columns exist
  try {
    const columnCheck = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
        AND column_name IN ('preferred_language', 'editor_theme', 'notifications_enabled')
    `);

    const foundColumns = columnCheck.rows.map(r => String(r.column_name));
    const requiredColumns = ['preferred_language', 'editor_theme', 'notifications_enabled'];
    const missingColumns = requiredColumns.filter(c => !foundColumns.includes(c));

    if (missingColumns.length > 0) {
      results.push({
        passed: false,
        check: "users table preferences columns",
        expected: requiredColumns.join(", "),
        actual: `Missing: ${missingColumns.join(", ")}`,
        severity: "warning" // Warning since these are non-critical features
      });
    } else {
      results.push({
        passed: true,
        check: "users table preferences columns",
        expected: "All preference columns present",
        actual: "✓ All present",
        severity: "warning"
      });
    }
  } catch (err) {
    results.push({
      passed: false,
      check: "users table preferences columns",
      expected: "Readable columns",
      actual: `Error checking: ${err instanceof Error ? err.message : String(err)}`,
      severity: "warning"
    });
  }

  // Print results
  const errors = results.filter(r => !r.passed && r.severity === "error");
  const warnings = results.filter(r => !r.passed && r.severity === "warning");
  const passed = results.filter(r => r.passed);

  console.log(`\n✅ Passed: ${passed.length}`);
  passed.forEach(r => {
    console.log(`   ${r.check}: ${r.actual}`);
  });

  if (warnings.length > 0) {
    console.log(`\n⚠️  Warnings: ${warnings.length}`);
    warnings.forEach(r => {
      console.log(`   ${r.check}:`);
      console.log(`      Expected: ${r.expected}`);
      console.log(`      Actual:   ${r.actual}`);
    });
  }

  if (errors.length > 0) {
    console.log("\n");
    console.log("═".repeat(80));
    console.log("🚨 CRITICAL SCHEMA VALIDATION ERRORS DETECTED 🚨");
    console.log("═".repeat(80));
    console.log("\nThe database schema does NOT match what the code expects.");
    console.log("This will cause runtime errors when creating rooms, updating users, etc.\n");
    
    errors.forEach(r => {
      console.log(`❌ ${r.check}`);
      console.log(`   Expected: ${r.expected}`);
      console.log(`   Actual:   ${r.actual}`);
      console.log("");
    });

    console.log("🔧 TO FIX: Run pending migrations from the workspace root:");
    console.log("   pnpm migrate");
    console.log("");
    console.log("Then restart this server.");
    console.log("═".repeat(80));
    console.log("\n⚠️  Server will continue starting but WILL HAVE RUNTIME ERRORS\n");
  } else {
    console.log("\n✅ All schema validation checks passed!\n");
  }
}

/**
 * Quick check if critical migrations are pending
 */
export async function checkPendingMigrations(): Promise<string[]> {
  try {
    const migrationsCheck = await db.execute(sql`
      SELECT filename FROM schema_migrations
    `);

    const appliedMigrations = new Set(
      migrationsCheck.rows.map(r => String(r.filename))
    );

    // List of all known migrations that should be applied
    const allMigrations = [
      '0001_init.sql',
      '0002_auth_tokens_profiles.sql',
      '0002_update_time_control_values.sql',
      '0003_add_user_preferences.sql',
      '0003_room_fields_and_membership.sql',
      '0004_progress_quests_social.sql',
      '0005_indexes_constraints.sql'
    ];

    return allMigrations.filter(m => !appliedMigrations.has(m));
  } catch (err) {
    console.error("Error checking pending migrations:", err);
    return [];
  }
}
