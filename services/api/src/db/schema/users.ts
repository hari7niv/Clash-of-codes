import { pgTable, uuid, text, doublePrecision, integer, timestamp } from "drizzle-orm/pg-core";

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
});

export const friendships = pgTable("friendships", {
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  friendId: uuid("friend_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  status: text("status").default("pending").notNull(), // pending, accepted, blocked
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
