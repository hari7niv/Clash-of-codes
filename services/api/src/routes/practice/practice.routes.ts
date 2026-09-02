import { FastifyPluginAsync } from "fastify";
import { db } from "../../db/client.js";
import { problems } from "../../db/schema/problems.js";
import { userProgress } from "../../db/schema/users.js";
import { eq, desc } from "drizzle-orm";

export const practiceRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("onRequest", async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.send(err);
    }
  });

  app.get("/drills", async (request, reply) => {
    try {
      const allProblems = await db
        .select()
        .from(problems)
        .limit(6);

      const toneMap: Record<string, string> = {
        easy: "lime",
        medium: "amber",
        hard: "red",
      };

      if (allProblems.length > 0) {
        return allProblems.map((p, idx) => ({
          id: p.id,
          label: p.tags[0] || "General",
          title: p.title,
          type: idx % 2 === 0 ? "Suggested" : "Practice",
          duration: `${Math.ceil(p.timeLimitMs / 1000) * 5}m`,
          status: p.difficulty === "easy" ? "Recommended" : "Open",
          tone: toneMap[p.difficulty] || "lime",
        }));
      }

      return [
        { label: "Arrays", title: "Two Sum", type: "Suggested", duration: "10m", status: "Recommended", tone: "lime" },
        { label: "Graphs", title: "Course Schedule", type: "Graphs", duration: "25m", status: "Open", tone: "red" },
      ];
    } catch (err: any) {
      return reply.code(500).send({ error: { code: "INTERNAL_ERROR", message: err.message } });
    }
  });

  app.get("/recommendations", async (request, reply) => {
    try {
      const recProblems = await db
        .select()
        .from(problems)
        .limit(3);

      const accentMap = ["red", "blue", "lime"];

      if (recProblems.length > 0) {
        return recProblems.map((p, idx) => ({
          id: p.id,
          title: p.title,
          subtitle: `${p.tags[0] || "Algorithms"} / ${p.difficulty.charAt(0).toUpperCase() + p.difficulty.slice(1)}`,
          meta: `Est. ${Math.max(5, Math.round(p.rating / 100))} min`,
          tag: idx === 0 ? "Weakness training" : (idx === 1 ? "Battle prep" : "Warm up"),
          accent: accentMap[idx % accentMap.length],
        }));
      }

      return [
        { title: "Graph Signal", subtitle: "Shortest Path / Medium", meta: "Est. 18 min", tag: "Weakness training", accent: "red" },
        { title: "Pattern Shift", subtitle: "Sliding Window / Medium", meta: "Est. 12 min", tag: "Battle prep", accent: "blue" },
        { title: "Daily Drill", subtitle: "Linked List / Easy", meta: "Est. 8 min", tag: "Warm up", accent: "lime" },
      ];
    } catch (err: any) {
      return reply.code(500).send({ error: { code: "INTERNAL_ERROR", message: err.message } });
    }
  });

  app.get("/training-signal", async (request, reply) => {
    try {
      const topHardProblem = await db
        .select()
        .from(problems)
        .where(eq(problems.difficulty, "hard"))
        .limit(1);

      const topic = topHardProblem[0]?.tags[0] || "Graphs";

      return {
        topic,
        value: 31,
        tone: "red",
        message: `${topic} traversal is currently pulling down your overall rating. Try a targeted ${topic} drill.`,
      };
    } catch (err: any) {
      return reply.code(500).send({ error: { code: "INTERNAL_ERROR", message: err.message } });
    }
  });

  app.get("/streak", async (request, reply) => {
    try {
      const { id: userId } = request.user as { id: string };

      const [progress] = await db
        .select()
        .from(userProgress)
        .where(eq(userProgress.userId, userId));

      const days = progress ? progress.streak : 1;

      return {
        days,
        last7: [true, true, true, false, true, true, true],
      };
    } catch (err: any) {
      return reply.code(500).send({ error: { code: "INTERNAL_ERROR", message: err.message } });
    }
  });
};
