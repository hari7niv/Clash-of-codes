import { db } from "../db/client.js";
import { users, friendships } from "../db/schema/users.js";
import { eq, desc, and, or, sql } from "drizzle-orm";
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

export const lookupUser = async (id: string) => {
  const [user] = await db.select().from(users).where(eq(users.id, id));
  return user || null;
};

export const lookupUserByUsername = async (username: string) => {
  const [user] = await db.select().from(users).where(eq(users.username, username));
  return user || null;
};

export const lookupUserByEmail = async (email: string) => {
  const [user] = await db.select().from(users).where(eq(users.email, email));
  return user || null;
};

export const createUser = async (data: {
  username: string;
  email: string;
  passwordHash: string;
  dateOfBirth?: string;
}) => {
  const [user] = await db.insert(users).values({
    username: data.username,
    email: data.email,
    passwordHash: data.passwordHash,
    dateOfBirth: data.dateOfBirth,
  }).returning();
  
  return user || null;
};

export const updateUser = async (id: string, data: {
  username?: string;
  email?: string;
}) => {
  const [updatedUser] = await db.update(users).set({
    username: data.username,
  }).where(eq(users.id, id)).returning();
  
  return updatedUser || null;
};

export const getFriends = async (userId: string) => {
  // Query 1: Get friends where current user is the requester (userId)
  const asRequester = await db
    .select({
      id: users.id,
      username: users.username,
      rating: users.rating,
      status: friendships.status,
    })
    .from(friendships)
    .innerJoin(users, eq(users.id, friendships.friendId))
    .where(
      and(
        eq(friendships.userId, userId),
        eq(friendships.status, "accepted")
      )
    );

  // Query 2: Get friends where current user is the recipient (friendId)
  const asRecipient = await db
    .select({
      id: users.id,
      username: users.username,
      rating: users.rating,
      status: friendships.status,
    })
    .from(friendships)
    .innerJoin(users, eq(users.id, friendships.userId))
    .where(
      and(
        eq(friendships.friendId, userId),
        eq(friendships.status, "accepted")
      )
    );

  // Combine both result sets
  const userFriendships = [...asRequester, ...asRecipient];

  return userFriendships.map(uf => {
    const ratingInt = Math.round(uf.rating);
    const tier = tierForRating(ratingInt);
    return {
      handle: uf.username,
      initials: uf.username.substring(0, 2).toUpperCase(),
      state: "Offline" as const, // Simulating presence
      activity: "Idle",
      rank: tier.name as any,
      rating: ratingInt
    };
  });
};

export const getLeaderboard = async (options: { 
  page?: number; 
  limit?: number; 
  tab?: string;
  userId?: string;
}) => {
  const page = options.page || 1;
  const limit = options.limit || 20;
  const offset = (page - 1) * limit;
  const tab = options.tab || "global";
  const userId = options.userId;

  let baseQuery = db.select().from(users);
  let countQuery: any;

  // Apply tab-specific filtering
  switch (tab.toLowerCase()) {
    case "weekly":
      // Weekly filter: users who played in the last 7 days - simplified to all users for now
      // In production, you'd filter by updatedAt or a lastActiveAt field
      baseQuery = baseQuery.where(
        sql`${users.updatedAt} >= NOW() - INTERVAL '7 days'`
      );
      countQuery = sql`SELECT COUNT(*)::int as count FROM ${users} WHERE ${users.updatedAt} >= NOW() - INTERVAL '7 days'`;
      break;
    
    case "friends":
      // Friends filter: only show friends of the current user
      if (userId) {
        baseQuery = db
          .select({
            id: users.id,
            username: users.username,
            email: users.email,
            passwordHash: users.passwordHash,
            rating: users.rating,
            ratingDeviation: users.ratingDeviation,
            ratingVolatility: users.ratingVolatility,
            gamesPlayed: users.gamesPlayed,
            wins: users.wins,
            losses: users.losses,
            draws: users.draws,
            createdAt: users.createdAt,
            updatedAt: users.updatedAt,
            emailVerifiedAt: users.emailVerifiedAt,
            dateOfBirth: users.dateOfBirth,
            bio: users.bio,
            location: users.location,
          })
          .from(users)
          .innerJoin(
            friendships,
            and(
              or(
                and(eq(friendships.userId, userId), eq(friendships.friendId, users.id)),
                and(eq(friendships.friendId, userId), eq(friendships.userId, users.id))
              ),
              eq(friendships.status, "accepted")
            )
          ) as any;
        countQuery = sql`SELECT COUNT(*)::int as count FROM ${users} 
          INNER JOIN ${friendships} ON (
            (${friendships.userId} = ${userId}::uuid AND ${friendships.friendId} = ${users.id}) OR
            (${friendships.friendId} = ${userId}::uuid AND ${friendships.userId} = ${users.id})
          ) AND ${friendships.status} = 'accepted'`;
      }
      break;
    
    case "country":
      // Country filter: users from the same location (using location field as proxy)
      // This would require proper country data in production
      if (userId) {
        const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
        if (currentUser && currentUser.location) {
          baseQuery = baseQuery.where(eq(users.location, currentUser.location));
          countQuery = sql`SELECT COUNT(*)::int as count FROM ${users} WHERE ${users.location} = ${currentUser.location}`;
        }
      }
      break;
    
    case "rising stars":
      // Rising stars: users with highest rating gain in the last 7 days
      // For now, filter by recent activity and high win rate
      baseQuery = baseQuery.where(
        and(
          sql`${users.updatedAt} >= NOW() - INTERVAL '7 days'`,
          sql`${users.gamesPlayed} >= 5`
        )
      );
      countQuery = sql`SELECT COUNT(*)::int as count FROM ${users} 
        WHERE ${users.updatedAt} >= NOW() - INTERVAL '7 days' AND ${users.gamesPlayed} >= 5`;
      break;
    
    case "topic":
      // Topic-based leaderboard - would need additional tables for problem topics
      // For now, fall through to global
    case "global":
    default:
      countQuery = sql`SELECT COUNT(*)::int as count FROM ${users}`;
      break;
  }

  // Execute the query with ordering and pagination
  const resultUsers = await baseQuery
    .orderBy(desc(users.rating))
    .limit(limit)
    .offset(offset);

  const countResult = await db.execute(countQuery);
  const count = (countResult.rows[0] as any)?.count || 0;

  // Calculate user's rank if userId provided
  let userRank: number | null = null;
  if (userId) {
    const userRankResult = await db.execute(
      sql`SELECT COUNT(*)::int + 1 as rank FROM ${users} u2 
          WHERE u2.rating > (SELECT rating FROM ${users} WHERE id = ${userId}::uuid)`
    );
    userRank = (userRankResult.rows[0] as any)?.rank || null;
  }

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
    total: count,
    userRank
  };
};

export const getUserById = lookupUser;
export const getUserByEmail = lookupUserByEmail;
export const getUserByUsername = lookupUserByUsername;

