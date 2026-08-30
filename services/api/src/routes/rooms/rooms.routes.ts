import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { createRoom, getRoomByCode, joinRoom, leaveRoom } from "../../repositories/room.repo.js";
import { db } from "../../db/client.js";
import { rooms, roomMembers, matches } from "../../db/schema/matches.js";
import { problems } from "../../db/schema/problems.js";
import { eq, and } from "drizzle-orm";


const createRoomSchema = z.object({
  roomName: z.string(),
  mode: z.enum(["solo", "arena"]),
  capacity: z.enum(["2", "4", "8", "12"]),
  battleType: z.enum(["blitz", "standard", "deep"]),
  topic: z.string(),
  ruleNote: z.string(),
  rules: z.array(z.string()),
});

export const roomRoutes: FastifyPluginAsync = async (app) => {
  app.post("/", async (request, reply) => {
    try {
      await request.jwtVerify();
      const { id: userId } = request.user as { id: string };
      const body = createRoomSchema.parse(request.body);

      const room = await createRoom({
        hostUserId: userId,
        isPrivate: body.mode === "solo",
        maxPlayers: parseInt(body.capacity),
        timeControl: body.battleType,
      });

      const guestLink = `${process.env.CORS_ORIGIN || "http://localhost:5173"}/join/${room.code}`;
      return reply.code(201).send({ roomCode: room.code, guestLink });
    } catch (err: any) {
      return reply.code(400).send({ error: { code: "BAD_REQUEST", message: err.message } });
    }
  });

  app.get("/:code", async (request, reply) => {
    const { code } = request.params as any;
    const room = await getRoomByCode(code);
    if (!room) {
      return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Room not found" } });
    }
    return room;
  });

  app.post("/:code/join", async (request, reply) => {
    try {
      await request.jwtVerify();
      const { id: userId } = request.user as { id: string };
      const { code } = request.params as any;

      const room = await joinRoom(code, userId);
      if (!room) {
        return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Room not found" } });
      }

      return { participantId: userId };
    } catch (err: any) {
      return reply.code(400).send({ error: { code: "BAD_REQUEST", message: err.message } });
    }
  });

  app.patch("/:code/settings", async (request, reply) => {
    try {
      await request.jwtVerify();
      const { id: userId } = request.user as { id: string };
      const { code } = request.params as any;

      const roomDetails = await getRoomByCode(code);
      if (!roomDetails) {
        return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Room not found" } });
      }

      // Verify current user is host
      const hostParticipant = roomDetails.participants.find(p => p.id === userId && p.role === "Host");
      if (!hostParticipant) {
        return reply.code(403).send({ error: { code: "FORBIDDEN", message: "Only the host can modify settings" } });
      }

      // Update room configurations if present
      const body = request.body as { isPrivate?: boolean; maxPlayers?: number; timeControl?: string };
      await db.update(rooms)
        .set({
          isPrivate: body.isPrivate,
          maxPlayers: body.maxPlayers,
          timeControl: body.timeControl,
        })
        .where(eq(rooms.code, code));

      return { success: true };
    } catch (err: any) {
      return reply.code(400).send({ error: { code: "BAD_REQUEST", message: err.message } });
    }
  });

  app.delete("/:code/participants/:participantId", async (request, reply) => {
    try {
      await request.jwtVerify();
      const { id: userId } = request.user as { id: string };
      const { code, participantId } = request.params as any;

      const roomDetails = await getRoomByCode(code);
      if (!roomDetails) {
        return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Room not found" } });
      }

      // Host checking: only host can kick players, users can leave by calling POST /leave
      const hostParticipant = roomDetails.participants.find(p => p.id === userId && p.role === "Host");
      if (!hostParticipant) {
        return reply.code(403).send({ error: { code: "FORBIDDEN", message: "Only the host can kick players" } });
      }

      await leaveRoom(code, participantId);
      return { success: true };
    } catch (err: any) {
      return reply.code(400).send({ error: { code: "BAD_REQUEST", message: err.message } });
    }
  });

  app.patch("/:code/ready", async (request, reply) => {
    try {
      await request.jwtVerify();
      const { id: userId } = request.user as { id: string };
      const { code } = request.params as any;

      const roomDetails = await getRoomByCode(code);
      if (!roomDetails) {
        return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Room not found" } });
      }
      
      const [roomRecord] = await db.select().from(rooms).where(eq(rooms.code, code));
      if (!roomRecord) {
        return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Room record not found" } });
      }

      const body = request.body as { ready: boolean };
      await db.update(roomMembers)
        .set({ ready: body.ready })
        .where(and(eq(roomMembers.roomId, roomRecord.id), eq(roomMembers.userId, userId)));

      return { success: true };
    } catch (err: any) {
      return reply.code(400).send({ error: { code: "BAD_REQUEST", message: err.message } });
    }
  });

  app.post("/:code/start", async (request, reply) => {
    try {
      await request.jwtVerify();
      const { id: userId } = request.user as { id: string };
      const { code } = request.params as any;

      const [roomRecord] = await db.select().from(rooms).where(eq(rooms.code, code));
      if (!roomRecord) {
        return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Room not found" } });
      }

      if (roomRecord.hostUserId !== userId) {
        return reply.code(403).send({ error: { code: "FORBIDDEN", message: "Only host can start the room match" } });
      }

      // Pick a random problem to match
      const [selectedProblem] = await db.select().from(problems).limit(1);
      if (!selectedProblem) {
        return reply.code(500).send({ error: { code: "INTERNAL_ERROR", message: "No problems seeded in DB" } });
      }

      // Get members
      const members = await db.select().from(roomMembers).where(eq(roomMembers.roomId, roomRecord.id));
      const playerOne = members[0]?.userId || userId;
      const playerTwo = members[1]?.userId || null;

      // Create a match DB record
      const [matchRecord] = await db.insert(matches).values({
        problemId: selectedProblem.id,
        mode: "room",
        status: "active",
        playerOneId: playerOne,
        playerTwoId: playerTwo,
        roomCode: code,
        startedAt: new Date(),
      }).returning();

      // Update room status
      await db.update(rooms).set({ status: "in_progress" }).where(eq(rooms.id, roomRecord.id));

      return { matchId: matchRecord.id };
    } catch (err: any) {
      return reply.code(400).send({ error: { code: "BAD_REQUEST", message: err.message } });
    }
  });

  app.post("/:code/leave", async (request, reply) => {
    try {
      await request.jwtVerify();
      const { id: userId } = request.user as { id: string };
      const { code } = request.params as any;

      await leaveRoom(code, userId);
      return { success: true };
    } catch (err: any) {
      return reply.code(400).send({ error: { code: "BAD_REQUEST", message: err.message } });
    }
  });
};
