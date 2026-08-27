import { FastifyPluginAsync } from "fastify";
import { getUserById, getUserByUsername, updateUser, toPlayerProfile, toPublicUser } from "../../repositories/user.repo.js";

export const userRoutes: FastifyPluginAsync = async (app) => {
  // Pre-handler hook to simulate auth for these routes
  app.addHook("onRequest", async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.send(err);
    }
  });

  app.get("/me", async (request, reply) => {
    const { id } = request.user as { id: string };
    
    const user = await getUserById(id);
    if (!user) {
      return reply.code(404).send({ error: { code: "NOT_FOUND", message: "User not found" } });
    }

    return toPlayerProfile(user);
  });

  app.get("/:handle", async (request, reply) => {
    const { handle } = request.params as any;
    const user = await getUserByUsername(handle);
    if (!user) {
      return reply.code(404).send({ error: { code: "NOT_FOUND", message: "User not found" } });
    }
    return toPublicUser(user);
  });

  app.patch("/me", async (request, reply) => {
    const { id } = request.user as { id: string };
    const body = request.body as { handle?: string; name?: string };
    
    const username = body.handle || body.name;
    const user = await updateUser(id, { username });
    if (!user) {
      return reply.code(404).send({ error: { code: "NOT_FOUND", message: "User not found" } });
    }

    return toPublicUser(user);
  });

  app.get("/me/mastery", async (request, reply) => {
    return [
      { topic: "Arrays", value: 80, tone: "lime" },
      { topic: "Graphs", value: 40, tone: "amber" }
    ];
  });

  app.get("/me/achievements", async (request, reply) => {
    return [
      { title: "First Win", text: "Win a battle", state: "earned", mark: "✓" }
    ];
  });

  app.get("/me/battles", async (request, reply) => {
    return [
      { opponent: "alice123", initials: "AL", title: "Two Sum", topic: "Arrays", result: "WIN", delta: "+15", duration: "5m", level: "Easy" }
    ];
  });

  app.delete("/me", async (request, reply) => {
    return reply.code(200).send({ success: true });
  });

  app.get("/me/export", async (request, reply) => {
    return reply.code(200).send({ data: "exported data" });
  });
};
