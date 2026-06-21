/**
 * validateEnv.js
 * Runs at startup. Blocks launch if config is missing or insecure.
 *
 * Supports Railway deployments:
 *   - DATABASE_URL is accepted in place of individual DB_* variables
 *   - NODE_ENV, PORT, and FRONTEND_URL are auto-set by Railway
 */

const FORBIDDEN_VALUES = new Set([
  "changeme", "secret", "password", "admin", "admin123",
  "your_secret", "replace_me", "example", "dev", "test",
  "12345", "supersecret", "replace_with_long_random_secret_at_least_64_chars",
]);

function validateEnv() {
  const errors = [];
  const warnings = [];
  const isProduction = process.env.NODE_ENV === "production";

  // ── JWT_SECRET ────────────────────────────────────────────────────────────
  const jwtSecret = process.env.JWT_SECRET || "";
  if (!jwtSecret) {
    errors.push("Missing required environment variable: JWT_SECRET");
  } else if (jwtSecret.length < 32) {
    errors.push(`JWT_SECRET is too short (${jwtSecret.length} chars). Must be at least 32 characters.`);
  } else if (isProduction && FORBIDDEN_VALUES.has(jwtSecret.toLowerCase())) {
    errors.push("JWT_SECRET is set to a known-weak default value. Change it.");
  }

  // ── Database: accept DATABASE_URL (Railway) OR individual DB_* vars ───────
  const hasConnectionString = !!process.env.DATABASE_URL;
  const hasIndividualVars = process.env.DB_HOST && process.env.DB_NAME &&
                            process.env.DB_USER && process.env.DB_PASSWORD;

  if (!hasConnectionString && !hasIndividualVars) {
    errors.push(
      "Database not configured. Set DATABASE_URL (Railway) " +
      "or all of: DB_HOST, DB_NAME, DB_USER, DB_PASSWORD"
    );
  }

  if (!hasConnectionString && process.env.DB_PASSWORD) {
    if (isProduction && FORBIDDEN_VALUES.has((process.env.DB_PASSWORD || "").toLowerCase())) {
      errors.push("DB_PASSWORD is set to a known-weak default value.");
    }
  }

  // ── Demo mode notice ──────────────────────────────────────────────────────
  if (process.env.DEMO_MODE === "true") {
    if (isProduction && process.env.STRIPE_SECRET_KEY) {
      errors.push("DEMO_MODE=true cannot be combined with a live Stripe key in production.");
    }
    warnings.push("DEMO_MODE=true — virtual cards are synthetic. Not for production use.");
  }

  // ── Production-only checks ─────────────────────────────────────────────────
  if (isProduction) {
    const frontendUrl = process.env.FRONTEND_URL || "";
    if (frontendUrl && !frontendUrl.startsWith("https://")) {
      warnings.push(`FRONTEND_URL is not HTTPS: "${frontendUrl}". Required for PCI compliance.`);
    }
  }

  // ── Report ────────────────────────────────────────────────────────────────
  if (warnings.length) {
    warnings.forEach((w) => console.warn(`[CONFIG WARNING] ${w}`));
  }

  if (errors.length) {
    console.error("\n❌  STARTUP BLOCKED — Environment configuration errors:\n");
    errors.forEach((e) => console.error(`   • ${e}`));
    console.error("\nFix the above issues before starting PinWay.\n");
    process.exit(1);
  }

  console.log(`✅  Environment validated [${process.env.NODE_ENV || "development"}${process.env.DEMO_MODE === "true" ? " / DEMO" : ""}]`);
}

module.exports = validateEnv;
