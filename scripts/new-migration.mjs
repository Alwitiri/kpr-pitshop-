// Usage: npm run migration:new add_loyalty_points
// Compares the dev database with prisma/schema.prisma and writes the SQL needed
// as the next numbered file in prisma/migrations-sql. Installed copies apply it
// automatically the next time they start.
import { execSync } from "node:child_process";
import { readdirSync, writeFileSync } from "node:fs";

const name = (process.argv[2] || "change").replace(/[^a-z0-9_]/gi, "_").toLowerCase();
const dir = "prisma/migrations-sql";
const next = String(readdirSync(dir).filter((f) => f.endsWith(".sql")).length + 1).padStart(4, "0");
const sql = execSync(
  "npx prisma migrate diff --from-url file:./prisma/dev.db --to-schema-datamodel prisma/schema.prisma --script",
  { encoding: "utf8" },
);
if (!sql.trim() || /empty migration/i.test(sql)) {
  console.log("No schema changes found.");
  process.exit(0);
}
const file = `${dir}/${next}_${name}.sql`;
writeFileSync(file, sql);
console.log(`Wrote ${file}. Restart the app to apply it.`);
