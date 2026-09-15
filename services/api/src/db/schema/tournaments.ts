import { pgTable, uuid, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const tournaments = pgTable("tournaments", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  format: text("format").notNull().default("single_elimination"), // 'single_elimination' | 'swiss'
  status: text("status").notNull().default("upcoming"), // 'upcoming' | 'registration' | 'active' | 'completed' | 'cancelled'
  maxParticipants: integer("max_participants").notNull().default(16),
  startTime: timestamp("start_time", { withTimezone: true }),
  endTime: timestamp("end_time", { withTimezone: true }),
  prizeDescription: text("prize_description"),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const tournamentParticipants = pgTable("tournament_participants", {
  id: uuid("id").defaultRandom().primaryKey(),
  tournamentId: uuid("tournament_id").references(() => tournaments.id, { onDelete: "cascade" }).notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  seed: integer("seed"), // seeding rank at start
  eliminated: boolean("eliminated").default(false).notNull(),
  finalRank: integer("final_rank"),
  registeredAt: timestamp("registered_at", { withTimezone: true }).defaultNow().notNull(),
});

export const tournamentMatches = pgTable("tournament_matches", {
  id: uuid("id").defaultRandom().primaryKey(),
  tournamentId: uuid("tournament_id").references(() => tournaments.id, { onDelete: "cascade" }).notNull(),
  round: integer("round").notNull(), // 1 = first round, 2 = QF, etc.
  matchNumber: integer("match_number").notNull(), // position in bracket
  playerOneId: uuid("player_one_id").references(() => users.id),
  playerTwoId: uuid("player_two_id").references(() => users.id),
  winnerId: uuid("winner_id").references(() => users.id),
  gameMatchId: uuid("game_match_id"), // FK to the actual matches table (not enforced to avoid circular dep)
  status: text("status").notNull().default("pending"), // 'pending' | 'active' | 'completed'
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
