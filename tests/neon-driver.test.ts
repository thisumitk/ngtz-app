import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { neonConfig } from "@neondatabase/serverless";
import { eq } from "drizzle-orm";
import { sessions } from "@/lib/db/schema";

const fetchMock = vi.fn();
const originalFetch = neonConfig.fetchFunction;
let db: typeof import("@/lib/db").db;

beforeAll(async () => {
  // Exercise the production connection module, but intercept ALL Neon HTTP I/O.
  vi.stubEnv("DATABASE_URL", "postgresql://test:test@localhost:5432/ngtz_driver_test");
  neonConfig.fetchFunction = fetchMock;
  ({ db } = await import("@/lib/db"));
});
afterAll(() => {
  neonConfig.fetchFunction = originalFetch;
  vi.unstubAllEnvs();
});
beforeEach(() => fetchMock.mockReset());

it("sends bound SQL through Neon 1.x and maps session dates", async () => {
  fetchMock.mockResolvedValue(Response.json({
    fields: [
      { name: "userId", dataTypeID: 25 },
      { name: "expires", dataTypeID: 1114 },
    ],
    rows: [["alice", "2030-01-01 00:00:00"]],
    rowCount: 1,
    command: "SELECT",
  }));
  const result = await db.select({ userId: sessions.userId, expires: sessions.expires })
    .from(sessions).where(eq(sessions.sessionToken, "synthetic-token"));
  expect(result).toEqual([{ userId: "alice", expires: new Date("2030-01-01T00:00:00Z") }]);
  expect(fetchMock).toHaveBeenCalledOnce();
  const request = JSON.parse(fetchMock.mock.calls[0][1].body);
  expect(request.query).toContain('"sessions"."sessionToken" = $1');
  expect(request.query).not.toContain("synthetic-token");
  expect(request.params).toEqual(["synthetic-token"]);
});

it("propagates a database failure instead of returning a false success", async () => {
  fetchMock.mockResolvedValue(Response.json({ message: "synthetic database error", code: "XX000" }, { status: 400 }));
  await expect(db.select().from(sessions)).rejects.toThrow();
  expect(fetchMock).toHaveBeenCalledOnce();
});
