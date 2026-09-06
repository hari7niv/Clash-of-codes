import fp from "fastify-plugin";
import { Redis } from "ioredis";
import { env } from "../config/env.js";

export default fp(async (app) => {
  const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  app.decorate("redis", redis);

  app.addHook("onClose", async () => {
    redis.disconnect();
  });
}, { name: "redis" });
