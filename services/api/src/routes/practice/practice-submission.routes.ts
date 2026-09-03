import { FastifyPluginAsync } from "fastify";
import { createSubmission, getSubmissionById } from "../../repositories/match.repo.js";
import { getProblemById } from "../../repositories/problem.repo.js";
import { getJudgeQueue } from "../../services/judge-queue.js";

/**
 * Practice submission routes - handles solo practice submissions
 * Creates a practice match context for submissions outside of competitive matches
 */
export const practiceSubmissionRoutes: FastifyPluginAsync = async (app) => {
  
  // Submit practice solution
  app.post("/submit", async (request, reply) => {
    try {
      const { id: userId } = request.user as { id: string };
      const body = request.body as { 
        problemId: string; 
        language: string; 
        code: string;
        action?: "run" | "submit" 
      };

      if (!body.problemId || !body.language || !body.code) {
        return reply.code(400).send({ 
          error: { 
            code: "BAD_REQUEST", 
            message: "Missing required fields: problemId, language, code" 
          } 
        });
      }

      // Verify problem exists
      const problem = await getProblemById(body.problemId);
      if (!problem) {
        return reply.code(404).send({ 
          error: { 
            code: "NOT_FOUND", 
            message: "Problem not found" 
          } 
        });
      }

      const action = body.action || "submit";
      const testMode = action === "run" ? "sample" : "full";

      // Create submission with practice flag (matchId = null for practice)
      const submission = await createSubmission({
        matchId: null, // Practice submissions don't have a match
        userId,
        problemId: body.problemId,
        language: body.language,
        sourceCode: body.code,
        verdict: "pending",
        passedTests: 0,
        totalTests: 0,
      });

      // Enqueue judge job
      const queue = getJudgeQueue();
      await queue.add(`judge-${submission.id}`, { 
        submissionId: submission.id,
        testMode: testMode,
        action: action,
        isPractice: true // Flag to indicate practice submission
      });

      return {
        submissionId: submission.id,
        status: "pending"
      };

    } catch (err: any) {
      console.error("Practice submission error:", err);
      return reply.code(500).send({ 
        error: { 
          code: "INTERNAL_ERROR", 
          message: "Failed to process submission" 
        } 
      });
    }
  });

  // Get practice submission result
  app.get("/submissions/:submissionId", async (request, reply) => {
    try {
      const { id: userId } = request.user as { id: string };
      const { submissionId } = request.params as { submissionId: string };

      const submission = await getSubmissionById(submissionId);
      
      if (!submission) {
        return reply.code(404).send({ 
          error: { 
            code: "NOT_FOUND", 
            message: "Submission not found" 
          } 
        });
      }

      // Verify ownership
      if (submission.userId !== userId) {
        return reply.code(403).send({ 
          error: { 
            code: "FORBIDDEN", 
            message: "You don't have access to this submission" 
          } 
        });
      }

      return {
        id: submission.id,
        verdict: submission.verdict,
        passedTests: submission.passedTests,
        totalTests: submission.totalTests,
        runtimeMs: submission.runtimeMs,
        memoryKb: submission.memoryKb,
        createdAt: submission.createdAt
      };

    } catch (err: any) {
      console.error("Get submission error:", err);
      return reply.code(500).send({ 
        error: { 
          code: "INTERNAL_ERROR", 
          message: "Failed to fetch submission" 
        } 
      });
    }
  });
};
