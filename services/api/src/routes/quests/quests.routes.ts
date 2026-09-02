import { FastifyPluginAsync } from "fastify";
import { db } from "../../db/client.js";
import { questDefinitions, userQuests } from "../../db/schema/users.js";
import { eq, and, sql } from "drizzle-orm";

export const questRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("onRequest", async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.send(err);
    }
  });

  app.get("/today", async (request, reply) => {
    try {
      const { id: userId } = request.user as { id: string };

      // Check if definitions exist in DB, if not seed initial definitions
      let definitions = await db.select().from(questDefinitions);
      if (definitions.length === 0) {
        definitions = await db
          .insert(questDefinitions)
          .values([
            {
              title: "Enter the Arena",
              description: "Play 1 battle",
              xpReward: 120,
              targetType: "battle",
              targetValue: 1,
            },
            {
              title: "Problem Solver",
              description: "Solve 2 problems",
              xpReward: 180,
              targetType: "solve",
              targetValue: 2,
            },
            {
              title: "Keep the Fire",
              description: "Maintain your daily streak",
              xpReward: 80,
              targetType: "streak",
              targetValue: 1,
            },
          ])
          .returning();
      }

      // Fetch user's assigned quests
      const userQuestRows = await db
        .select()
        .from(userQuests)
        .where(eq(userQuests.userId, userId));

      // Ensure each definition has an assigned record for the user
      const assignedQuests = [];
      for (let i = 0; i < definitions.length; i++) {
        const def = definitions[i];
        let userQuest = userQuestRows.find((uq) => uq.questId === def.id);

        if (!userQuest) {
          const [created] = await db
            .insert(userQuests)
            .values({
              userId,
              questId: def.id,
              progress: 0,
              completed: false,
              rewardClaimed: false,
            })
            .returning();
          userQuest = created;
        }

        assignedQuests.push({
          id: def.id,
          icon: String(i + 1).padStart(2, "0"),
          title: def.title,
          detail: def.description,
          progress: userQuest?.progress ?? 0,
          total: def.targetValue,
          reward: `+${def.xpReward} XP`,
          complete: userQuest?.completed ?? false,
        });
      }

      return assignedQuests;
    } catch (err: any) {
      return reply.code(500).send({ error: { code: "INTERNAL_ERROR", message: err.message } });
    }
  });
};
