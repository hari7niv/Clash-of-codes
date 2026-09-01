import { Queue } from "bullmq";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const JUDGE_QUEUE_NAME = process.env.JUDGE_QUEUE_NAME || "judge_submissions";

let judgeQueue: Queue | null = null;

export function getJudgeQueue(): Queue {
  if (!judgeQueue) {
    judgeQueue = new Queue(JUDGE_QUEUE_NAME, {
      connection: {
        url: REDIS_URL,
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
