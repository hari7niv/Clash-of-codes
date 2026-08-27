import fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";

import { authRoutes } from "./routes/auth/auth.routes.js";
import { userRoutes } from "./routes/users/user.routes.js";
import { problemRoutes } from "./routes/problems/problem.routes.js";
import { practiceRoutes } from "./routes/practice/practice.routes.js";
import { questRoutes } from "./routes/quests/quests.routes.js";
import { matchmakingRoutes } from "./routes/matchmaking/matchmaking.routes.js";
import { roomRoutes } from "./routes/rooms/rooms.routes.js";
import { matchRoutes } from "./routes/matches/matches.routes.js";
import { leaderboardRoutes } from "./routes/leaderboard/leaderboard.routes.js";
import { socialRoutes } from "./routes/social/social.routes.js";

export const buildApp = async () => {
  const app = fastify({
    logger: true,
  });

  // Plugins
  await app.register(cors, { origin: true }); // Configure origin properly in prod
  await app.register(jwt, {
    secret: process.env.JWT_SECRET || "supersecret-dev-key", // Use robust secret in prod
  });
  await app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
  });

  // Setup basic healthcheck
  app.get("/health", async () => {
    return { status: "ok" };
  });

  // Register routes
  app.register(authRoutes, { prefix: "/api/auth" });
  app.register(userRoutes, { prefix: "/api/users" });
  app.register(problemRoutes, { prefix: "/api/problems" });
  app.register(practiceRoutes, { prefix: "/api/practice" });
  app.register(questRoutes, { prefix: "/api/quests" });
  app.register(matchmakingRoutes, { prefix: "/api/matchmaking" });
  app.register(roomRoutes, { prefix: "/api/rooms" });
  app.register(matchRoutes, { prefix: "/api/matches" });
  app.register(leaderboardRoutes, { prefix: "/api/leaderboard" });
  app.register(socialRoutes, { prefix: "/api/friends" });

  return app;
};
