import { db } from "../db/client.js";
import { rooms, roomMembers } from "../db/schema/matches.js";
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
  const roomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
  
  const [newRoom] = await db.insert(rooms).values({
    code: roomCode,
    hostUserId: data.hostUserId,
    isPrivate: data.isPrivate ?? true,
    maxPlayers: data.maxPlayers ?? 2,
    timeControl: data.timeControl ?? "standard",
    status: "open",
  }).returning();

  // Host joins the room as a member
  await db.insert(roomMembers).values({
    roomId: newRoom.id,
    userId: data.hostUserId,
  });

  return newRoom;
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

  return {
    code: room.code,
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
  const [room] = await db.select().from(rooms).where(eq(rooms.code, code));
  if (!room) return null;

  // Check if already a member
  const [existing] = await db
    .select()
    .from(roomMembers)
    .where(and(eq(roomMembers.roomId, room.id), eq(roomMembers.userId, userId)));

  if (!existing) {
    await db.insert(roomMembers).values({
      roomId: room.id,
      userId,
    });
  }

  return room;
};

export const leaveRoom = async (code: string, userId: string) => {
  const [room] = await db.select().from(rooms).where(eq(rooms.code, code));
  if (!room) return false;

  await db
    .delete(roomMembers)
    .where(and(eq(roomMembers.roomId, room.id), eq(roomMembers.userId, userId)));

  return true;
};
