import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getFriends, getUserByUsername, lookupUser } from "../../repositories/user.repo.js";
import { createRoom } from "../../repositories/room.repo.js";
import { db } from "../../db/client.js";
import { friendships } from "../../db/schema/users.js";
import { matches } from "../../db/schema/matches.js";
import { eq, and, or, sql } from "drizzle-orm";

const friendRequestSchema = z.object({
  handle: z.string(),
});

export const socialRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("onRequest", async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.send(err);
    }
  });

  app.get("/", async (request, reply) => {
    const userId = request.user.sub;
    const friends = await getFriends(userId);
    return friends;
  });

  app.post("/friends/requests", async (request, reply) => {
    const userId = request.user.sub;
    const body = friendRequestSchema.parse(request.body);
    
    // Find the target user by handle
    const targetUser = await getUserByUsername(body.handle);
    if (!targetUser) {
      return reply.code(404).send({ error: "User not found" });
    }
    
    if (targetUser.id === userId) {
      return reply.code(400).send({ error: "Cannot send friend request to yourself" });
    }
    
    // Check if friendship already exists
    const [existing] = await db
      .select()
      .from(friendships)
      .where(
        or(
          and(eq(friendships.userId, userId), eq(friendships.friendId, targetUser.id)),
          and(eq(friendships.userId, targetUser.id), eq(friendships.friendId, userId))
        )
      );
    
    if (existing) {
      if (existing.status === "accepted") {
        return reply.code(400).send({ error: "Already friends" });
      }
      return reply.code(400).send({ error: "Friend request already sent" });
    }
    
    // Create the friend request
    await db.insert(friendships).values({
      userId,
      friendId: targetUser.id,
      status: "pending",
    });
    
    return { success: true, message: `Friend request sent to ${body.handle}` };
  });

  app.post("/friends/:handle/challenge", async (request, reply) => {
    const { handle } = request.params as any;
    const userId = request.user.sub;
    
    // Find the target user by handle
    const targetUser = await getUserByUsername(handle);
    if (!targetUser) {
      return reply.code(404).send({ error: "User not found" });
    }
    
    // Create a private room for the challenge
    const room = await createRoom({
      hostUserId: userId,
      isPrivate: true,
      maxPlayers: 2,
      timeControl: "blitz",
    });
    
    // TODO: Send a notification/invite to the target user via socket or notification system
    // For now, we return the room code which can be shared
    
    return { 
      roomCode: room.code,
      message: `Challenge room created. Share code ${room.code} with ${handle}`,
    };
  });

  app.get("/friends/:handle/rivalry", async (request, reply) => {
    const { handle } = request.params as any;
    const userId = request.user.sub;
    
    // Find the target user by handle
    const targetUser = await getUserByUsername(handle);
    if (!targetUser) {
      return reply.code(404).send({ error: "User not found" });
    }
    
    // Query matches where both users participated
    const userMatches = await db
      .select()
      .from(matches)
      .where(
        and(
          or(
            and(eq(matches.playerOneId, userId), eq(matches.playerTwoId, targetUser.id)),
            and(eq(matches.playerOneId, targetUser.id), eq(matches.playerTwoId, userId))
          ),
          eq(matches.status, "completed")
        )
      );
    
    const totalMatches = userMatches.length;
    const wins = userMatches.filter(m => m.winnerId === userId).length;
    const losses = userMatches.filter(m => m.winnerId === targetUser.id).length;
    const draws = totalMatches - wins - losses;
    
    return { 
      handle, 
      wins, 
      losses, 
      draws,
      matches: totalMatches 
    };
  });

  app.post("/friends/:handle/rematch-invite", async (request, reply) => {
    const { handle } = request.params as any;
    const userId = request.user.sub;
    
    // Find the target user by handle
    const targetUser = await getUserByUsername(handle);
    if (!targetUser) {
      return reply.code(404).send({ error: "User not found" });
    }
    
    // Create a private room for the rematch
    const room = await createRoom({
      hostUserId: userId,
      isPrivate: true,
      maxPlayers: 2,
      timeControl: "blitz",
    });
    
    // TODO: Send a notification/invite to the target user
    // This would typically involve:
    // 1. Creating a notification record in the database
    // 2. Emitting a socket event to the target user if they're online
    
    return { 
      success: true, 
      roomCode: room.code,
      message: `Rematch invite created for ${handle}`,
    };
  });
};
