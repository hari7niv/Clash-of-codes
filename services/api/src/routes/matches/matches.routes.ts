import { FastifyPluginAsync } from "fastify";
import { getMatchById, createSubmission, getMatchResult } from "../../repositories/match.repo.js";

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
      timeRemainingSeconds: 300
    };
  });

  app.post("/:matchId/submissions", async (request, reply) => {
    try {
      const { id: userId } = request.user as { id: string };
      const { matchId } = request.params as any;
      const body = request.body as { code: string; language: string; action: "run" | "submit" };

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

      // Simulated judging verdict mapping to database (we will improve this when judge-worker runs, for now we keep it and clean up placeholder verification)
      const submission = await createSubmission({
        matchId,
        userId,
        problemId: matchData.problem.id,
        language: body.language,
        sourceCode: body.code,
        verdict: "accepted",
        passedTests: 10,
        totalTests: 10,
      });

      return {
        verdict: "Accepted",
        testsPassed: submission.passedTests,
        totalTests: submission.totalTests,
        runtimeMs: 45,
        memoryMb: 12.4
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
};
