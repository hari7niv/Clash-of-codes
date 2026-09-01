/**
 * Standalone test script to verify judge-worker processes a submission end-to-end.
 * 
 * Usage:
 *   cd services/judge-worker
 *   npx tsx scripts/test-single-submission.ts
 * 
 * This script:
 * 1. Connects to the database
 * 2. Creates a test submission
 * 3. Enqueues a judge job in Redis
 * 4. Polls for the job result
 * 5. Verifies the submission was updated with verdict
 * 6. Cleans up
 */

import postgres from "postgres";
import { Queue } from "bullmq";
import { setTimeout as sleep } from "timers/promises";

const DATABASE_URL = process.env.DATABASE_URL || "postgres://clash:clash@localhost:5440/clashofcode";
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const JUDGE_QUEUE_NAME = process.env.JUDGE_QUEUE_NAME || "judge_submissions";

interface Submission {
  id: string;
  match_id?: string;
  user_id: string;
  problem_id: string;
  language: string;
  source_code: string;
  verdict?: string;
  passed_tests?: number;
  total_tests?: number;
  created_at: Date;
}

async function main() {
  console.log(`🧪 [Judge Worker Test] Starting standalone test...`);
  console.log(`   Database: ${DATABASE_URL}`);
  console.log(`   Redis: ${REDIS_URL}`);
  console.log(`   Queue: ${JUDGE_QUEUE_NAME}\n`);

  const sql = postgres(DATABASE_URL);
  const queue = new Queue(JUDGE_QUEUE_NAME, {
    connection: { url: REDIS_URL },
  });

  try {
    // Verify database connection
    console.log(`✓ Connecting to database...`);
    const result = await sql`SELECT 1 as ok`;
    console.log(`✓ Database connected\n`);

    // Get first problem (for testing)
    console.log(`✓ Fetching first problem...`);
    const problems = await sql`
      SELECT id, slug FROM problems LIMIT 1
    `;

    if (!problems.length) {
      throw new Error("No problems found in database. Run seed script first.");
    }

    const problem = problems[0];
    console.log(`✓ Using problem: ${problem.slug}\n`);

    // Get first user (for testing)
    console.log(`✓ Fetching first user...`);
    const users = await sql`
      SELECT id, username FROM users LIMIT 1
    `;

    if (!users.length) {
      throw new Error("No users found in database. Run seed script first.");
    }

    const user = users[0];
    console.log(`✓ Using user: ${user.username}\n`);

    // Create a test submission
    const testSourceCode = `
console.log(2 + 3)
`.trim();

    console.log(`✓ Creating test submission...`);
    const submissions = await sql`
      INSERT INTO submissions (
        user_id,
        problem_id,
        language,
        source_code,
        verdict,
        created_at
      ) VALUES (
        ${user.id},
        ${problem.id},
        'javascript',
        ${testSourceCode},
        'pending',
        NOW()
      )
      RETURNING *
    `;

    const submission = submissions[0] as Submission;
    console.log(`✓ Created submission: ${submission.id}\n`);

    // Enqueue judge job
    console.log(`✓ Enqueuing judge job...`);
    const job = await queue.add("judge", {
      submissionId: submission.id,
    });

    console.log(`✓ Job enqueued: ${job.id}\n`);

    // Wait for job to complete
    console.log(`⏳ Waiting for judge to process (max 30 seconds)...`);
    let completed = false;
    let attempts = 0;
    const maxAttempts = 30;

    while (!completed && attempts < maxAttempts) {
      await sleep(1000);
      attempts++;

      // Check if submission was updated
      const updatedSubmissions = await sql`
        SELECT * FROM submissions WHERE id = ${submission.id}
      `;

      if (updatedSubmissions.length && updatedSubmissions[0].verdict !== "pending") {
        completed = true;
        const updated = updatedSubmissions[0] as Submission;
        console.log(`✓ Judge completed!\n`);
        console.log(`  Verdict: ${updated.verdict}`);
        console.log(`  Passed Tests: ${updated.passed_tests}/${updated.total_tests}`);
        break;
      }

      if (attempts % 5 === 0) {
        console.log(`  ... ${attempts}s elapsed`);
      }
    }

    if (!completed) {
      console.log(`❌ Judge did not complete within timeout`);
      console.log(`\nTroubleshooting:`);
      console.log(`  1. Verify worker is running: pnpm dev (in another terminal)`);
      console.log(`  2. Verify Redis is running: docker ps | grep redis`);
      console.log(`  3. Check worker logs for errors`);
      process.exit(1);
    }

    console.log(`\n✅ Test passed! Judge-worker is working correctly.\n`);

    // Cleanup
    console.log(`Cleaning up...`);
    await sql`DELETE FROM submissions WHERE id = ${submission.id}`;
    await queue.close();
    await sql.end();

  } catch (error) {
    console.error(`❌ Test failed:`, error);
    try {
      await queue.close();
      await sql.end();
    } catch (e) {
      // Ignore cleanup errors
    }
    process.exit(1);
  }
}

main().catch(console.error);
