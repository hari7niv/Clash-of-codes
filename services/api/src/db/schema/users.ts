import { pgTable, uuid, text, doublePrecision, integer, timestamp, date, boolean } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  rating: doublePrecision("rating").default(1500).notNull(),
  ratingDeviation: doublePrecision("rating_deviation").default(350).notNull(),
  ratingVolatility: doublePrecision("rating_volatility").default(0.06).notNull(),
  gamesPlayed: integer("games_played").default(0).notNull(),
  wins: integer("wins").default(0).notNull(),
  losses: integer("losses").default(0).notNull(),
  draws: integer("draws").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  dateOfBirth: date("date_of_birth").default("2000-01-01").notNull(),
  bio: text("bio"),
  location: text("location"),
});

export const friendships = pgTable("friendships", {
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  friendId: uuid("friend_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  status: text("status").default("pending").notNull(), // pending, accepted, blocked
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const refreshTokens = pgTable("refresh_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const questDefinitions = pgTable("quest_definitions", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  xpReward: integer("xp_reward").default(100).notNull(),
  targetType: text("target_type").notNull(), // 'win', 'solve', 'battle'
  targetValue: integer("target_value").default(1).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const userQuests = pgTable("user_quests", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  questId: uuid("quest_id").references(() => questDefinitions.id, { onDelete: "cascade" }).notNull(),
  progress: integer("progress").default(0).notNull(),
  completed: boolean("completed").default(false).notNull(),
  rewardClaimed: boolean("reward_claimed").default(false).notNull(),
  assignedDate: date("assigned_date").defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const userProgress = pgTable("user_progress", {
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).primaryKey(),
  level: integer("level").default(1).notNull(),
  xp: integer("xp").default(0).notNull(),
  xpGoal: integer("xp_goal").default(1000).notNull(),
  streak: integer("streak").default(0).notNull(),
  peakRating: doublePrecision("peak_rating").default(1500).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
