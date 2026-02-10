import {
  pgTable,
  text,
  timestamp,
  integer,
  primaryKey,
  uniqueIndex,
  pgEnum,
  uuid,
  date,
} from "drizzle-orm/pg-core";
import type { AdapterAccount } from "next-auth/adapters";

// ── NextAuth required tables ─────────────────────────────────

export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").notNull(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccount["type"]>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => ({
    compoundKey: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  })
);

export const sessions = pgTable("sessions", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => ({
    compoundKey: primaryKey({ columns: [vt.identifier, vt.token] }),
  })
);

// ── NGTZ domain tables ───────────────────────────────────────

export const statusEnum = pgEnum("log_status", ["green", "yellow", "red"]);

export const habits = pgTable("habits", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  icon: text("icon").notNull().default("🎯"),
  vFull: text("v_full").notNull(), // Version 1.0 description
  vMin: text("v_min").notNull(), // Version 0.1 description
  sortOrder: integer("sort_order").notNull().default(0),
  archived: timestamp("archived_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export const dailyLogs = pgTable(
  "daily_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    habitId: uuid("habit_id")
      .notNull()
      .references(() => habits.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(), // YYYY-MM-DD
    status: statusEnum("status").notNull(), // green | yellow | red
    note: text("note"), // optional daily note
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (log) => ({
    // One log per habit per day per user — idempotent upsert
    uniqueLog: uniqueIndex("uq_user_habit_date").on(
      log.userId,
      log.habitId,
      log.date
    ),
  })
);

// ── Types ────────────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type Habit = typeof habits.$inferSelect;
export type DailyLog = typeof dailyLogs.$inferSelect;
export type LogStatus = "green" | "yellow" | "red";
