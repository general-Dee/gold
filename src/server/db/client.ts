import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

const client = createClient({
  url: process.env.DATABASE_URL ?? "file:./data/trading-journal.db",
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

// SQLite disables FK enforcement per-connection by default — without this,
// ON DELETE CASCADE in the schema (trade_images, trade_rule_checks) is a no-op.
void client.execute("PRAGMA foreign_keys = ON;");

export const db = drizzle(client, { schema });
