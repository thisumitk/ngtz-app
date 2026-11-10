import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import { getServerSession } from "next-auth";
import { client, createSchema, testDb } from "./helpers/database";
import { sessions, users } from "@/lib/db/schema";

vi.mock("@/lib/db", async () => ({ db: (await import("./helpers/database")).testDb }));
import { authOptions } from "@/lib/auth";

beforeAll(createSchema);
afterAll(() => client.close());
beforeEach(async () => {
  await client.exec('TRUNCATE TABLE "users" CASCADE');
  await testDb.insert(users).values({ id: "alice", email: "alice@example.test", name: "Alice" });
});

async function readSession(token: string) {
  const req = Object.assign(new IncomingMessage(new Socket()), {
    cookies: { "next-auth.session-token": token },
  });
  const res = new ServerResponse(req);
  return getServerSession(req, res, {
    ...authOptions,
    useSecureCookies: false,
    secret: "synthetic-session-test-secret",
  });
}

describe("NextAuth database-session lifecycle", () => {
  it("resolves a valid cookie through the real adapter and session callback", async () => {
    const expires = new Date(Date.now() + 86_400_000);
    await testDb.insert(sessions).values({ userId: "alice", sessionToken: "valid-test-session", expires });
    expect(await readSession("valid-test-session")).toMatchObject({
      user: { id: "alice", email: "alice@example.test", name: "Alice" },
    });
    expect((await testDb.select().from(sessions))[0].expires.getTime()).toBeGreaterThan(expires.getTime());
  });

  it("rejects and removes expired sessions", async () => {
    await testDb.insert(sessions).values({ userId: "alice", sessionToken: "expired-test-session", expires: new Date(Date.now() - 1000) });
    expect(await readSession("expired-test-session")).toBeNull();
    expect(await testDb.select().from(sessions)).toEqual([]);
  });

  it("rejects unknown session tokens", async () => {
    expect(await readSession("unknown-test-session")).toBeNull();
  });
});
