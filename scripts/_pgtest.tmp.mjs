import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";


const db = await PGlite.create();
const files = [
  "db/local/00_auth_shim.sql",
  ...readdirSync("drizzle").filter((f) => f.endsWith(".sql")).sort().map((f) => "drizzle/" + f).sort(),
  "db/local/10_assertions.sql",
];

for (const file of files) {
  const sql = readFileSync(file, "utf8");
  try {
    await db.exec(sql);
    console.log("OK   ", file);
  } catch (error) {
    console.log("FAIL ", file, "→", error.message);
    process.exit(1);
  }
}
console.log("all good");
