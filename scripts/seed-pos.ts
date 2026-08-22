/**
 * POS demo data seed - runs staff, menu, and orders seeds in order.
 * Run with: npm run seed:pos
 *
 * Cross-platform: uses spawnSync without shell. Stops on first failure.
 */

import { spawnSync } from "child_process";

const seeds = ["seed:staff", "seed:menu", "seed:orders"] as const;
const npm = process.platform === "win32" ? "npm.cmd" : "npm";

function main() {
  console.log("🌱 Running POS seed (staff → menu → orders)...\n");

  for (const script of seeds) {
    console.log(`▶ npm run ${script}\n`);
    const result = spawnSync(npm, ["run", script], {
      stdio: "inherit",
    });
    if (result.status !== 0) {
      console.error(`\n❌ seed:pos failed at ${script} (exit ${result.status ?? 1})\n`);
      process.exit(result.status ?? 1);
    }
    console.log("");
  }

  console.log("✨ POS seed complete.");
}

main();
