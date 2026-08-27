import { FastifyPluginAsync } from "fastify";

export const matchmakingRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("onRequest", async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.send(err);
    }
  });

  app.get("/status", async (request, reply) => {
    return {
      playersOnline: 142,
      yourRating: 1842,
      estWaitSeconds: 8
    };
  });

  app.delete("/queue", async (request, reply) => {
    return { success: true };
  });
};
