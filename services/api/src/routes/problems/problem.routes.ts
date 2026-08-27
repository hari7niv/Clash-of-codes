import { FastifyPluginAsync } from "fastify";
import { getProblems, getProblemById, getDailyProblem } from "../../repositories/problem.repo.js";

export const problemRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async (request, reply) => {
    const query = request.query as any;
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 20;

    const data = await getProblems({
      topic: query.topic,
      difficulty: query.difficulty,
      page,
      limit
    });

    return data;
  });

  app.get("/daily", async (request, reply) => {
    const problem = await getDailyProblem();
    if (!problem) {
      return reply.code(404).send({ error: { code: "NOT_FOUND", message: "No daily challenge found" } });
    }
    return problem;
  });

  app.get("/:id", async (request, reply) => {
    const { id } = request.params as any;
    const problem = await getProblemById(id);
    if (!problem) {
      return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Problem not found" } });
    }
    return problem;
  });
};
