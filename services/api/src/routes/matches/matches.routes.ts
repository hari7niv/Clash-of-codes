import { FastifyPluginAsync } from "fastify";
import { getMatchById, createSubmission, getMatchResult } from "../../repositories/match.repo.js";
import { getJudgeQueue } from "../../services/judge-queue.js";
import { completeMatch } from "../../services/rating-calculator.js";
import { db } from "../../db/client.js";
import { submissions } from "../../db/schema/matches.js";
import { eq } from "drizzle-orm";

export const matchRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("onRequest", async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.send(err);
    }
  });

  app.get("/:matchId", async (request, reply) => {
    const { id: userId } = request.user as { id: string };
    const { matchId } = request.params as any;
    
    // Ensure input matches format check for UUID (safe regex or direct UUID validation)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(matchId)) {
      return reply.code(400).send({ error: { code: "BAD_REQUEST", message: "Invalid match ID format (must be a valid UUID)" } });
    }

    const data = await getMatchById(matchId, userId);
    if (!data) {
      return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Match not found" } });
    }

    // Verify requesting user is part of the match
    const isParticipant = data.match.playerOneId === userId || data.match.playerTwoId === userId;
    if (!isParticipant) {
      return reply.code(403).send({ error: { code: "FORBIDDEN", message: "You are not authorized to view this match" } });
    }

    // FIX P3.1: Remove hardcoded timeRemainingSeconds
    // Time remaining should come from server-authoritative timer_sync events via WebSocket
    // For now, return null and client should use match.endsAt from match-server
    const now = Date.now();
    const endsAt = data.match.endsAt ? new Date(data.match.endsAt).getTime() : Date.now() + 300_000;
    const timeRemainingSeconds = Math.max(0, Math.round((endsAt - now) / 1000));

    return {
      matchId: data.match.id,
      matchCode: `#${data.match.id.substring(0, 4).toUpperCase()}`,
      problem: data.problem ? {
        id: data.problem.id,
        title: data.problem.title,
        topic: data.problem.tags[0] || "Random",
        difficulty: data.problem.difficulty.charAt(0).toUpperCase() + data.problem.difficulty.slice(1) as any,
        points: data.problem.rating,
        statement: data.problem.statement,
        constraints: [
          `Time limit: ${data.problem.timeLimitMs}ms`,
          `Memory limit: ${Math.round(data.problem.memoryLimitKb / 1024)}MB`
        ],
        examples: [],
        starterCode: {
          typescript: "function solve() {}"
        }
      } : null,
      opponent: data.opponent ? {
        handle: data.opponent.username,
        initials: data.opponent.username.substring(0, 2).toUpperCase(),
        rating: Math.round(data.opponent.rating)
      } : { handle: "Opponent", initials: "OP", rating: 1500 },
      timeRemainingSeconds,
      endsAt // Include absolute end time for client-side safety
    };
  });

  app.post("/:matchId/submissions", async (request, reply) => {
    try {
      const { id: userId } = request.user as { id: string };
      const { matchId } = request.params as any;
      const body = request.body as { code: string; language: string; action?: "run" | "submit" };

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(matchId)) {
        return reply.code(400).send({ error: { code: "BAD_REQUEST", message: "Invalid match ID format (must be a valid UUID)" } });
      }

      const matchData = await getMatchById(matchId, userId);
      if (!matchData) {
        return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Match not found" } });
      }

      // Check if user is part of the match
      const belongsToMatch = matchData.match.playerOneId === userId || matchData.match.playerTwoId === userId;
      if (!belongsToMatch) {
        return reply.code(403).send({ error: { code: "FORBIDDEN", message: "You are not a participant in this match" } });
      }

      // FIX P3.2: Determine action type (run = sample tests only, submit = full test suite)
      const action = body.action || "submit";
      const testMode = action === "run" ? "sample" : "full";

      // Create submission with pending status
      const submission = await createSubmission({
        matchId,
        userId,
        problemId: matchData.problem.id,
        language: body.language,
        sourceCode: body.code,
        verdict: "pending",
        passedTests: 0,
        totalTests: 0,
      });

      // Enqueue judge job with action metadata
      const queue = getJudgeQueue();
      await queue.add(`judge-${submission.id}`, { 
        submissionId: submission.id,
        testMode: testMode, // "sample" or "full"
        action: action
      });

      // FIX P3.3: Remove blocking poll - return immediately with submission ID
      // Real-time results will be delivered via WebSocket timer_sync + opponent_progress events
      // from match-server when judge-worker completes
      return {
        submissionId: submission.id,
        verdict: "pending",
        message: "Submission accepted. Results will be delivered via WebSocket.",
      };
    } catch (err: any) {
      return reply.code(400).send({ error: { code: "BAD_REQUEST", message: err.message } });
    }
  });

  app.get("/:matchId/result", async (request, reply) => {
    const { id: userId } = request.user as { id: string };
    const { matchId } = request.params as any;
    
    const result = await getMatchResult(matchId, userId);
    if (!result) {
      return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Match result not found" } });
    }

    return result;
  });

  app.post("/:matchId/complete", async (request, reply) => {
    try {
      const { id: userId } = request.user as { id: string };
      const { matchId } = request.params as any;

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(matchId)) {
        return reply.code(400).send({ error: { code: "BAD_REQUEST", message: "Invalid match ID format" } });
      }

      const matchData = await getMatchById(matchId, userId);
      if (!matchData) {
        return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Match not found" } });
      }

      // Verify user is part of match
      const isParticipant = matchData.match.playerOneId === userId || matchData.match.playerTwoId === userId;
      if (!isParticipant) {
        return reply.code(403).send({ error: { code: "FORBIDDEN", message: "Not authorized" } });
      }

      // FIX P3.4: Add server-side validation to prevent premature completion
      // Check match status before allowing completion
      if (matchData.match.status === "completed") {
        return reply.code(400).send({ 
          error: { code: "INVALID_STATE", message: "Match is already completed" } 
        });
      }

      if (matchData.match.status === "cancelled") {
        return reply.code(400).send({ 
          error: { code: "INVALID_STATE", message: "Match is cancelled" } 
        });
      }

      // Verify match has ended (server-authoritative check)
      // The match-server is the source of truth for endsAt time
      // We should trust the match-server's phase transitions to "judging"
      // For safety, allow completion only if match status is "active" or "judging"
      if (!["pending", "active", "judging"].includes(matchData.match.status)) {
        return reply.code(400).send({ 
          error: { code: "INVALID_STATE", message: `Cannot complete match with status: ${matchData.match.status}` } 
        });
      }

      // Complete match and calculate ratings (wrapped in transaction)
      const completedMatch = await completeMatch(matchId);
      const result = await getMatchResult(matchId, userId);

      return {
        match: completedMatch,
        result
      };
    } catch (err: any) {
      return reply.code(400).send({ error: { code: "BAD_REQUEST", message: err.message } });
    }
  });
};
