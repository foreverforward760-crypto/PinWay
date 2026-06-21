/**
 * database.js
 * PostgreSQL connection pool.
 *
 * Supports both Railway-style DATABASE_URL and individual DB_* variables.
 * Railway automatically injects DATABASE_URL when you add a Postgres plugin —
 * no manual config needed for Railway deployments.
 */

const { Pool } = require("pg");
const logger = require("./logger");

// Build connection config: prefer DATABASE_URL (Railway), fall back to DB_* vars
function buildConnectionConfig() {
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.PGSSL === "false"
        ? false
        : { rejectUnauthorized: process.env.NODE_ENV === "production" },
    };
  }
  // Individual vars (local dev)
  return {
    host:     process.env.DB_HOST     || "localhost",
    port:     parseInt(process.env.DB_PORT || "5432"),
    database: process.env.DB_NAME     || "pinway",
    user:     process.env.DB_USER     || "pinway_user",
    password: process.env.DB_PASSWORD,
    ssl:      false,
  };
}

const pool = new Pool({
  ...buildConnectionConfig(),
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on("error", (err) => {
  logger.error("Unexpected PG pool error", { error: err.message });
});

async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (duration > 1000) {
    logger.warn("Slow query detected", { duration, query: text.slice(0, 100) });
  }
  return res;
}

async function testConnection() {
  const client = await pool.connect();
  try {
    await client.query("SELECT 1");
    logger.info("Database connection established");
  } finally {
    client.release();
  }
}

module.exports = { pool, query, testConnection };
