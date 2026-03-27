/**
 * validateEnv.js
 * Runs at startup. Prevents the server from launching with insecure or
 * missing configuration. Call this before anything else in index.js.
 */

const REQUIRED = [
  "JWT_SECRET",
  "DB_PASSWORD",
  "DB_HOST",
  "DB_NAME",
  "DB_USER",
];

// Weak/default values that must never reach production
const FORBIDDEN_VALUES = new Set([
  "changeme",
  "secret",
  "password",
  "admin",
  "admin123",
  "your_secret",
  "replace_me",
  "example",
  "dev",
  "test",
  "12345",
  "supersecret",
]);

function validateEnv() {
  const errors = [];
  const warnings = [];

  // 1. Check required variables are present
  for (const key of REQUIRED) {
    if (!process.env[key] || process.env[key].trim() === "") {
      errors.push(`Missing required environment variable: ${key}`);
    }
  }

  // 2. JWT_SECRET must be at least 32 characters
  const jwtSecret = process.env.JWT_SECRET || "";
  if (jwtSecret.length < 32) {
    errors.push(
      `JWT_SECRET is too short (${jwtSecret.length} chars). Must be at least 32 characters.`
    );
  }

  // 3. Reject obviously weak/default secrets in production
  if (process.env.NODE_ENV === "production") {
    if (FORBIDDEN_VALUES.has(jwtSecret.toLowerCase())) {
      errors.push("JWT_SECRET is set to a known-weak default value. Change it immediately.");
    }
    if (FORBIDDEN_VALUES.has((process.env.DB_PASSWORD || "").toLowerCase())) {
      errors.push("DB_PASSWORD is set to a known-weak default value.");
    }

    // 4. Enforce HTTPS frontend URL in production
    const frontendUrl = process.env.FRONTEND_URL || "";
    if (frontendUrl && !frontendUrl.startsWith("https://")) {
      warnings.push(
        `FRONTEND_URL is not HTTPS: "${frontendUrl}". HTTPS is required for PCI compliance.`
      );
    }
  }

  // Report findings
  if (warnings.length) {
    warnings.forEach((w) => console.warn(`[CONFIG WARNING] ${w}`));
  }

  if (errors.length) {
    console.error("\n❌  STARTUP BLOCKED — Environment configuration errors:\n");
    errors.forEach((e) => console.error(`   • ${e}`));
    console.error(
      "\nFix the above issues in your .env file before starting PinWay.\n"
    );
    process.exit(1);
  }

  console.log("✅  Environment validated successfully.");
}

module.exports = validateEnv;
