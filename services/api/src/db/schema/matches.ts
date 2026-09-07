import { pgTable, uuid, text, timestamp, integer, boolean, doublePrecision, jsonb } from "drizzle-orm/pg-core";
import { users } from "./users.js";
import { problems } from "./problems.js";

export interface TestCaseResult {
  testIndex: number;
  passed: boolean;
  input: string;
  expectedOutput: string;
  actualOutput: string;
  stderr?: string;
  compileOutput?: string;
  details?: string;
}

export const matches = pgTable("matches", {
  id: uuid("id").defaultRandom().primaryKey(),
  problemId: uuid("problem_id").references(() => problems.id).notNull(),
  mode: text("mode").notNull(), // 'ranked','casual','room','practice'
  status: text("status").default("waiting").notNull(), // 'waiting','active','judging','completed','abandoned'
  playerOneId: uuid("player_one_id").references(() => users.id).notNull(),
  playerTwoId: uuid("player_two_id").references(() => users.id),
  winnerId: uuid("winner_id").references(() => users.id),
  roomCode: text("room_code"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const submissions = pgTable("submissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  matchId: uuid("match_id").references(() => matches.id, { onDelete: "set null" }),
  userId: uuid("user_id").references(() => users.id).notNull(),
  problemId: uuid("problem_id").references(() => problems.id).notNull(),
  language: text("language").notNull(),
  sourceCode: text("source_code").notNull(),
  verdict: text("verdict").default("pending").notNull(),
  passedTests: integer("passed_tests").default(0).notNull(),
  totalTests: integer("total_tests").default(0).notNull(),
  runtimeMs: integer("runtime_ms"),
  memoryKb: integer("memory_kb"),
  testResults: jsonb("test_results").$type<TestCaseResult[]>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  judgedAt: timestamp("judged_at", { withTimezone: true }),
});

export const ratingsHistory = pgTable("ratings_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  matchId: uuid("match_id").references(() => matches.id, { onDelete: "cascade" }).notNull(),
  ratingBefore: doublePrecision("rating_before").notNull(),
  ratingAfter: doublePrecision("rating_after").notNull(),
  rdBefore: doublePrecision("rd_before").notNull(),
  rdAfter: doublePrecision("rd_after").notNull(),
  volBefore: doublePrecision("vol_before").notNull(),
  volAfter: doublePrecision("vol_after").notNull(),
  delta: doublePrecision("delta").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const rooms = pgTable("rooms", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull().unique(),
  hostUserId: uuid("host_user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  problemId: uuid("problem_id").references(() => problems.id),
  isPrivate: boolean("is_private").default(true).notNull(),
  maxPlayers: integer("max_players").default(2).notNull(),
  timeControl: text("time_control").default("standard").notNull(),
  status: text("status").default("open").notNull(), // 'open','starting','in_progress','closed'
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const roomMembers = pgTable("room_members", {
  roomId: uuid("room_id").references(() => rooms.id, { onDelete: "cascade" }).notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  ready: boolean("ready").default(false).notNull(),
  joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
});

