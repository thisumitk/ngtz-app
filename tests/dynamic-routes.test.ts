import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { client, createSchema, testDb } from "./helpers/database";
import { accounts, habits, users } from "@/lib/db/schema";

const { getAuthUser } = vi.hoisted(() => ({ getAuthUser: vi.fn() }));
vi.mock("@/lib/session", () => ({
  getAuthUser,
  unauthorized: () => NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
}));
vi.mock("@/lib/db", async () => ({ db: (await import("./helpers/database")).testDb }));

import { PATCH, DELETE as archiveHabit } from "@/app/api/habits/[id]/route";
import { DELETE as unlinkProvider } from "@/app/api/account/providers/[provider]/route";

const alice = { id: "alice", email: "alice@example.test" };
const bob = { id: "bob", email: "bob@example.test" };
const ownHabit = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const foreignHabit = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const request = () => new NextRequest("http://localhost/api/test", { method: "DELETE" });
const context = (id: string) => ({ params: Promise.resolve({ id }) });

beforeAll(createSchema);
afterAll(() => client.close());
beforeEach(async () => {
  await client.exec('TRUNCATE TABLE "users" CASCADE');
  await testDb.insert(users).values([alice, bob]);
  await testDb.insert(habits).values([
    { id: ownHabit, userId: alice.id, name: "Read", vFull: "20 pages", vMin: "1 page" },
    { id: foreignHabit, userId: bob.id, name: "Walk", vFull: "1 mile", vMin: "1 step" },
  ]);
  await testDb.insert(accounts).values([
    { userId: alice.id, type: "oauth", provider: "google", providerAccountId: "alice-google" },
    { userId: alice.id, type: "oauth", provider: "github", providerAccountId: "alice-github" },
    { userId: bob.id, type: "oauth", provider: "github", providerAccountId: "bob-github" },
  ]);
  getAuthUser.mockReset();
  getAuthUser.mockResolvedValue(alice);
});

describe("Next.js async route parameters", () => {
  it("updates an owned habit after resolving params", async () => {
    const response = await PATCH(new NextRequest("http://localhost/api/habits/test", {
      method: "PATCH", body: JSON.stringify({ name: "Read daily" }),
    }), context(ownHabit));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id: ownHabit, name: "Read daily" });
  });

  it("rejects updates to a foreign habit", async () => {
    const response = await PATCH(new NextRequest("http://localhost/api/habits/test", {
      method: "PATCH", body: JSON.stringify({ name: "Changed" }),
    }), context(foreignHabit));
    expect(response.status).toBe(404);
    expect((await testDb.select().from(habits).where(eq(habits.id, foreignHabit)))[0].name).toBe("Walk");
  });

  it("archives only an owned habit", async () => {
    expect((await archiveHabit(request(), context(ownHabit))).status).toBe(200);
    expect((await archiveHabit(request(), context(foreignHabit))).status).toBe(404);
    expect((await testDb.select().from(habits).where(eq(habits.id, ownHabit)))[0].archived).toBeInstanceOf(Date);
    expect((await testDb.select().from(habits).where(eq(habits.id, foreignHabit)))[0].archived).toBeNull();
  });

  it("unlinks the resolved provider only for its owner", async () => {
    const response = await unlinkProvider(request(), { params: Promise.resolve({ provider: "github" }) });
    expect(response.status).toBe(200);
    expect(await testDb.select().from(accounts).where(eq(accounts.provider, "github"))).toEqual([
      expect.objectContaining({ userId: bob.id }),
    ]);
    expect((await unlinkProvider(request(), { params: Promise.resolve({ provider: "google" }) })).status).toBe(400);
  });

  it("preserves authentication on all three handlers", async () => {
    getAuthUser.mockResolvedValue(null);
    expect((await PATCH(request(), context(ownHabit))).status).toBe(401);
    expect((await archiveHabit(request(), context(ownHabit))).status).toBe(401);
    expect((await unlinkProvider(request(), { params: Promise.resolve({ provider: "github" }) })).status).toBe(401);
  });
});
