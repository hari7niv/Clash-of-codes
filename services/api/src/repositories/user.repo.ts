import { db } from "../db/client.js";
import { users, friendships } from "../db/schema/users.js";
import { eq, desc } from "drizzle-orm";
import { tierForRating } from "@clashofcode/shared";

// Helper to map DB user properties to safe public/player frontend objects
export const toPublicUser = (user: typeof users.$inferSelect) => {
  const ratingInt = Math.round(user.rating);
  const tier = tierForRating(ratingInt);
  
  return {
    id: user.id,
    name: user.username,
    handle: user.username,
    initials: user.username.substring(0, 2).toUpperCase(),
    rating: ratingInt,
    rank: tier.name as any,
  };
};

export const toPlayerProfile = (user: typeof users.$inferSelect) => {
  const ratingInt = Math.round(user.rating);
  const tier = tierForRating(ratingInt);
  
  return {
    name: user.username,
    handle: user.username,
    initials: user.username.substring(0, 2).toUpperCase(),
    rating: ratingInt,
    rank: tier.name as any,
    level: 1, // Scalable default
    xp: 0,
    xpGoal: 1000,
    winRate: user.gamesPlayed > 0 ? Math.round((user.wins / user.gamesPlayed) * 100) : 0,
    wins: user.wins,
    losses: user.losses,
    streak: 0, // In-memory/match-based metric
    peak: ratingInt,
    battles: user.gamesPlayed,
  };
};

export const createUser = async (data: { username: string; email: string; passwordHash: string }) => {
  const [newUser] = await db.insert(users).values({
    username: data.username,
    email: data.email,
    passwordHash: data.passwordHash,
  }).returning();

  return newUser;
};

export const getUserByEmail = async (email: string) => {
  const [user] = await db.select().from(users).where(eq(users.email, email));
  return user || null;
};

export const getUserById = async (id: string) => {
  const [user] = await db.select().from(users).where(eq(users.id, id));
  return user || null;
};

export const getUserByUsername = async (username: string) => {
  const [user] = await db.select().from(users).where(eq(users.username, username));
  return user || null;
};

export const updateUser = async (id: string, data: { username?: string }) => {
  const [updatedUser] = await db.update(users).set({
    username: data.username,
  }).where(eq(users.id, id)).returning();
  
  return updatedUser || null;
};

export const getFriends = async (userId: string) => {
  // Query relationships where the user is either user_id or friend_id and status is accepted
  const userFriendships = await db
    .select({
      id: users.id,
      username: users.username,
      rating: users.rating,
      status: friendships.status,
    })
    .from(friendships)
    .innerJoin(
      users,
      // If the friendship record user_id matches us, join on the friend_id user record.
      // If the friendship record friend_id matches us, join on the user_id user record.
      eq(
        users.id,
        db.raw(`CASE WHEN friendships.user_id = '${userId}'::uuid THEN friendships.friend_id ELSE friendships.user_id END`)
      )
    )
    .where(
      and(
        db.raw(`(friendships.user_id = '${userId}'::uuid OR friendships.friend_id = '${userId}'::uuid)`),
        eq(friendships.status, "accepted")
      )
    );

  return userFriendships.map(uf => {
    const ratingInt = Math.round(uf.rating);
    const tier = tierForRating(ratingInt);
    return {
      handle: uf.username,
      initials: uf.username.substring(0, 2).toUpperCase(),
      state: "Online" as const, // Simulating presence
      activity: "Idle",
      rank: tier.name as any,
      rating: ratingInt
    };
  });
};

export const getLeaderboard = async (options: { page?: number; limit?: number }) => {
  const page = options.page || 1;
  const limit = options.limit || 20;
  const offset = (page - 1) * limit;

  // Query users ordered by rating desc
  const resultUsers = await db
    .select()
    .from(users)
    .orderBy(desc(users.rating))
    .limit(limit)
    .offset(offset);

  const countResult = await db.execute<{ count: number }>(
    `SELECT COUNT(*)::int as count FROM users`
  );
  const count = countResult.rows[0]?.count || 0;

  return {
    items: resultUsers.map((u, i) => {
      const pubUser = toPublicUser(u);
      return {
        rank: offset + i + 1,
        name: pubUser.name,
        handle: pubUser.handle,
        initials: pubUser.initials,
        rating: pubUser.rating,
        tier: pubUser.rank,
        rate: u.gamesPlayed > 0 ? `${Math.round((u.wins / u.gamesPlayed) * 100)}%` : "0%",
        trend: "+0",
        streak: 0,
        tone: pubUser.rank === "Bronze" ? "stone" : pubUser.rank === "Silver" ? "stone" : pubUser.rank === "Gold" ? "amber" : pubUser.rank === "Platinum" ? "lime" : pubUser.rank === "Diamond" ? "blue" : "red"
      };
    }),
    page,
    limit,
    total: count
  };
};
