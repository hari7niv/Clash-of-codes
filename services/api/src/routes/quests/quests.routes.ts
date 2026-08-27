import { FastifyPluginAsync } from "fastify";

export const questRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("onRequest", async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.send(err);
    }
  });

  app.get("/today", async (request, reply) => {
    return [
      { icon: "01", title: "Enter the Arena", detail: "Play 1 battle", progress: 0, total: 1, reward: "+120 XP", complete: false },
      { icon: "02", title: "Tree Hunter", detail: "Solve 2 tree problems", progress: 1, total: 2, reward: "+180 XP", complete: false },
      { icon: "03", title: "Keep the Fire", detail: "Maintain your daily streak", progress: 1, total: 1, reward: "+80 XP", complete: true }
    ];
  });
};
