/**
 * demo-reset — wipes and reseeds the demonstration dataset.
 * Usage: pnpm db:reset
 */
import { execFileSync } from "node:child_process";

console.log("Resetting demo data…");
execFileSync("npx", ["tsx", "prisma/seed.ts"], { stdio: "inherit" });
console.log("Demo data restored.");
