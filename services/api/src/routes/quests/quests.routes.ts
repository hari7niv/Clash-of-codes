import { FastifyPluginAsync } from "fastify";
import { db } from "../../db/client.js";
import { questDefinitions, userQuests, userProgress } from "../../db/schema/users.js";
import { eq, and, sql } from "drizzle-orm";

// Returns YYYY-MM-DD string for today in UTC
const todayDateString = () => new Date().toISOString().substring(0, 10);

// Seeds the default quest definitions if none exist
async function ensureQuestDefinitions() {
  const existing = await db.select().from(questDefinitions);
  if (existing.length > 0) return existing;

  return db
    .insert(questDefinitions)
    .values([
      { title: "Enter the Arena", description: "Play 1 battle", xpReward: 120, targetType: "battle", targetValue: 1 },
      { title: "Problem Solver", description: "Solve 2 problems correctly", xpReward: 180, targetType: "solve", targetValue: 2 },
      { title: "Keep the Fire", description: "Maintain your daily streak", xpReward: 80, targetType: "streak", targetValue: 1 },
      { title: "Code Warrior", description: "Win a ranked match", xpReward: 250, targetType: "win", targetValue: 1 },
      { title: "Rapid Coder", description: "Submit 3 solutions in one day", xpReward: 150, targetType: "solve", targetValue: 3 },
    ])
    .returning();
}

export const questRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("onRequest", async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.send(err);
    }
  });

  // FR-7.3: Get today's quests — rotates daily
  app.get("/today", async (request, reply) => {
    try {
      const { id: userId } = request.user as { id: string };
      const today = todayDateString();
      const definitions = await ensureQuestDefinitions();

      // Pick 3 quests for the day deterministically using userId + date as seed
      const seed = userId.charCodeAt(0) + userId.charCodeAt(1) + new Date(today).getDay();
      const shuffled = [...definitions].sort((a, b) => {
        const hashA = (a.title.charCodeAt(0) + seed) % definitions.length;
        const hashB = (b.title.charCodeAt(0) + seed) % definitions.length;
        return hashA - hashB;
      });
      const todaysDefs = shuffled.slice(0, 3);
      const todaysQuestIds = todaysDefs.map((d) => d.id);

      // Fetch existing user quest rows assigned today
      const existingRows = await db
        .select()
        .from(userQuests)
        .where(
          and(
            eq(userQuests.userId, userId),
            sql`${userQuests.assignedDate} = ${today}::date`
          )
        );

      const assignedQuests = [];
      for (let i = 0; i < todaysDefs.length; i++) {
        const def = todaysDefs[i];
        let userQuest = existingRows.find((uq) => uq.questId === def.id);

        if (!userQuest) {
          const [created] = await db
            .insert(userQuests)
            .values({
              userId,
              questId: def.id,
              progress: 0,
              completed: false,
              rewardClaimed: false,
              assignedDate: today,
            })
            .returning();
          userQuest = created;
        }

        assignedQuests.push({
          id: userQuest!.id,
          questDefId: def.id,
          icon: String(i + 1).padStart(2, "0"),
          title: def.title,
          detail: def.description,
          progress: userQuest!.progress,
          total: def.targetValue,
          reward: `+${def.xpReward} XP`,
          complete: userQuest!.completed,
          rewardClaimed: userQuest!.rewardClaimed,
          xpReward: def.xpReward,
        });
      }

      return assignedQuests;
    } catch (err: any) {
      return reply.code(500).send({ error: { code: "INTERNAL_ERROR", message: err.message } });
    }
  });

  // FR-7.3: Claim XP reward for a completed quest
  app.post("/:userQuestId/claim", async (request, reply) => {
    try {
      const { id: userId } = request.user as { id: string };
      const { userQuestId } = request.params as { userQuestId: string };

      const [userQuest] = await db
        .select()
        .from(userQuests)
        .where(and(eq(userQuests.id, userQuestId), eq(userQuests.userId, userId)));

      if (!userQuest) {
        return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Quest not found" } });
      }
      if (!userQuest.completed) {
        return reply.code(400).send({ error: { code: "BAD_REQUEST", message: "Quest is not yet complete" } });
      }
      if (userQuest.rewardClaimed) {
        return reply.code(400).send({ error: { code: "BAD_REQUEST", message: "Reward already claimed" } });
      }

      // Look up XP reward from definition
      const [def] = await db.select().from(questDefinitions).where(eq(questDefinitions.id, userQuest.questId));
      if (!def) {
        return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Quest definition not found" } });
      }

      // Mark claimed + award XP in a transaction
      await db.transaction(async (tx) => {
        await tx.update(userQuests).set({ rewardClaimed: true }).where(eq(userQuests.id, userQuestId));

        // Upsert progress row and add XP
        const [progress] = await tx.select().from(userProgress).where(eq(userProgress.userId, userId));
        if (progress) {
          const newXp = progress.xp + def.xpReward;
          // Level up if XP exceeds goal (simple: level = floor(totalXp / 1000) + 1)
          const totalXpEver = newXp;
          const newLevel = Math.floor(totalXpEver / 1000) + 1;
          await tx.update(userProgress).set({ xp: newXp, level: newLevel }).where(eq(userProgress.userId, userId));
        }
      });

      return { success: true, xpAwarded: def.xpReward };
    } catch (err: any) {
      return reply.code(500).send({ error: { code: "INTERNAL_ERROR", message: err.message } });
    }
  });
};
