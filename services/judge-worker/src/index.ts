import { Worker } from "bullmq";
import { judgeProcessor } from "./processor.js";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const JUDGE_QUEUE_NAME = process.env.JUDGE_QUEUE_NAME || "judge_submissions";
const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || "2", 10);

async function start() {
  console.log(`🚀 [Judge Worker] Starting...`);
  console.log(`   Redis URL: ${REDIS_URL}`);
  console.log(`   Queue Name: ${JUDGE_QUEUE_NAME}`);
  console.log(`   Concurrency: ${WORKER_CONCURRENCY}`);

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
