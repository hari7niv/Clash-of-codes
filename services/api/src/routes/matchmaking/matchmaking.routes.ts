import { FastifyPluginAsync } from "fastify";
import { Redis } from "ioredis";
import { db } from "../../db/client.js";
import { users } from "../../db/schema/users.js";
import { eq } from "drizzle-orm";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null, // BullMQ compatibility
});

export const matchmakingRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("onRequest", async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.send(err);
    }
  });

  app.get("/status", async (request, reply) => {
    try {
      const { id: userId } = request.user as { id: string };

      const [user] = await db.select().from(users).where(eq(users.id, userId));
      const userRating = user ? Math.round(user.rating) : 1500;

      // Read real Redis queue sizes
      const [rankedCount, casualCount] = await Promise.all([
        redis.zcard("queue:ranked"),
        redis.zcard("queue:casual"),
      ]);

      const totalQueued = rankedCount + casualCount;
      const estWaitSeconds = totalQueued > 0 ? Math.max(3, Math.round(10 / totalQueued)) : 10;

      return {
        playersOnline: Math.max(totalQueued + 1, 1),
        yourRating: userRating,
        estWaitSeconds,
        queueDepth: {
          ranked: rankedCount,
          casual: casualCount,
          total: totalQueued,
        },
      };
    } catch (err: any) {
      return reply.code(500).send({ error: { code: "INTERNAL_ERROR", message: err.message } });
    }
  });

  app.delete("/queue", async (request, reply) => {
    try {
      const { id: userId } = request.user as { id: string };

      await Promise.all([
        redis.zrem("queue:ranked", userId),
        redis.zrem("queue:casual", userId),
        redis.del(`user:${userId}:queue`),
      ]);

      return { success: true };
    } catch (err: any) {
      return reply.code(500).send({ error: { code: "INTERNAL_ERROR", message: err.message } });
    }
  });
};
