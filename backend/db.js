// ============================================================
// db.js — PostgreSQL connection pool (Supabase)
// Expert Vision Labs Pvt. Ltd.
// ============================================================
// Uses the `pg` package (node-postgres).
// One pool is created and shared across server.js + scheduler.js
// so we never exceed Supabase's connection limit.
// ============================================================
const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  console.error("❌  DATABASE_URL is not set in .env — PostgreSQL will not connect.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // required for Supabase hosted Postgres
  },
  // Connection pool settings
  max:             10,   // max simultaneous connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// ── Test connection on startup ────────────────────────────────
pool.connect((err, client, release) => {
  if (err) {
    console.error("❌  PostgreSQL connection failed:", err.message);
    return;
  }
  client.query("SELECT NOW() AS now", (err, result) => {
    release();
    if (err) {
      console.error("❌  PostgreSQL test query failed:", err.message);
    } else {
      console.log(`✅  PostgreSQL connected — Supabase time: ${result.rows[0].now}`);
    }
  });
});

// ── Graceful shutdown ─────────────────────────────────────────
process.on("SIGINT",  () => { pool.end(); process.exit(0); });
process.on("SIGTERM", () => { pool.end(); process.exit(0); });

module.exports = pool;
