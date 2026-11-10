import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { client, createSchema, testDb } from "./helpers/database";
import { dailyLogs, habits, users } from "@/lib/db/schema";

const { getAuthUser } = vi.hoisted(() => ({ getAuthUser: vi.fn() }));
vi.mock("@/lib/session", () => ({
  getAuthUser,
  unauthorized: () => NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
}));
vi.mock("@/lib/db", async () => ({
  db: (await import("./helpers/database")).testDb,
}));

import { GET, PUT } from "@/app/api/logs/route";

const alice = { id: "alice", email: "alice@example.test" };
const bob = { id: "bob", email: "bob@example.test" };
const ownHabit = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const foreignHabit = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const archivedHabit = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const missingHabit = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const date = "2026-03-01";

function put(body: Record<string, unknown>) {
  return PUT(new NextRequest("http://localhost/api/logs", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }));
}

beforeAll(createSchema);
afterAll(() => client.close());
beforeEach(async () => {
  await client.exec('TRUNCATE TABLE "users" CASCADE');
  await testDb.insert(users).values([alice, bob]);
  await testDb.insert(habits).values([
    { id: ownHabit, userId: alice.id, name: "Read", vFull: "20 pages", vMin: "1 page" },
    { id: foreignHabit, userId: bob.id, name: "Walk", vFull: "1 mile", vMin: "1 step" },
    { id: archivedHabit, userId: alice.id, name: "Run", vFull: "5 km", vMin: "1 step", archived: new Date() },
  ]);
  await testDb.insert(dailyLogs).values({
    userId: bob.id, habitId: foreignHabit, date, status: "green", note: "Bob's note",
  });
  getAuthUser.mockReset();
  getAuthUser.mockResolvedValue(alice);
});

describe("log authentication and ownership", () => {
  it("rejects unauthenticated reads and writes without changing logs", async () => {
    getAuthUser.mockResolvedValue(null);
    expect((await GET(new NextRequest("http://localhost/api/logs"))).status).toBe(401);
    expect((await put({ habitId: ownHabit, date, status: "green" })).status).toBe(401);
    expect(await testDb.select().from(dailyLogs)).toHaveLength(1);
  });

  it.each(["green", "yellow", "red", null, undefined])(
    "rejects a foreign habit for status %s without changing either user's logs",
    async (status) => {
      const before = await testDb.select().from(dailyLogs);
      const response = await put({ habitId: foreignHabit, date, status });
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: "Not found" });
      expect(await testDb.select().from(dailyLogs)).toEqual(before);
    }
  );

  it("uses the same response for foreign and nonexistent habits", async () => {
    const foreign = await put({ habitId: foreignHabit, date, status: "green" });
    const missing = await put({ habitId: missingHabit, date, status: "green" });
    expect([foreign.status, missing.status]).toEqual([404, 404]);
    expect(await missing.json()).toEqual(await foreign.json());
  });

  it("does not bypass ownership with an uppercase UUID", async () => {
    const response = await put({ habitId: foreignHabit.toUpperCase(), date, status: "green" });
    expect(response.status).toBe(404);
    expect(await testDb.select().from(dailyLogs)).toHaveLength(1);
  });

  it.each(["yellow", null])("cannot mutate a pre-existing cross-owner row (%s)", async (status) => {
    await testDb.insert(dailyLogs).values({
      userId: alice.id, habitId: foreignHabit, date, status: "red", note: "Legacy row",
    });
    const before = await testDb.select().from(dailyLogs).orderBy(dailyLogs.id);
    expect((await put({ habitId: foreignHabit, date, status })).status).toBe(404);
    expect(await testDb.select().from(dailyLogs).orderBy(dailyLogs.id)).toEqual(before);
  });

  it("reads only the authenticated user's logs within an inclusive date range", async () => {
    await testDb.insert(dailyLogs).values([
      { userId: alice.id, habitId: ownHabit, date, status: "yellow" },
      { userId: alice.id, habitId: ownHabit, date: "2026-02-28", status: "green" },
    ]);
    const response = await GET(new NextRequest(`http://localhost/api/logs?from=${date}&to=${date}`));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      expect.objectContaining({ userId: alice.id, habitId: ownHabit, date, status: "yellow" }),
    ]);
  });
});

describe("legitimate log lifecycle", () => {
  it.each(["green", "yellow", "red"])("creates an owned %s log and ignores a supplied userId", async (status) => {
    const response = await put({ habitId: ownHabit, date, status, userId: bob.id, note: "One page" });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ userId: alice.id, habitId: ownHabit, date, status, note: "One page" });
  });

  it("keeps retries idempotent and updates the existing row", async () => {
    const body = { habitId: ownHabit, date, status: "green", note: "First" };
    const first = await (await put(body)).json();
    expect((await (await put(body)).json()).id).toBe(first.id);
    const updated = await (await put({ ...body, status: "yellow", note: "Minimum" })).json();
    expect(updated).toMatchObject({ id: first.id, status: "yellow", note: "Minimum" });
    expect(await testDb.select().from(dailyLogs).where(eq(dailyLogs.userId, alice.id))).toHaveLength(1);
  });

  it.each([null, undefined])("clears an owned log idempotently with status %s", async (status) => {
    await put({ habitId: ownHabit, date, status: "green" });
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await put({ habitId: ownHabit, date, status });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ deleted: true });
    }
    expect(await testDb.select().from(dailyLogs)).toEqual([
      expect.objectContaining({ userId: bob.id, habitId: foreignHabit, note: "Bob's note" }),
    ]);
  });

  it("preserves historical logging and clearing for owned archived habits", async () => {
    expect((await put({ habitId: archivedHabit, date: "2024-02-29", status: "yellow" })).status).toBe(200);
    expect((await put({ habitId: archivedHabit, date: "2024-02-29", status: null })).status).toBe(200);
  });

  it("accepts uppercase UUIDs for owned habits", async () => {
    const response = await put({ habitId: ownHabit.toUpperCase(), date, status: "green" });
    expect(response.status).toBe(200);
    expect((await response.json()).habitId).toBe(ownHabit);
  });

  it.each([{ date }, { habitId: ownHabit }])("rejects missing required fields: %j", async (body) => {
    expect((await put({ ...body, status: "green" })).status).toBe(400);
    expect(await testDb.select().from(dailyLogs)).toHaveLength(1);
  });

  it("rejects an unsupported status without writing", async () => {
    expect((await put({ habitId: ownHabit, date, status: "blue" })).status).toBe(400);
    expect(await testDb.select().from(dailyLogs)).toHaveLength(1);
  });
});
