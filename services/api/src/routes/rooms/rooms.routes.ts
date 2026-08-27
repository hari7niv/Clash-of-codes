import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { createRoom, getRoomByCode, joinRoom, leaveRoom } from "../../repositories/room.repo.js";

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

      const guestLink = `http://localhost:3000/room/join?code=${room.code}`;
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
      return reply.code(401).send(err);
    }
  });

  app.patch("/:code/settings", async (request, reply) => {
    try {
      await request.jwtVerify();
      return { success: true };
    } catch (err) {
      return reply.code(401).send(err);
    }
  });

  app.delete("/:code/participants/:participantId", async (request, reply) => {
    try {
      await request.jwtVerify();
      return { success: true };
    } catch (err) {
      return reply.code(401).send(err);
    }
  });

  app.patch("/:code/ready", async (request, reply) => {
    return { success: true };
  });

  app.post("/:code/start", async (request, reply) => {
    try {
      await request.jwtVerify();
      return { matchId: "match_92A8" };
    } catch (err) {
      return reply.code(401).send(err);
    }
  });

  app.post("/:code/leave", async (request, reply) => {
    try {
      await request.jwtVerify();
      const { id: userId } = request.user as { id: string };
      const { code } = request.params as any;

      await leaveRoom(code, userId);
      return { success: true };
    } catch (err) {
      return reply.code(401).send(err);
    }
  });
};
