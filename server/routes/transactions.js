const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");
const { body, query: queryValidator, validationResult } = require("express-validator");
const { query } = require("../config/database");
const { requireAuth } = require("../middleware/auth");
const { verifyPin } = require("../services/pinService");
const { evaluateTransaction } = require("../services/mccService");
const logger = require("../config/logger");

router.use(requireAuth);

// ─── GET /api/transactions ────────────────────────────────────────────────────
// List transactions for the user's PINs (with optional filters)
router.get(
  "/",
  [
    queryValidator("pinId").optional().isUUID(),
    queryValidator("type").optional().isIn(["approved", "declined", "all"]),
    queryValidator("limit").optional().isInt({ min: 1, max: 100 }),
    queryValidator("offset").optional().isInt({ min: 0 }),
  ],
  async (req, res, next) => {
    try {
      const { pinId, type = "all", limit = 50, offset = 0 } = req.query;

      let sql = `
        SELECT t.*, p.description AS pin_description
        FROM transactions t
        JOIN pins p ON p.id = t.pin_id
        WHERE p.user_id = $1
      `;
      const params = [req.user.id];
      let idx = 2;

      if (pinId) {
        sql += ` AND t.pin_id = $${idx++}`;
        params.push(pinId);
      }
      if (type !== "all") {
        sql += ` AND t.type = $${idx++}`;
        params.push(type);
      }

      sql += ` ORDER BY t.created_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
      params.push(parseInt(limit), parseInt(offset));

      const { rows } = await query(sql, params);
      res.json(rows);
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/transactions/authorize ────────────────────────────────────────
// POS terminal endpoint: verify a PIN and authorize a transaction
router.post(
  "/authorize",
  [
    body("pin").isLength({ min: 16, max: 16 }).isNumeric().withMessage("16-digit PIN required"),
    body("mccCode").isLength({ min: 4, max: 4 }).isNumeric(),
    body("countryCode").isLength({ min: 2, max: 2 }).isAlpha().toUpperCase(),
    body("amount").isFloat({ min: 0.01 }),
    body("merchantName").trim().isLength({ min: 1, max: 200 }),
    body("merchantCity").optional().trim(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { pin, mccCode, countryCode, amount, merchantName, merchantCity } = req.body;

      // Find matching active PIN (must look up all active pins — we compare hashes)
      // For scale, you'd add a PIN index or use a different lookup strategy
      const { rows: activePins } = await query(
        `SELECT p.* FROM pins p
         WHERE p.user_id = $1
           AND p.status = 'active'
           AND p.expires_at > NOW()
           AND p.uses_left > 0`,
        [req.user.id]
      );

      let matchedPin = null;
      for (const candidate of activePins) {
        if (await verifyPin(pin, candidate.pin_hash)) {
          matchedPin = candidate;
          break;
        }
      }

      if (!matchedPin) {
        // Log failed attempt for fraud monitoring
        logger.warn(`Failed PIN authorization attempt for user ${req.user.id}`);
        return res.status(401).json({ approved: false, reason: "Invalid PIN" });
      }

      // Get today's spend for this PIN
      const midnight = new Date();
      midnight.setHours(0, 0, 0, 0);
      const { rows: spendRows } = await query(
        `SELECT COALESCE(SUM(amount), 0) AS daily_spent
         FROM transactions
         WHERE pin_id = $1 AND type = 'approved' AND created_at >= $2`,
        [matchedPin.id, midnight]
      );
      const dailySpent = parseFloat(spendRows[0].daily_spent);

      // Evaluate the transaction against all rules
      const result = evaluateTransaction({
        mccCode,
        countryCode,
        amount,
        perTxLimit: parseFloat(matchedPin.per_tx_limit),
        dailyLimit: parseFloat(matchedPin.daily_limit),
        dailySpent,
        allowedCategories: JSON.parse(matchedPin.categories),
        geoRestriction: matchedPin.geo_restriction,
        remainingBalance: parseFloat(matchedPin.remaining_amount),
        usesLeft: matchedPin.uses_left,
      });

      const txId = uuidv4();

      if (result.approved) {
        // Deduct balance and use count
        await query(
          `UPDATE pins
           SET remaining_amount = remaining_amount - $1,
               uses_left = uses_left - 1
           WHERE id = $2`,
          [amount, matchedPin.id]
        );
      }

      // Record transaction
      await query(
        `INSERT INTO transactions
           (id, pin_id, type, amount, merchant_name, merchant_city, mcc_code, country_code, reason, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
        [
          txId, matchedPin.id,
          result.approved ? "approved" : "declined",
          amount, merchantName, merchantCity || null,
          mccCode, countryCode,
          result.reason || null,
        ]
      );

      logger.info(`Transaction ${result.approved ? "APPROVED" : "DECLINED"}: $${amount} at ${merchantName} (${mccCode})`);

      res.json({
        transactionId: txId,
        approved: result.approved,
        reason: result.reason,
        remainingBalance: result.approved
          ? parseFloat(matchedPin.remaining_amount) - amount
          : parseFloat(matchedPin.remaining_amount),
      });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
