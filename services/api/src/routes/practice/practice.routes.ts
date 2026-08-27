import { FastifyPluginAsync } from "fastify";

export const practiceRoutes: FastifyPluginAsync = async (app) => {
  // Pre-handler hook to require auth
  app.addHook("onRequest", async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.send(err);
    }
  });

  app.get("/drills", async (request, reply) => {
    return [
      { label: "Arrays", title: "Two Sum", type: "Suggested", duration: "10m", status: "Recommended", tone: "lime" },
      { label: "Graphs", title: "Course Schedule", type: "Graphs", duration: "25m", status: "Open", tone: "red" }
    ];
  });

  app.get("/recommendations", async (request, reply) => {
    return [
      { title: "Graph Signal", subtitle: "Shortest Path / Medium", meta: "Est. 18 min", tag: "Weakness training", accent: "red" },
      { title: "Pattern Shift", subtitle: "Sliding Window / Medium", meta: "Est. 12 min", tag: "Battle prep", accent: "blue" },
      { title: "Daily Drill", subtitle: "Linked List / Easy", meta: "Est. 8 min", tag: "Warm up", accent: "lime" }
    ];
  });

  app.get("/training-signal", async (request, reply) => {
    return {
      topic: "Graphs",
      value: 31,
      tone: "red",
      message: "Graph traversal is currently pulling down your overall rating. Try a targeted Graph drill."
    };
  });

  app.get("/streak", async (request, reply) => {
    return {
      days: 6,
      last7: [true, true, true, false, true, true, true]
    };
  });
};
