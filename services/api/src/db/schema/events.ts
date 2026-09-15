import { pgTable, uuid, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  type: text("type").notNull(), // 'friend_request' | 'challenge_invite' | 'quest_complete' | 'match_result' | 'system'
  title: text("title").notNull(),
  body: text("body").notNull(),
  href: text("href"), // optional deep-link path, e.g. "/app/friends"
  read: boolean("read").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const pasteEvents = pgTable("paste_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  matchId: uuid("match_id").notNull(), // no FK constraint — log even if match deleted
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  pastedText: text("pasted_text").notNull(),
  language: text("language").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
});
