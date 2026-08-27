import { pgTable, uuid, text, integer, timestamp, boolean } from "drizzle-orm/pg-core";

export const problems = pgTable("problems", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  statement: text("statement").notNull(),
  difficulty: text("difficulty").notNull(), // easy, medium, hard
  rating: integer("rating").default(1200).notNull(),
  timeLimitMs: integer("time_limit_ms").default(2000).notNull(),
  memoryLimitKb: integer("memory_limit_kb").default(262144).notNull(),
  tags: text("tags").array().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const testCases = pgTable("test_cases", {
  id: uuid("id").defaultRandom().primaryKey(),
  problemId: uuid("problem_id").references(() => problems.id, { onDelete: "cascade" }).notNull(),
  input: text("input").notNull(),
  expectedOutput: text("expected_output").notNull(),
  isSample: boolean("is_sample").default(false).notNull(),
  ordinal: integer("ordinal").notNull(),
});
