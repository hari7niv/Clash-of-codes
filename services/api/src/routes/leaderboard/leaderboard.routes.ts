import { FastifyPluginAsync } from "fastify";
import { getLeaderboard } from "../../repositories/user.repo.js";

export const leaderboardRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async (request, reply) => {
    const query = request.query as any;
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 20;

    const data = await getLeaderboard({ page, limit });
    return data;
  });
};
