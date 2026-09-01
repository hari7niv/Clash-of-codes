#!/usr/bin/env tsx

import { getJudgeQueue } from "../src/services/judge-queue.js";
import { db } from "../src/db/client.js";
import { matches, submissions } from "../src/db/schema/matches.js";
import { users } from "../src/db/schema/users.js";
import { problems } from "../src/db/schema/problems.js";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

const TEST_TIMEOUT_MS = 30000;

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runApiTest() {
  console.log("🧪 [API BullMQ Integration Test] Starting...\n");
  
  try {
    console.log("✓ Checking Redis connection...");
    const queue = getJudgeQueue();
    console.log(`✓ Queue initialized: ${queue.name}\n`);

    console.log("✓ Fetching test data...");
    const [testUser] = await db.select().from(users).limit(1);
    const [testProblem] = await db.select().from(problems).limit(1);
    
    if (!testUser || !testProblem) {
      throw new Error("No test data found in database");
    }

    console.log(`✓ Using user: ${testUser.username}`);
    console.log(`✓ Using problem: ${testProblem.slug}\n`);

    // Simulate an API match submission
    console.log("✓ Creating test match and submission...");
    const matchId = uuidv4();
    const submissionId = uuidv4();
    
    // Create a test match first
    const [match] = await db.insert(matches).values({
      id: matchId,
      playerOneId: testUser.id,
      playerTwoId: testUser.id,
      problemId: testProblem.id,
      mode: "ranked",
      status: "active",
    }).returning();

    console.log(`✓ Created match: ${match.id}`);
    
    // Create submission with pending verdict
    const [submission] = await db.insert(submissions).values({
      id: submissionId,
      matchId,
      userId: testUser.id,
      problemId: testProblem.id,
      language: "javascript",
      sourceCode: "console.log(2+3);",
      verdict: "pending",
      passedTests: 0,
      totalTests: 0,
    }).returning();

    console.log(`✓ Created submission: ${submission.id}`);

    // Enqueue judge job
    console.log("✓ Enqueuing judge job...");
    await queue.add(`judge-${submission.id}`, { submissionId: submission.id });
    console.log("✓ Job enqueued\n");

    // Poll for completion
    console.log("⏳ Polling for judge result (max 30 seconds)...");
    const startTime = Date.now();
    let finalVerdict = null;

    while (Date.now() - startTime < TEST_TIMEOUT_MS) {
      const [latest] = await db
        .select()
        .from(submissions)
        .where(eq(submissions.id, submissionId));

      if (latest.verdict !== "pending") {
        finalVerdict = latest;
        break;
      }

      await sleep(500);
    }

    if (!finalVerdict) {
      throw new Error("Judge result timeout");
    }

    console.log(`✓ Judge completed!\n`);
    console.log(`  Verdict: ${finalVerdict.verdict}`);
    console.log(`  Passed Tests: ${finalVerdict.passedTests}/${finalVerdict.totalTests}\n`);

    console.log("✅ API BullMQ integration working correctly!");

    // Cleanup
    console.log("Cleaning up...");
    await db.delete(submissions).where(eq(submissions.id, submissionId));
    await db.delete(matches).where(eq(matches.id, matchId));
    
  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

runApiTest();
