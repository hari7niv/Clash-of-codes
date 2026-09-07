import { Queue } from "bullmq";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const JUDGE_QUEUE_NAME = process.env.JUDGE_QUEUE_NAME || "judge";

let judgeQueue: Queue | null = null;

export function getJudgeQueue(): Queue {
  if (!judgeQueue) {
    judgeQueue = new Queue(JUDGE_QUEUE_NAME, {
      connection: {
        url: REDIS_URL,
        maxRetriesPerRequest: null, // Required for BullMQ blocking operations
      },
    });
  }
  return judgeQueue;
}

export async function closeJudgeQueue(): Promise<void> {
  if (judgeQueue) {
    await judgeQueue.close();
    judgeQueue = null;
  }
}
