const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const { body, validationResult } = require("express-validator");
const { query } = require("../config/database");
const { requireAuth } = require("../middleware/auth");
const logger = require("../config/logger");

const SALT_ROUNDS = 12;

/** Generate a signed JWT for a user */
function signToken(userId) {
  return jwt.sign(
    { sub: userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}

// ─── POST /api/auth/register ──────────────────────────────────────────────────
router.post(
  "/register",
  [
    body("email").isEmail().normalizeEmail().withMessage("Valid email required"),
    body("password")
      .isLength({ min: 8 })
      .matches(/[A-Z]/).withMessage("Password needs uppercase")
      .matches(/[0-9]/).withMessage("Password needs a number")
      .withMessage("Password must be at least 8 characters"),
    body("name").trim().isLength({ min: 2 }).withMessage("Name is required"),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password, name } = req.body;

      // Check for existing account
      const existing = await query("SELECT id FROM users WHERE email = $1", [email]);
      if (existing.rows.length) {
        return res.status(409).json({ error: "An account with this email already exists" });
      }

      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      const id = uuidv4();

      await query(
        `INSERT INTO users (id, email, password_hash, name, role, is_active, created_at)
         VALUES ($1, $2, $3, $4, 'user', true, NOW())`,
        [id, email, passwordHash, name]
      );

      const token = signToken(id);
      logger.info(`New user registered: ${email}`);

      res.status(201).json({
        token,
        user: { id, email, name, role: "user" },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
router.post(
  "/login",
  [
    body("email").isEmail().normalizeEmail(),
    body("password").notEmpty(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: "Invalid email or password" });
      }

      const { email, password } = req.body;

      const { rows } = await query(
        "SELECT id, email, password_hash, name, role, is_active FROM users WHERE email = $1",
        [email]
      );

      // Constant-time comparison to prevent timing attacks
      const user = rows[0];
      const dummyHash = "$2b$12$invalidhashtopreventtimingattacks12345678901234";
      const valid = await bcrypt.compare(password, user ? user.password_hash : dummyHash);

      if (!user || !valid || !user.is_active) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      // Update last_login
      await query("UPDATE users SET last_login = NOW() WHERE id = $1", [user.id]);

      const token = signToken(user.id);
      logger.info(`User logged in: ${email}`);

      res.json({
        token,
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const { rows } = await query(
      "SELECT id, email, name, role, created_at, last_login FROM users WHERE id = $1",
      [req.user.id]
    );
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/auth/change-password ──────────────────────────────────────────
router.post(
  "/change-password",
  requireAuth,
  [
    body("currentPassword").notEmpty(),
    body("newPassword")
      .isLength({ min: 8 })
      .matches(/[A-Z]/)
      .matches(/[0-9]/),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { currentPassword, newPassword } = req.body;

      const { rows } = await query(
        "SELECT password_hash FROM users WHERE id = $1",
        [req.user.id]
      );

      const valid = await bcrypt.compare(currentPassword, rows[0].password_hash);
      if (!valid) {
        return res.status(401).json({ error: "Current password is incorrect" });
      }

      const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
      await query("UPDATE users SET password_hash = $1 WHERE id = $2", [newHash, req.user.id]);

      res.json({ message: "Password updated successfully" });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
