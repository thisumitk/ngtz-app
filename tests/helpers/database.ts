import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { createRequire } from "node:module";
import * as schema from "@/lib/db/schema";

// drizzle-kit 0.24 bundles CommonJS dependencies; use its CommonJS entry point.
const { generateDrizzleJson, generateMigration } = createRequire(import.meta.url)(
  "drizzle-kit/api"
) as typeof import("drizzle-kit/api");

// Real PostgreSQL in memory. Never connects to DATABASE_URL or a user database.
export const client = new PGlite();
export const testDb = drizzle(client, { schema });

export async function createSchema() {
  // Derive DDL from the application schema so fixtures cannot hide constraint drift.
  const statements = await generateMigration(
    generateDrizzleJson({}),
    generateDrizzleJson(schema)
  );
  for (const statement of statements) await client.exec(statement);
}
