const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");
const { body, param, validationResult } = require("express-validator");
const { query } = require("../config/database");
const { requireAuth } = require("../middleware/auth");
const { generateSecurePin, hashPin, calculateHealthScore } = require("../services/pinService");
const { sendPinBySms, sendPinByEmail } = require("../services/notificationService");
const logger = require("../config/logger");

// All PIN routes require authentication
router.use(requireAuth);

// ─── GET /api/pins ────────────────────────────────────────────────────────────
// List all PINs for the authenticated user
router.get("/", async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT p.*,
              c.name AS contact_name,
              c.phone AS contact_phone,
              c.email AS contact_email,
              (SELECT COUNT(*) FROM transactions t WHERE t.pin_id = p.id AND t.type = 'declined') AS decline_count
       FROM pins p
       LEFT JOIN contacts c ON c.id = p.contact_id
       WHERE p.user_id = $1
       ORDER BY p.created_at DESC`,
      [req.user.id]
    );

    // Add health score to each PIN (do NOT expose raw PIN hash)
    const pins = rows.map(({ pin_hash, ...pin }) => ({
      ...pin,
      health_score: calculateHealthScore(pin),
    }));

    res.json(pins);
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/pins/:id ────────────────────────────────────────────────────────
router.get("/:id", param("id").isUUID(), async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT p.*,
              c.name AS contact_name,
              (SELECT COUNT(*) FROM transactions t WHERE t.pin_id = p.id AND t.type = 'declined') AS decline_count
       FROM pins p
       LEFT JOIN contacts c ON c.id = p.contact_id
       WHERE p.id = $1 AND p.user_id = $2`,
      [req.params.id, req.user.id]
    );

    if (!rows.length) return res.status(404).json({ error: "PIN not found" });

    const { pin_hash, ...pin } = rows[0];
    res.json({ ...pin, health_score: calculateHealthScore(pin) });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/pins ───────────────────────────────────────────────────────────
// Create a new PIN disbursement
router.post(
  "/",
  [
    body("amount").isFloat({ min: 1, max: 10000 }).withMessage("Amount must be between $1 and $10,000"),
    body("description").trim().isLength({ min: 1, max: 200 }),
    body("categories").isArray({ min: 1 }).withMessage("Select at least one category"),
    body("geo").isIn(["us", "latam", "eu", "any"]),
    body("maxUses").isInt({ min: 1, max: 100 }),
    body("expirationHours").isInt({ min: 1, max: 720 }),
    body("perTxLimit").isFloat({ min: 1 }),
    body("dailyLimit").isFloat({ min: 1 }),
    body("contactId").optional().isUUID(),
    body("deliveryMethod").optional().isIn(["sms", "email", "none"]),
    body("autoReload").optional().isBoolean(),
    body("rotate").optional().isBoolean(),
    body("rotateHours").optional().isInt({ min: 1, max: 168 }),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const {
        amount, description, categories, geo, maxUses,
        expirationHours, perTxLimit, dailyLimit, contactId,
        deliveryMethod = "none", autoReload = false,
        rotate = false, rotateHours = 6,
      } = req.body;

      // Validate contactId belongs to this user
      if (contactId) {
        const { rows: cr } = await query(
          "SELECT id FROM contacts WHERE id = $1 AND user_id = $2",
          [contactId, req.user.id]
        );
        if (!cr.length) return res.status(400).json({ error: "Contact not found" });
      }

      // Generate secure PIN
      const rawPin = generateSecurePin();
      const pinHash = await hashPin(rawPin);
      const id = uuidv4();
      const expiresAt = new Date(Date.now() + expirationHours * 3600 * 1000);

      await query(
        `INSERT INTO pins (
           id, user_id, contact_id, pin_hash, amount, remaining_amount,
           description, categories, geo_restriction, max_uses, uses_left,
           per_tx_limit, daily_limit, expires_at, status,
           auto_reload, rotate_enabled, rotate_hours, created_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'active',$15,$16,$17,NOW())`,
        [
          id, req.user.id, contactId || null, pinHash,
          amount, amount, description, JSON.stringify(categories), geo,
          maxUses, maxUses, perTxLimit, dailyLimit, expiresAt,
          autoReload, rotate, rotateHours,
        ]
      );

      logger.info(`PIN created: ${id} for user ${req.user.id}, amount $${amount}`);

      // Deliver PIN to recipient
      if (deliveryMethod !== "none" && contactId) {
        const { rows: cr } = await query(
          "SELECT phone, email, name FROM contacts WHERE id = $1",
          [contactId]
        );
        if (cr.length) {
          const contact = cr[0];
          try {
            if (deliveryMethod === "sms" && contact.phone) {
              await sendPinBySms(contact.phone, rawPin, amount, description);
            } else if (deliveryMethod === "email" && contact.email) {
              await sendPinByEmail(contact.email, contact.name, rawPin, amount, description);
            }
          } catch (notifErr) {
            // Log delivery failure but don't fail the whole request
            logger.error(`PIN delivery failed: ${notifErr.message}`);
          }
        }
      }

      // Return full PIN details once (never stored in plaintext)
      res.status(201).json({
        id,
        pin: rawPin,   // Raw PIN returned ONCE — store securely on client or deliver immediately
        amount,
        remaining_amount: amount,
        description,
        categories,
        geo_restriction: geo,
        max_uses: maxUses,
        uses_left: maxUses,
        per_tx_limit: perTxLimit,
        daily_limit: dailyLimit,
        expires_at: expiresAt,
        status: "active",
        health_score: 100,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── PATCH /api/pins/:id/freeze ───────────────────────────────────────────────
router.patch("/:id/freeze", param("id").isUUID(), async (req, res, next) => {
  try {
    const { rows } = await query(
      "SELECT id, status FROM pins WHERE id = $1 AND user_id = $2",
      [req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: "PIN not found" });

    const current = rows[0].status;
    if (current === "revoked") return res.status(400).json({ error: "Cannot freeze a revoked PIN" });

    const newStatus = current === "frozen" ? "active" : "frozen";
    await query("UPDATE pins SET status = $1 WHERE id = $2", [newStatus, req.params.id]);

    res.json({ id: req.params.id, status: newStatus });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/pins/:id/revoke ───────────────────────────────────────────────
router.patch("/:id/revoke", param("id").isUUID(), async (req, res, next) => {
  try {
    const { rows } = await query(
      "SELECT id FROM pins WHERE id = $1 AND user_id = $2 AND status != 'revoked'",
      [req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: "PIN not found or already revoked" });

    await query(
      "UPDATE pins SET status = 'revoked', revoked_at = NOW() WHERE id = $1",
      [req.params.id]
    );

    res.json({ id: req.params.id, status: "revoked" });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/pins/:id/rotate ────────────────────────────────────────────────
// Issue a new PIN number (rotate), invalidating the old one
router.post("/:id/rotate", param("id").isUUID(), async (req, res, next) => {
  try {
    const { rows } = await query(
      "SELECT id, status FROM pins WHERE id = $1 AND user_id = $2",
      [req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: "PIN not found" });
    if (rows[0].status !== "active") {
      return res.status(400).json({ error: "Can only rotate active PINs" });
    }

    const rawPin = generateSecurePin();
    const pinHash = await hashPin(rawPin);

    await query(
      "UPDATE pins SET pin_hash = $1, last_rotated_at = NOW() WHERE id = $2",
      [pinHash, req.params.id]
    );

    logger.info(`PIN rotated: ${req.params.id}`);
    res.json({ id: req.params.id, pin: rawPin, rotated_at: new Date() });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
