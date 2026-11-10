import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import type { AdapterUser } from "next-auth/adapters";
import { client, createSchema, testDb } from "./helpers/database";
import { accounts, dailyLogs, habits, sessions, users, verificationTokens } from "@/lib/db/schema";

const adapter = DrizzleAdapter(testDb, {
  usersTable: users,
  accountsTable: accounts,
  sessionsTable: sessions,
  verificationTokensTable: verificationTokens,
});

beforeAll(createSchema);
afterAll(() => client.close());
beforeEach(() => client.exec('TRUNCATE TABLE "users", "verification_tokens" CASCADE'));

async function createUser() {
  // NextAuth v4 calls createUser without an ID; the adapter must use our default.
  const create = adapter.createUser as (data: Omit<AdapterUser, "id">) => Promise<AdapterUser>;
  return create({
    email: "alice@example.test", emailVerified: null, name: "Alice", image: null,
  });
}

describe("NextAuth Drizzle adapter compatibility", () => {
  it("creates, finds, and updates a user using the existing schema", async () => {
    const user = await createUser();
    expect(user.id).toBeTruthy();
    expect(await adapter.getUser!(user.id)).toMatchObject({ email: user.email });
    expect(await adapter.getUserByEmail!(user.email)).toMatchObject({ id: user.id });
    expect(await adapter.updateUser!({ id: user.id, name: "Updated" })).toMatchObject({ name: "Updated" });
  });

  it("links and unlinks a provider account", async () => {
    const user = await createUser();
    const account = { userId: user.id, type: "oauth" as const, provider: "github", providerAccountId: "test-account" };
    await adapter.linkAccount!(account);
    expect(await adapter.getUserByAccount!(account)).toMatchObject({ id: user.id });
    await adapter.unlinkAccount!(account);
    expect(await adapter.getUserByAccount!(account)).toBeNull();
  });

  it("creates, retrieves, renews, and deletes database sessions", async () => {
    const user = await createUser();
    const sessionToken = "test-session-not-a-real-credential";
    const expires = new Date("2030-01-01T00:00:00Z");
    await adapter.createSession!({ sessionToken, userId: user.id, expires });
    expect(await adapter.getSessionAndUser!(sessionToken)).toMatchObject({
      user: { id: user.id }, session: { userId: user.id, expires },
    });
    const renewed = new Date("2030-02-01T00:00:00Z");
    expect(await adapter.updateSession!({ sessionToken, expires: renewed })).toMatchObject({ expires: renewed });
    await adapter.deleteSession!(sessionToken);
    expect(await adapter.getSessionAndUser!(sessionToken)).toBeNull();
  });

  it("consumes verification tokens once", async () => {
    const token = { identifier: "alice@example.test", token: "test-token", expires: new Date("2030-01-01Z") };
    await adapter.createVerificationToken!(token);
    expect(await adapter.useVerificationToken!(token)).toEqual(token);
    expect(await adapter.useVerificationToken!(token)).toBeNull();
  });

  it("retains account deletion cascades", async () => {
    const user = await createUser();
    await adapter.linkAccount!({ userId: user.id, type: "oauth", provider: "github", providerAccountId: "test-account" });
    await adapter.createSession!({ sessionToken: "test-session", userId: user.id, expires: new Date("2030-01-01Z") });
    const [habit] = await testDb.insert(habits).values({ userId: user.id, name: "Read", vFull: "20 pages", vMin: "1 page" }).returning();
    await testDb.insert(dailyLogs).values({ userId: user.id, habitId: habit.id, date: "2026-01-01", status: "yellow" });
    await adapter.deleteUser!(user.id);
    for (const table of [users, accounts, sessions, habits, dailyLogs]) {
      expect(await testDb.select().from(table)).toEqual([]);
    }
  });
});
