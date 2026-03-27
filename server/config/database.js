const { Pool } = require("pg");
const logger = require("./logger");

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432"),
  database: process.env.DB_NAME || "pinway",
  user: process.env.DB_USER || "pinway_user",
  password: process.env.DB_PASSWORD,
  max: 20,                   // max pool connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: true }
    : false,
});

pool.on("error", (err) => {
  logger.error("Unexpected PostgreSQL pool error:", err);
});

/**
 * Run a parameterised query against the pool.
 * @param {string} text  SQL query string
 * @param {any[]}  params Query parameters
 */
async function query(text, params) {
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;
  if (duration > 500) {
    logger.warn(`Slow query (${duration}ms): ${text}`);
  }
  return result;
}

/** Test the database connection on startup. */
async function testConnection() {
  try {
    const res = await pool.query("SELECT NOW()");
    logger.info(`PostgreSQL connected — server time: ${res.rows[0].now}`);
  } catch (err) {
    logger.error("PostgreSQL connection failed:", err.message);
    throw err;
  }
}

module.exports = { query, pool, testConnection };
