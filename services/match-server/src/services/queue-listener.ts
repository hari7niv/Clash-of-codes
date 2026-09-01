/**
 * Listens to BullMQ judge_submissions queue for completion events.
 * When a submission is judged, broadcasts the verdict to the match room.
 */

import { QueueEvents, Queue } from "bullmq";
import { Server } from "socket.io";
import type { Redis } from "ioredis";
import { MatchHandler } from "./match-handler.js";
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from "@clashofcode/shared";
import { SOCKET_EVENTS } from "@clashofcode/shared";

export async function listenToMatchQueue(
  io: Server<ClientToServerEvents, ServerToClientEvents, {}, SocketData>,
  redisConnection: Redis,
  matchHandler?: MatchHandler
): Promise<void> {
  const JUDGE_QUEUE_NAME = process.env.JUDGE_QUEUE_NAME || "judge_submissions";

  const queueEvents = new QueueEvents(JUDGE_QUEUE_NAME, {
    connection: redisConnection,
  });

  console.log(
    `[Match Server] 🎧 Listening to judge queue: ${JUDGE_QUEUE_NAME}`
  );

  queueEvents.on("completed", async (args) => {
    try {
      const { jobId, returnvalue } = args;
      console.log(
        `[Match Server] ✅ Judge job ${jobId} completed with verdict`
      );

      // Create a Queue instance to fetch the job details
      const judgeQueue = new Queue(JUDGE_QUEUE_NAME, { connection: redisConnection });
      const job = await judgeQueue.getJob(jobId);

      if (!job) {
        console.warn(`[Match Server] Could not find job ${jobId} in queue`);
        return;
      }

      // Extract submission ID from job data
      const submissionId = job.data?.submissionId;
      if (!submissionId) {
        console.warn(
          `[Match Server] Job ${jobId} missing submissionId in data`
        );
        return;
      }

      // If matchHandler is provided, route verdict to the correct room
      if (matchHandler) {
        const roomId = matchHandler.getRoomForSubmission(submissionId);
        if (!roomId) {
          console.warn(
            `[Match Server] Could not find room for submission ${submissionId}`
          );
          return;
        }

        const room = matchHandler.getRoom(roomId);
        if (!room) {
          console.warn(`[Match Server] Room ${roomId} not found`);
          return;
        }

        // Parse verdict from returnvalue (should be { verdict, passedTests, totalTests, runtimeMs })
        const verdict = returnvalue as any;

        // Update submission with verdict
        matchHandler.updateSubmissionVerdict(
          submissionId,
          verdict.verdict || "error",
          verdict.passedTests || 0,
          verdict.totalTests || 0
        );

        // Get the submitter's user ID
        const submission = room.submissions.get(submissionId);
        if (!submission) {
          console.warn(
            `[Match Server] Submission ${submissionId} not found in room ${roomId}`
          );
          return;
        }

        const submitterId = submission.userId;
        const opponentId = room.playerIds.find((id) => id !== submitterId);

        if (!opponentId) {
          console.warn(
            `[Match Server] Could not find opponent for submission in room ${roomId}`
          );
          return;
        }

        // Emit submission_result to submitter
        io.to(`room:${roomId}`).emit(SOCKET_EVENTS.SUBMISSION_RESULT, {
          roomId,
          submissionId,
          verdict: verdict.verdict || "error",
          passedTests: verdict.passedTests || 0,
          totalTests: verdict.totalTests || 0,
          runtimeMs: verdict.runtimeMs || null,
        });

        // Emit opponent_progress to opponent
        io.to(`room:${roomId}`).emit(SOCKET_EVENTS.OPPONENT_PROGRESS, {
          roomId,
          verdict: verdict.verdict || "error",
          passedTests: verdict.passedTests || 0,
          totalTests: verdict.totalTests || 0,
        });

        console.log(
          `[Match Server] 📊 Broadcast verdict to room ${roomId}: ${verdict.verdict} (${verdict.passedTests}/${verdict.totalTests} tests)`
        );
      }
    } catch (error) {
      console.error(
        `[Match Server] Error handling judge completion event:`,
        error
      );
    }
  });

  queueEvents.on("failed", async (args) => {
    const { jobId, failedReason } = args;
    console.error(
      `[Match Server] ❌ Judge job ${jobId} failed: ${failedReason}`
    );
  });

  // Graceful shutdown
  process.on("SIGINT", async () => {
    await queueEvents.close();
    console.log("[Match Server] QueueEvents closed");
  });
}
