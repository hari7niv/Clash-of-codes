import { FastifyPluginAsync } from "fastify";
import { getUserById, getUserByUsername, updateUser, toPlayerProfile, toPublicUser, getFriends } from "../../repositories/user.repo.js";
import { db } from "../../db/client.js";
import { users, userProgress } from "../../db/schema/users.js";
import { matches, submissions } from "../../db/schema/matches.js";
import { problems } from "../../db/schema/problems.js";
import { eq, and, or, desc, sql } from "drizzle-orm";
import { tierForRating } from "@clashofcode/shared";

export const userRoutes: FastifyPluginAsync = async (app) => {
  // Authentication pre-handler
  app.addHook("onRequest", async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      return reply.code(401).send({ error: { code: "UNAUTHORIZED", message: "Authentication required" } });
    }
  });

  app.get("/me", async (request, reply) => {
    const { id } = request.user as { id: string };
    
    const user = await getUserById(id);
    if (!user) {
      return reply.code(404).send({ error: { code: "NOT_FOUND", message: "User not found" } });
    }

    const [progress] = await db.select().from(userProgress).where(eq(userProgress.userId, id));
    
    const ratingInt = Math.round(user.rating);
    const tier = tierForRating(ratingInt);
    
    return {
      name: user.username,
      handle: user.username,
      initials: user.username.substring(0, 2).toUpperCase(),
      rating: ratingInt,
      rank: tier.name,
      level: progress?.level ?? 1,
      xp: progress?.xp ?? 0,
      xpGoal: progress?.xpGoal ?? 1000,
      winRate: user.gamesPlayed > 0 ? Math.round((user.wins / user.gamesPlayed) * 100) : 0,
      wins: user.wins,
      losses: user.losses,
      streak: progress?.streak ?? 0,
      peak: progress?.peakRating ? Math.round(progress.peakRating) : ratingInt,
      battles: user.gamesPlayed,
    };
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
    const body = request.body as { handle?: string; username?: string; name?: string; bio?: string; location?: string };
    
    const targetUsername = body.handle || body.username || body.name;

    if (targetUsername) {
      const trimmed = targetUsername.trim();
      if (trimmed.length < 3) {
        return reply.code(400).send({ error: { code: "BAD_REQUEST", message: "Username must be at least 3 characters" } });
      }
      // Check collision
      const [collidingUser] = await db.select().from(users).where(eq(users.username, trimmed));
      if (collidingUser && collidingUser.id !== id) {
        return reply.code(409).send({ error: { code: "CONFLICT", message: "Username already taken" } });
      }

      await db.update(users).set({ username: trimmed }).where(eq(users.id, id));
    }

    if (body.bio !== undefined || body.location !== undefined) {
      await db.update(users).set({
        bio: body.bio,
        location: body.location
      }).where(eq(users.id, id));
    }

    const updated = await getUserById(id);
    return toPublicUser(updated!);
  });

  app.get("/me/mastery", async (request, reply) => {
    const { id } = request.user as { id: string };
    // Fetch user submission topics and calculate mastery percentages
    const solved = await db
      .select({
        tags: problems.tags,
      })
      .from(submissions)
      .innerJoin(problems, eq(submissions.problemId, problems.id))
      .where(and(eq(submissions.userId, id), eq(submissions.verdict, "accepted")));

    const tagCounts: Record<string, number> = {};
    solved.forEach((s) => {
      s.tags.forEach((tag) => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });

    const mastery = Object.entries(tagCounts).map(([topic, count]) => {
      const percentage = Math.min(count * 20, 100); // 5 solves = 100% mastery
      return {
        topic,
        value: percentage,
        tone: percentage > 60 ? "lime" : percentage > 30 ? "amber" : "stone",
      };
    });

    if (mastery.length === 0) {
      return [
        { topic: "Arrays", value: 0, tone: "stone" },
        { topic: "Graphs", value: 0, tone: "stone" }
      ];
    }

    return mastery;
  });

  app.get("/me/achievements", async (request, reply) => {
    const { id } = request.user as { id: string };
    const user = await getUserById(id);
    if (!user) {
      return reply.code(404).send({ error: { code: "NOT_FOUND", message: "User not found" } });
    }

    const achievements = [];
    if (user.gamesPlayed > 0) {
      achievements.push({ title: "First Blood", text: "Participated in your first battle", state: "earned", mark: "✓" });
    } else {
      achievements.push({ title: "First Blood", text: "Participated in your first battle", state: "locked", mark: "lock" });
    }

    if (user.wins > 0) {
      achievements.push({ title: "Victory Royale", text: "Won a battle", state: "earned", mark: "✓" });
    } else {
      achievements.push({ title: "Victory Royale", text: "Won a battle", state: "locked", mark: "lock" });
    }

    if (user.wins >= 5) {
      achievements.push({ title: "Dominating", text: "Won 5 battles", state: "earned", mark: "✓" });
    } else {
      achievements.push({ title: "Dominating", text: "Won 5 battles", state: "locked", mark: "lock" });
    }

    return achievements;
  });

  app.get("/me/battles", async (request, reply) => {
    const { id } = request.user as { id: string };
    
    // Query recent matches for this user
    const recentMatches = await db
      .select({
        id: matches.id,
        mode: matches.mode,
        status: matches.status,
        winnerId: matches.winnerId,
        startedAt: matches.startedAt,
        problemTitle: problems.title,
        problemDifficulty: problems.difficulty,
        playerOneId: matches.playerOneId,
        playerTwoId: matches.playerTwoId,
      })
      .from(matches)
      .innerJoin(problems, eq(matches.problemId, problems.id))
      .where(or(eq(matches.playerOneId, id), eq(matches.playerTwoId, id)))
      .orderBy(desc(matches.createdAt))
      .limit(10);

    const matchHistory = [];
    for (const m of recentMatches) {
      const opponentId = m.playerOneId === id ? m.playerTwoId : m.playerOneId;
      let opponentUsername = "Opponent";
      if (opponentId) {
        const [opp] = await db.select({ username: users.username }).from(users).where(eq(users.id, opponentId));
        if (opp) opponentUsername = opp.username;
      }

      let result: "WIN" | "LOSS" | "DRAW" = "DRAW";
      if (m.winnerId === id) result = "WIN";
      else if (m.winnerId && m.winnerId !== id) result = "LOSS";

      matchHistory.push({
        opponent: opponentUsername,
        initials: opponentUsername.substring(0, 2).toUpperCase(),
        title: m.problemTitle,
        topic: m.mode,
        result,
        delta: result === "WIN" ? "+15" : result === "LOSS" ? "-15" : "0",
        duration: "5m",
        level: m.problemDifficulty.charAt(0).toUpperCase() + m.problemDifficulty.slice(1),
      });
    }

    return matchHistory;
  });

  app.delete("/me", async (request, reply) => {
    const { id } = request.user as { id: string };
    
    await db.transaction(async (tx) => {
      // Delete user's submissions
      await tx.delete(submissions).where(eq(submissions.userId, id));
      // Delete user's matches
      await tx.delete(matches).where(or(eq(matches.playerOneId, id), eq(matches.playerTwoId, id)));
      // Delete the user
      await tx.delete(users).where(eq(users.id, id));
    });

    return reply.code(200).send({ success: true });
  });

  app.get("/me/export", async (request, reply) => {
    const { id } = request.user as { id: string };
    
    const user = await getUserById(id);
    if (!user) {
      return reply.code(404).send({ error: { code: "NOT_FOUND", message: "User not found" } });
    }

    const [progress] = await db.select().from(userProgress).where(eq(userProgress.userId, id));
    const friends = await getFriends(id);
    const userMatches = await db.select().from(matches).where(or(eq(matches.playerOneId, id), eq(matches.playerTwoId, id)));
    const userSubmissions = await db.select().from(submissions).where(eq(submissions.userId, id));

    return reply.code(200).send({
      profile: {
        username: user.username,
        email: user.email,
        rating: user.rating,
        gamesPlayed: user.gamesPlayed,
        wins: user.wins,
        losses: user.losses,
        draws: user.draws,
        bio: user.bio,
        location: user.location,
        createdAt: user.createdAt,
      },
      progress,
      friends,
      matches: userMatches,
      submissions: userSubmissions
    });
  });
};
