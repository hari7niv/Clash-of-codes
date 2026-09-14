import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { db } from "../../db/client.js";
import { problems, testCases } from "../../db/schema/problems.js";
import { eq } from "drizzle-orm";
import { getUserById } from "../../repositories/user.repo.js";

// Schemas for creating and updating problems
const testCaseSchema = z.object({
  input: z.string(),
  expectedOutput: z.string(),
  isSample: z.boolean(),
  ordinal: z.number(),
});

const createProblemSchema = z.object({
  slug: z.string().min(3),
  title: z.string().min(3),
  statement: z.string().min(10),
  difficulty: z.enum(["easy", "medium", "hard"]),
  rating: z.number().int().default(1200),
  timeLimitMs: z.number().int().default(2000),
  memoryLimitKb: z.number().int().default(262144),
  tags: z.array(z.string()).default([]),
  isDraft: z.boolean().default(true),
  testCases: z.array(testCaseSchema).min(1),
});

const updateProblemSchema = createProblemSchema.partial();

export const adminRoutes: FastifyPluginAsync = async (app) => {
  // Authentication & Authorization hook for Admin
  app.addHook("onRequest", async (request, reply) => {
    try {
      await request.jwtVerify();
      const { id } = request.user as { id: string };
      const user = await getUserById(id);
      
      if (!user || user.role !== "admin") {
        return reply.code(403).send({ error: { code: "FORBIDDEN", message: "Admin access required" } });
      }
    } catch (err) {
      return reply.code(401).send({ error: { code: "UNAUTHORIZED", message: "Authentication required" } });
    }
  });

  // Create a new problem
  app.post("/problems", async (request, reply) => {
    try {
      const data = createProblemSchema.parse(request.body);
      
      let problemId: string;
      await db.transaction(async (tx) => {
        const [problem] = await tx.insert(problems).values({
          slug: data.slug,
          title: data.title,
          statement: data.statement,
          difficulty: data.difficulty,
          rating: data.rating,
          timeLimitMs: data.timeLimitMs,
          memoryLimitKb: data.memoryLimitKb,
          tags: data.tags,
          isDraft: data.isDraft,
        }).returning();
        
        problemId = problem.id;

        const tcs = data.testCases.map((tc) => ({
          problemId,
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          isSample: tc.isSample,
          ordinal: tc.ordinal,
        }));
        
        await tx.insert(testCases).values(tcs);
      });

      return reply.code(201).send({ success: true, problemId: problemId! });
    } catch (err: any) {
      return reply.code(400).send({ error: { code: "BAD_REQUEST", message: err.message } });
    }
  });

  // Update an existing problem
  app.put("/problems/:id", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const data = updateProblemSchema.parse(request.body);
      
      await db.transaction(async (tx) => {
        const updateData: any = {};
        if (data.slug !== undefined) updateData.slug = data.slug;
        if (data.title !== undefined) updateData.title = data.title;
        if (data.statement !== undefined) updateData.statement = data.statement;
        if (data.difficulty !== undefined) updateData.difficulty = data.difficulty;
        if (data.rating !== undefined) updateData.rating = data.rating;
        if (data.timeLimitMs !== undefined) updateData.timeLimitMs = data.timeLimitMs;
        if (data.memoryLimitKb !== undefined) updateData.memoryLimitKb = data.memoryLimitKb;
        if (data.tags !== undefined) updateData.tags = data.tags;
        if (data.isDraft !== undefined) updateData.isDraft = data.isDraft;

        if (Object.keys(updateData).length > 0) {
          await tx.update(problems).set(updateData).where(eq(problems.id, id));
        }

        // If testCases are provided, replace them all for simplicity
        if (data.testCases !== undefined && data.testCases.length > 0) {
          await tx.delete(testCases).where(eq(testCases.problemId, id));
          
          const tcs = data.testCases.map((tc) => ({
            problemId: id,
            input: tc.input,
            expectedOutput: tc.expectedOutput,
            isSample: tc.isSample,
            ordinal: tc.ordinal,
          }));
          
          await tx.insert(testCases).values(tcs);
        }
      });

      return reply.code(200).send({ success: true });
    } catch (err: any) {
      return reply.code(400).send({ error: { code: "BAD_REQUEST", message: err.message } });
    }
  });
};
