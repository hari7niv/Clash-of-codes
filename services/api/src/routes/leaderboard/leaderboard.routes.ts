import { FastifyPluginAsync } from "fastify";
import { getLeaderboard } from "../../repositories/user.repo.js";

export const leaderboardRoutes: FastifyPluginAsync = async (app) => {
  // Add authentication hook to require valid JWT
  app.addHook("onRequest", async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.send(err);
    }
  });

  app.get("/", async (request, reply) => {
    const query = request.query as any;
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 20;
    const tab = query.tab || "global";
    const userId = request.user.sub;

    const data = await getLeaderboard({ page, limit, tab, userId });
    return data;
  });
};
