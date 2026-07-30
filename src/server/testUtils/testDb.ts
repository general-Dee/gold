import fs from "node:fs";
import path from "node:path";

/**
 * Points the db client module at a fresh in-memory sqlite db and applies the
 * drizzle migrations to it via that same connection, then returns db/schema
 * for the caller's own fixtures. Call once per test file, in beforeAll.
 *
 * Vitest's default pool (forks, isolate: true) gives each test file its own
 * module registry, so setting DATABASE_URL before dynamically importing
 * "@/server/db/client" here yields a fresh, file-local in-memory db — no
 * shared setupFiles singleton needed, and no risk of state leaking between
 * test files.
 */
export async function bootstrapTestDb() {
  process.env.DATABASE_URL = ":memory:";

  const { db } = await import("@/server/db/client");
  const schema = await import("@/server/db/schema");

  const migrationsDir = path.resolve(__dirname, "../../../drizzle");
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
    for (const statement of sql.split("--> statement-breakpoint")) {
      const trimmed = statement.trim();
      if (trimmed) await db.$client.execute(trimmed);
    }
  }

  return { db, schema };
}
