const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set (see .env.example)");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
});

pool.on("error", (err) => {
  console.error("[db] idle client error:", err.message);
});

module.exports = { pool, query: (text, params) => pool.query(text, params) };
