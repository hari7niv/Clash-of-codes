import { Worker } from "bullmq";
import { judgeProcessor } from "./processor.js";
import axios from "axios";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const JUDGE_QUEUE_NAME = process.env.JUDGE_QUEUE_NAME || "judge_submissions";
const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || "2", 10);
const JUDGE0_URL = process.env.JUDGE0_URL || "http://localhost:2358";

async function checkJudge0Health() {
  try {
    console.log(`[Judge Worker] Checking Judge0 health at ${JUDGE0_URL}...`);
    await axios.get(`${JUDGE0_URL}/about`, { timeout: 3000 });
    console.log(`[Judge Worker] ✅ Judge0 is reachable`);
    return true;
  } catch (error: any) {
    console.error(`[Judge Worker] ⚠️  WARNING: Judge0 is NOT reachable at ${JUDGE0_URL}`);
    console.error(`[Judge Worker] Error: ${error.message}`);
    console.error(`[Judge Worker] All submissions will fail with INTERNAL_ERROR until Judge0 is available.`);
    console.error(`[Judge Worker] `);
    console.error(`[Judge Worker] On Windows, Judge0 cannot run natively (requires Linux cgroups).`);
    console.error(`[Judge Worker] Options:`);
    console.error(`[Judge Worker]   1. Run Judge0 in Docker: docker-compose up judge0`);
    console.error(`[Judge Worker]   2. Use mock Judge0: Start infra/judge0/mock-judge0-server.js`);
    console.error(`[Judge Worker]   3. Point JUDGE0_URL to a remote Judge0 instance`);
    console.error(`[Judge Worker] `);
    return false;
  }
}

async function start() {
  console.log(`🚀 [Judge Worker] Starting...`);
  console.log(`   Redis URL: ${REDIS_URL}`);
  console.log(`   Queue Name: ${JUDGE_QUEUE_NAME}`);
  console.log(`   Concurrency: ${WORKER_CONCURRENCY}`);
  console.log(`   Judge0 URL: ${JUDGE0_URL}`);

  // Check Judge0 availability at startup
  await checkJudge0Health();

  const worker = new Worker(JUDGE_QUEUE_NAME, judgeProcessor, {
    connection: {
      // BullMQ will parse the Redis URL
      url: REDIS_URL,
      maxRetriesPerRequest: null, // Required for BullMQ blocking operations
    },
    concurrency: WORKER_CONCURRENCY,
  });

  // Event handlers
  worker.on("completed", (job) => {
    console.log(`[Judge Worker] ✅ Job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(
      `[Judge Worker] ❌ Job ${job?.id} failed:`,
      err.message
    );
  });

  worker.on("error", (error) => {
    console.error(`[Judge Worker] Worker error:`, error);
  });

  worker.on("stalled", (jobId, reason) => {
    console.warn(`[Judge Worker] Job ${jobId} stalled: ${reason}`);
  });

  console.log(`✅ Judge Worker ready! Listening for jobs on queue: ${JUDGE_QUEUE_NAME}`);

  // Handle graceful shutdown
  const shutdown = async () => {
    console.log(`\n[Judge Worker] Shutting down...`);
    await worker.close();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

start().catch((error) => {
  console.error(`[Judge Worker] Failed to start:`, error);
  process.exit(1);
});
