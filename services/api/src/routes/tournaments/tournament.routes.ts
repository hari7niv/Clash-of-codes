import { FastifyPluginAsync } from "fastify";
import { db } from "../../db/client.js";
import { tournaments, tournamentParticipants, tournamentMatches } from "../../db/schema/tournaments.js";
import { users } from "../../db/schema/users.js";
import { eq, and, desc, count } from "drizzle-orm";
import { getUserById } from "../../repositories/user.repo.js";

export const tournamentRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("onRequest", async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.code(401).send({ error: { code: "UNAUTHORIZED", message: "Authentication required" } });
    }
  });

  // FR-10.1: List all tournaments
  app.get("/", async (request, reply) => {
    const query = request.query as { status?: string; limit?: string };
    const limit = Math.min(parseInt(query.limit || "20", 10), 50);

    let q = db.select().from(tournaments);
    if (query.status) {
      q = q.where(eq(tournaments.status, query.status)) as any;
    }

    const items = await (q as any).orderBy(desc(tournaments.startTime)).limit(limit);

    // Enrich with participant count
    const enriched = await Promise.all(
      items.map(async (t: any) => {
        const [{ value: participantCount }] = await db
          .select({ value: count() })
          .from(tournamentParticipants)
          .where(eq(tournamentParticipants.tournamentId, t.id));
        return { ...t, participantCount };
      })
    );

    return enriched;
  });

  // FR-10.1: Get a single tournament with bracket
  app.get("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, id));
    if (!tournament) {
      return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Tournament not found" } });
    }

    const participants = await db
      .select({ id: users.id, username: users.username, rating: users.rating })
      .from(tournamentParticipants)
      .innerJoin(users, eq(users.id, tournamentParticipants.userId))
      .where(eq(tournamentParticipants.tournamentId, id));

    const bracket = await db
      .select()
      .from(tournamentMatches)
      .where(eq(tournamentMatches.tournamentId, id))
      .orderBy(tournamentMatches.round, tournamentMatches.matchNumber);

    return { tournament, participants, bracket };
  });

  // FR-10.2: Register for a tournament
  app.post("/:id/register", async (request, reply) => {
    const { id: userId } = request.user as { id: string };
    const { id } = request.params as { id: string };

    const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, id));
    if (!tournament) {
      return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Tournament not found" } });
    }
    if (!["upcoming", "registration"].includes(tournament.status)) {
      return reply.code(400).send({ error: { code: "BAD_REQUEST", message: "Registration is not open" } });
    }

    const [{ value: currentCount }] = await db
      .select({ value: count() })
      .from(tournamentParticipants)
      .where(eq(tournamentParticipants.tournamentId, id));

    if (currentCount >= tournament.maxParticipants) {
      return reply.code(409).send({ error: { code: "FULL", message: "Tournament is full" } });
    }

    const [existing] = await db
      .select()
      .from(tournamentParticipants)
      .where(and(eq(tournamentParticipants.tournamentId, id), eq(tournamentParticipants.userId, userId)));

    if (existing) {
      return reply.code(409).send({ error: { code: "CONFLICT", message: "Already registered" } });
    }

    await db.insert(tournamentParticipants).values({ tournamentId: id, userId });
    return { success: true };
  });

  // FR-10.2: Withdraw from a tournament
  app.delete("/:id/register", async (request, reply) => {
    const { id: userId } = request.user as { id: string };
    const { id } = request.params as { id: string };

    const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, id));
    if (!tournament || !["upcoming", "registration"].includes(tournament.status)) {
      return reply.code(400).send({ error: { code: "BAD_REQUEST", message: "Cannot withdraw from this tournament" } });
    }

    await db
      .delete(tournamentParticipants)
      .where(and(eq(tournamentParticipants.tournamentId, id), eq(tournamentParticipants.userId, userId)));

    return { success: true };
  });

  // FR-10.3: Admin — create a tournament
  app.post("/", async (request, reply) => {
    const { id: userId } = request.user as { id: string };
    const user = await getUserById(userId);
    if (!user || user.role !== "admin") {
      return reply.code(403).send({ error: { code: "FORBIDDEN", message: "Admin access required" } });
    }

    const body = request.body as {
      name: string; description?: string; format?: string;
      maxParticipants?: number; startTime?: string; prizeDescription?: string;
    };

    if (!body.name?.trim()) {
      return reply.code(400).send({ error: { code: "BAD_REQUEST", message: "name is required" } });
    }

    const [tournament] = await db.insert(tournaments).values({
      name: body.name.trim(),
      description: body.description,
      format: body.format || "single_elimination",
      maxParticipants: body.maxParticipants || 16,
      startTime: body.startTime ? new Date(body.startTime) : undefined,
      prizeDescription: body.prizeDescription,
      createdBy: userId,
      status: "upcoming",
    }).returning();

    return reply.code(201).send(tournament);
  });

  // FR-10.4: Admin — update tournament status
  app.patch("/:id", async (request, reply) => {
    const { id: userId } = request.user as { id: string };
    const user = await getUserById(userId);
    if (!user || user.role !== "admin") {
      return reply.code(403).send({ error: { code: "FORBIDDEN", message: "Admin access required" } });
    }

    const { id } = request.params as { id: string };
    const body = request.body as { status?: string; startTime?: string; name?: string };

    const updateData: any = { updatedAt: new Date() };
    if (body.status) updateData.status = body.status;
    if (body.startTime) updateData.startTime = new Date(body.startTime);
    if (body.name) updateData.name = body.name;

    await db.update(tournaments).set(updateData).where(eq(tournaments.id, id));
    return { success: true };
  });
};
