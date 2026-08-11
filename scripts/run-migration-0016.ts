/**
 * Run drizzle/0016_loyalty_points.sql (no psql required).
 * Loads .env.local via Next.js env config.
 *
 * Usage: npm run db:migrate:0016
 */
import { loadEnvConfig } from "@next/env";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";
import { join } from "path";

loadEnvConfig(process.cwd());

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!url) {
  console.error("DATABASE_URL or POSTGRES_URL must be set (e.g. in .env.local)");
  process.exit(1);
}

async function run() {
  const sql = neon(url);
  const migrationPath = join(process.cwd(), "drizzle/0016_loyalty_points.sql");
  const migration = readFileSync(migrationPath, "utf8");
  const stmts = migration
    .split("\n")
    .filter((line) => line.trim() && !line.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const stmt of stmts) {
    await sql.query(stmt + ";");
  }
  console.log("Migration 0016 applied.");
}
run().catch((err) => {
  console.error(err);
  process.exit(1);
});
