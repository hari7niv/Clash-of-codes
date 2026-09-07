import { db } from "../db/client.js";
import { rooms, roomMembers, matches } from "../db/schema/matches.js";
import { users } from "../db/schema/users.js";
import { eq, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { tierForRating } from "@clashofcode/shared";

export const createRoom = async (data: {
  hostUserId: string;
  isPrivate?: boolean;
  maxPlayers?: number;
  timeControl?: string;
}) => {
  // Validate time control values before DB transaction
  const validTimeControls = ["blitz", "standard", "deep"];
  if (data.timeControl && !validTimeControls.includes(data.timeControl)) {
    throw new Error(
      `Invalid time control: ${data.timeControl}. Must be one of: ${validTimeControls.join(", ")}`
    );
  }

  return await db.transaction(async (tx) => {
    let roomCode = "";
    let attempts = 0;
    
    // Generate unique 6-character alphanumeric code
    while (attempts < 10) {
      const candidate = Math.random().toString(36).substring(2, 8).toUpperCase();
      const [existing] = await tx.select().from(rooms).where(eq(rooms.code, candidate));
      if (!existing) {
        roomCode = candidate;
        break;
      }
      attempts++;
    }
    
    if (!roomCode) {
      throw new Error("Failed to generate a unique room code. Please try again.");
    }
    
    try {
      const [newRoom] = await tx.insert(rooms).values({
        code: roomCode,
        hostUserId: data.hostUserId,
        isPrivate: data.isPrivate ?? true,
        maxPlayers: data.maxPlayers ?? 2,
        timeControl: data.timeControl ?? "standard",
        status: "open",
      }).returning();

      // Host joins the room as a member
      await tx.insert(roomMembers).values({
        roomId: newRoom.id,
        userId: data.hostUserId,
        ready: true,
        joinedAt: new Date(),
      });

      return newRoom;
    } catch (err: any) {
      // Check if it's a constraint violation
      if (err.code === "23514") { // PostgreSQL check constraint violation
        throw new Error(
          `Invalid room configuration: ${err.message}. Valid time controls are: ${validTimeControls.join(", ")}`
        );
      }
      throw err;
    }
  });
};

export const getRoomByCode = async (code: string) => {
  const [room] = await db.select().from(rooms).where(eq(rooms.code, code));
  if (!room) return null;

  // Get members
  const members = await db
    .select({
      id: users.id,
      username: users.username,
      rating: users.rating,
    })
    .from(roomMembers)
    .innerJoin(users, eq(roomMembers.userId, users.id))
    .where(eq(roomMembers.roomId, room.id));

  let matchId = undefined;
  if (room.status === "in_progress") {
    const [latestMatch] = await db
      .select({ id: matches.id })
      .from(matches)
      .where(eq(matches.roomCode, code))
      .orderBy(matches.createdAt);
    
    if (latestMatch) {
      matchId = latestMatch.id;
    }
  }

  return {
    code: room.code,
    status: room.status,
    matchId,
    mode: room.isPrivate ? "solo" as const : "arena" as const,
    capacity: room.maxPlayers,
    battleType: room.timeControl,
    topic: "Random", // Default topic
    allowGuests: true,
    approval: false,
    hiddenProgress: false,
    participants: members.map(m => {
      const ratingInt = Math.round(m.rating);
      const tier = tierForRating(ratingInt);
      return {
        id: m.id,
        handle: m.username,
        initials: m.username.substring(0, 2).toUpperCase(),
        tone: "blue",
        role: m.id === room.hostUserId ? "Host" as const : "Player" as const,
        rating: ratingInt
      };
    })
  };
};

export const joinRoom = async (code: string, userId: string) => {
  return await db.transaction(async (tx) => {
    const [room] = await tx.select().from(rooms).where(eq(rooms.code, code));
    if (!room) return null;

    if (room.status !== "open") {
      throw new Error("This room is no longer open for joining.");
    }

    // Check if already a member
    const [existing] = await tx
      .select()
      .from(roomMembers)
      .where(and(eq(roomMembers.roomId, room.id), eq(roomMembers.userId, userId)));

    if (!existing) {
      // Get current member count
      const members = await tx
        .select()
        .from(roomMembers)
        .where(eq(roomMembers.roomId, room.id));

      if (members.length >= room.maxPlayers) {
        throw new Error("This room has reached its maximum capacity.");
      }

      await tx.insert(roomMembers).values({
        roomId: room.id,
        userId,
        ready: false,
        joinedAt: new Date(),
      });
    }

    return room;
  });
};

export const leaveRoom = async (code: string, userId: string) => {
  const [room] = await db.select().from(rooms).where(eq(rooms.code, code));
  if (!room) return false;

  await db
    .delete(roomMembers)
    .where(and(eq(roomMembers.roomId, room.id), eq(roomMembers.userId, userId)));

  return true;
};
