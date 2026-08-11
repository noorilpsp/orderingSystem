/**
 * Run drizzle/0025_catalog_i18n_modifiers_tags.sql (no psql required).
 *
 * Usage: npm run db:migrate:0025
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
  const migrationPath = join(
    process.cwd(),
    "drizzle/0025_catalog_i18n_modifiers_tags.sql",
  );
  const migration = readFileSync(migrationPath, "utf8");
  const stmts = migration
    .split("\n")
    .filter((line) => line.trim() && !line.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const stmt of stmts) {
    try {
      await sql.query(stmt + ";");
    } catch (error) {
      const message = String((error as { message?: string }).message ?? error);
      if (
        message.includes("already exists") ||
        (error as { code?: string }).code === "42710" ||
        (error as { code?: string }).code === "42P07" ||
        message.includes("duplicate column") ||
        (error as { code?: string }).code === "42701"
      ) {
        console.log("Skipping (already exists):", stmt.slice(0, 60) + "...");
        continue;
      }
      throw error;
    }
  }
  console.log("Migration 0025 applied.");
}
run().catch((err) => {
  console.error(err);
  process.exit(1);
});
