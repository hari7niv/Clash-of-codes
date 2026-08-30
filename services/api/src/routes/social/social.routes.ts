import { FastifyPluginAsync } from "fastify";
import { getFriends } from "../../repositories/user.repo.js";

export const socialRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("onRequest", async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.send(err);
    }
  });

  app.get("/", async (request, reply) => {
    const { id } = request.user as { id: string };
    const friends = await getFriends(id);
    return friends;
  });

  app.post("/friends/requests", async (request, reply) => {
    return { success: true };
  });

  app.post("/friends/:handle/challenge", async (request, reply) => {
    const { handle } = request.params as any;
    const roomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
    return { roomCode };
  });

  app.get("/friends/:handle/rivalry", async (request, reply) => {
    const { handle } = request.params as any;
    return { handle, wins: 4, matches: 9, losses: 5 };
  });

  app.post("/friends/:handle/rematch-invite", async (request, reply) => {
    return { success: true };
  });
};
