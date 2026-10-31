// Applies server/migrations/*.sql in filename order, each in its own transaction.
// Already-applied files are recorded in schema_migrations, so re-running is a no-op.
require("dotenv").config({ quiet: true });
const fs = require("node:fs");
const path = require("node:path");
const { pool } = require("./db");

const dir = path.join(__dirname, "migrations");

async function main() {
  const client = await pool.connect();
  try {
    // Serialize concurrent runs (e.g. two deploys) with an advisory lock.
    await client.query("SELECT pg_advisory_lock(727001)");
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const { rows } = await client.query("SELECT name FROM schema_migrations");
    const done = new Set(rows.map((r) => r.name));
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

    let applied = 0;
    for (const file of files) {
      if (done.has(file)) continue;
      const sql = fs.readFileSync(path.join(dir, file), "utf8");
      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw new Error(`migration ${file} failed: ${err.message}`);
      }
      console.log(`[migrate] applied ${file}`);
      applied++;
    }
    console.log(applied ? `[migrate] ${applied} migration(s) applied` : "[migrate] up to date");
  } finally {
    await client.query("SELECT pg_advisory_unlock(727001)").catch(() => {});
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("[migrate]", err.message);
  process.exit(1);
});
