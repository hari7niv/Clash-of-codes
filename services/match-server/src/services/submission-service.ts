/**
 * FIX P0 BUG 7: Shared submission service
 * Single source of truth for all submission creation and validation
 * Used by both Socket.IO handler and REST API to prevent duplication
 */

import { pool } from "../db/client.js";
import { Queue } from "bullmq";
import { v4 as uuidv4 } from "uuid";

export interface CreateSubmissionOptions {
  matchId: string;
  userId: string;
  problemId: string;
  language: string;
  sourceCode: string;
  action: "run" | "submit";
}

export interface CreateSubmissionResult {
  success: boolean;
  submissionId?: string;
  error?: string;
  errorCode?: string;
}

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const JUDGE_QUEUE_NAME = process.env.JUDGE_QUEUE_NAME || "judge_submissions";

/**
 * Validates and creates a submission
 * Returns submissionId on success
 * All validation and business logic centralized here
 */
export async function createSubmission(
  options: CreateSubmissionOptions
): Promise<CreateSubmissionResult> {
  const { matchId, userId, problemId, language, sourceCode, action } = options;

  try {
    // Validate required fields
    if (!matchId || !userId || !problemId || !language || !sourceCode) {
      return {
        success: false,
        error: "Missing required fields",
        errorCode: "INVALID_INPUT",
      };
    }

    // Validate language
    const validLanguages = ["typescript", "javascript", "python", "java", "cpp", "c", "go", "rust"];
    if (!validLanguages.includes(language)) {
      return {
        success: false,
        error: `Invalid language: ${language}`,
        errorCode: "INVALID_LANGUAGE",
      };
    }

    // Validate action
    if (action !== "run" && action !== "submit") {
      return {
        success: false,
        error: `Invalid action: ${action}`,
        errorCode: "INVALID_ACTION",
      };
    }

    // Verify match exists and is active
    const matchRes = await pool.query(
      "SELECT id, status, player_one_id, player_two_id FROM matches WHERE id = $1",
      [matchId]
    );

    if (matchRes.rows.length === 0) {
      return {
        success: false,
        error: "Match not found",
        errorCode: "MATCH_NOT_FOUND",
      };
    }

    const match = matchRes.rows[0];

    // Verify user is participant
    const isParticipant = match.player_one_id === userId || match.player_two_id === userId;
    if (!isParticipant) {
      return {
        success: false,
        error: "User is not a participant in this match",
        errorCode: "NOT_AUTHORIZED",
      };
    }

    // Verify match is in valid state for submissions
    if (match.status !== "active" && match.status !== "pending") {
      return {
        success: false,
        error: `Cannot submit to match with status: ${match.status}`,
        errorCode: "INVALID_MATCH_STATE",
      };
    }

    // Verify problem exists
    const problemRes = await pool.query(
      "SELECT id FROM problems WHERE id = $1",
      [problemId]
    );

    if (problemRes.rows.length === 0) {
      return {
        success: false,
        error: "Problem not found",
        errorCode: "PROBLEM_NOT_FOUND",
      };
    }

    // Generate submission ID
    const submissionId = uuidv4();
    const testMode = action === "run" ? "sample" : "full";
    
    // FIX CRITICAL BUG: Persist submission type to distinguish competitive from test runs
    const submissionType = action === "run" ? "test_run" : "competitive";

    // Insert submission record (single source of truth)
    await pool.query(
      `INSERT INTO submissions (
        id, match_id, user_id, problem_id, language, source_code, 
        verdict, passed_tests, total_tests, submission_type, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'pending', 0, 0, $7, NOW())`,
      [submissionId, matchId, userId, problemId, language, sourceCode, submissionType]
    );

    console.log(
      `[Submission Service] ✅ Created submission ${submissionId} for user ${userId} (match ${matchId}, action: ${action})`
    );

    // Enqueue judge job (single source of truth)
    const judgeQueue = new Queue(JUDGE_QUEUE_NAME, {
      connection: {
        url: REDIS_URL,
      },
    });

    await judgeQueue.add(`judge-${submissionId}`, {
      submissionId,
      testMode,
      action,
    });

    await judgeQueue.close();

    console.log(
      `[Submission Service] 📤 Enqueued judge job for submission ${submissionId} (testMode: ${testMode})`
    );

    return {
      success: true,
      submissionId,
    };
  } catch (err: any) {
    console.error("[Submission Service] Error creating submission:", err);
    return {
      success: false,
      error: err.message || "Unknown error",
      errorCode: "INTERNAL_ERROR",
    };
  }
}
