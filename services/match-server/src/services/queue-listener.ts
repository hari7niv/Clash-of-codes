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

      // Check if this is a practice submission (no room notification needed)
      const isPractice = job.data?.isPractice === true;
      if (isPractice) {
        console.log(
          `[Match Server] 📝 Practice submission ${submissionId} completed, no room notification needed`
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

        // Parse verdict from returnvalue (should be { verdict, passedTests, totalTests, runtimeMs, testResults })
        const verdict = returnvalue as any;

        // Extract console output from first failed test or last test
        let stdout = "";
        let stderr = "";
        let compileOutput = "";
        
        if (verdict.testResults && Array.isArray(verdict.testResults)) {
          // Find first failed test, or use last test if all passed
          const failedTest = verdict.testResults.find((t: any) => !t.passed);
          const testToShow = failedTest || verdict.testResults[verdict.testResults.length - 1];
          
          if (testToShow) {
            stdout = testToShow.stdout || "";
            stderr = testToShow.stderr || "";
            compileOutput = testToShow.compileOutput || "";
          }
        }

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

        const submitterSocketId = matchHandler.getSocketForUser(submitterId);
        if (submitterSocketId) {
          io.to(submitterSocketId).emit(SOCKET_EVENTS.SUBMISSION_RESULT, {
            roomId,
            submissionId,
            verdict: verdict.verdict || "error",
            passedTests: verdict.passedTests || 0,
            totalTests: verdict.totalTests || 0,
            runtimeMs: verdict.runtimeMs || null,
            stdout,
            stderr,
            compileOutput,
            testResults: verdict.testResults || [],
          });
        }

        const opponentSocketId = matchHandler.getSocketForUser(opponentId);
        if (opponentSocketId) {
          io.to(opponentSocketId).emit(SOCKET_EVENTS.OPPONENT_PROGRESS, {
            roomId,
            verdict: verdict.verdict || "error",
            passedTests: verdict.passedTests || 0,
            totalTests: verdict.totalTests || 0,
          });
        }

        console.log(
          `[Match Server] 📊 Sent verdict to submitter ${submitterId} and progress to opponent in room ${roomId}: ${verdict.verdict} (${verdict.passedTests}/${verdict.totalTests} tests)`
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
