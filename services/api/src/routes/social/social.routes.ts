import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getFriends, getUserByUsername, lookupUser } from "../../repositories/user.repo.js";
import { createRoom } from "../../repositories/room.repo.js";
import { db } from "../../db/client.js";
import { friendships, users } from "../../db/schema/users.js";
import { matches } from "../../db/schema/matches.js";
import { eq, and, or, sql, like, ilike } from "drizzle-orm";

const friendRequestSchema = z.object({
  handle: z.string(),
});

const friendSearchSchema = z.object({
  query: z.string().min(1),
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
    const { id: userId } = request.user as { id: string };
    const friends = await getFriends(userId);
    return friends;
  });

  // Search for users by username
  app.post("/search", async (request, reply) => {
    const { id: userId } = request.user as { id: string };
    const body = friendSearchSchema.parse(request.body);
    
    // Search users by username (case-insensitive partial match)
    const searchResults = await db
      .select({
        id: users.id,
        username: users.username,
        rating: users.rating,
      })
      .from(users)
      .where(
        and(
          ilike(users.username, `%${body.query}%`),
          sql`${users.id} != ${userId}::uuid` // Exclude current user
        )
      )
      .limit(10);
    
    if (searchResults.length === 0) {
      return [];
    }
    
    // Check existing friendships for all found users
    const userIds = searchResults.map(u => u.id);
    const existingFriendships = await db
      .select()
      .from(friendships)
      .where(
        or(
          and(
            eq(friendships.userId, userId),
            sql`${friendships.friendId} = ANY(${userIds}::uuid[])`
          ),
          and(
            eq(friendships.friendId, userId),
            sql`${friendships.userId} = ANY(${userIds}::uuid[])`
          )
        )
      );
    
    // Create a map of user ID to friendship status
    const friendshipMap = new Map<string, string>();
    existingFriendships.forEach(f => {
      const otherUserId = f.userId === userId ? f.friendId : f.userId;
      friendshipMap.set(otherUserId, f.status);
    });
    
    // Filter out users who are already friends or have pending requests
    const availableUsers = searchResults.filter(u => !friendshipMap.has(u.id));
    
    // Map to public user format
    return availableUsers.map(u => {
      const ratingInt = Math.round(u.rating);
      return {
        id: u.id,
        username: u.username,
        handle: u.username,
        rating: ratingInt,
        rank: ratingInt >= 2400 ? "Grandmaster" : 
              ratingInt >= 2100 ? "Master" :
              ratingInt >= 1800 ? "Diamond" :
              ratingInt >= 1500 ? "Platinum" :
              ratingInt >= 1200 ? "Gold" :
              ratingInt >= 900 ? "Silver" : "Bronze",
      };
    });
  });

  // Get pending friend requests (where current user is recipient)
  app.get("/requests", async (request, reply) => {
    const { id: userId } = request.user as { id: string };
    
    // Get pending requests where current user is the recipient
    const pendingRequests = await db
      .select({
        userId: friendships.userId,
        friendId: friendships.friendId,
        status: friendships.status,
        createdAt: friendships.createdAt,
        requesterUsername: users.username,
        requesterRating: users.rating,
      })
      .from(friendships)
      .innerJoin(users, eq(users.id, friendships.userId))
      .where(
        and(
          eq(friendships.friendId, userId),
          eq(friendships.status, "pending")
        )
      );
    
    return pendingRequests.map(req => {
      const ratingInt = Math.round(req.requesterRating);
      return {
        requestId: `${req.userId}-${req.friendId}`, // Composite key for identification
        requesterId: req.userId,
        requesterUsername: req.requesterUsername,
        requesterHandle: req.requesterUsername,
        requesterRating: ratingInt,
        requesterRank: ratingInt >= 2400 ? "Grandmaster" : 
                      ratingInt >= 2100 ? "Master" :
                      ratingInt >= 1800 ? "Diamond" :
                      ratingInt >= 1500 ? "Platinum" :
                      ratingInt >= 1200 ? "Gold" :
                      ratingInt >= 900 ? "Silver" : "Bronze",
        createdAt: req.createdAt,
      };
    });
  });

  app.post("/requests", async (request, reply) => {
    const { id: userId } = request.user as { id: string };
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

  // Accept friend request
  app.post("/requests/:requesterId/accept", async (request, reply) => {
    const { id: userId } = request.user as { id: string };
    const { requesterId } = request.params as { requesterId: string };
    
    // Verify the requester exists
    const requester = await lookupUser(requesterId);
    if (!requester) {
      return reply.code(404).send({ error: "User not found" });
    }
    
    // Find the pending friend request where current user is the recipient
    const [existingRequest] = await db
      .select()
      .from(friendships)
      .where(
        and(
          eq(friendships.userId, requesterId),
          eq(friendships.friendId, userId),
          eq(friendships.status, "pending")
        )
      );
    
    if (!existingRequest) {
      return reply.code(404).send({ error: "Friend request not found" });
    }
    
    // Update the friendship status to accepted
    await db
      .update(friendships)
      .set({ status: "accepted" })
      .where(
        and(
          eq(friendships.userId, requesterId),
          eq(friendships.friendId, userId)
        )
      );
    
    return { 
      success: true, 
      message: `You are now friends with ${requester.username}` 
    };
  });

  // Decline/reject friend request
  app.delete("/requests/:requesterId", async (request, reply) => {
    const { id: userId } = request.user as { id: string };
    const { requesterId } = request.params as { requesterId: string };
    
    // Delete the pending friend request
    await db
      .delete(friendships)
      .where(
        and(
          eq(friendships.userId, requesterId),
          eq(friendships.friendId, userId),
          eq(friendships.status, "pending")
        )
      );
    
    return { success: true, message: "Friend request declined" };
  });

  app.post("/:handle/challenge", async (request, reply) => {
    const { handle } = request.params as any;
    const { id: userId } = request.user as { id: string };
    
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

  app.get("/:handle/rivalry", async (request, reply) => {
    const { handle } = request.params as any;
    const { id: userId } = request.user as { id: string };
    
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

  app.post("/:handle/rematch-invite", async (request, reply) => {
    const { handle } = request.params as any;
    const { id: userId } = request.user as { id: string };
    
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
