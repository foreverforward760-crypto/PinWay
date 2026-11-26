const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");
const { body, query: queryValidator, validationResult } = require("express-validator");
const { query, pool } = require("../config/database");
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
    let client;
    let transactionOpen = false;
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { pin, mccCode, countryCode, merchantName, merchantCity } = req.body;
      const amount = Number(req.body.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ error: "Amount must be a positive finite number" });
      }

      // Hash comparison happens before taking a row lock to reduce lock duration.
      const { rows: activePins } = await query(
        `SELECT p.id, p.pin_hash
         FROM pins p
         WHERE p.user_id = $1
           AND p.status = 'active'
           AND p.expires_at > NOW()
           AND p.uses_left > 0`,
        [req.user.id]
      );

      let candidate = null;
      for (const row of activePins) {
        if (await verifyPin(pin, row.pin_hash)) {
          candidate = row;
          break;
        }
      }

      if (!candidate) {
        logger.warn(`Failed PIN authorization attempt for user ${req.user.id}`);
        return res.status(401).json({ approved: false, reason: "Invalid PIN" });
      }

      client = await pool.connect();
      await client.query("BEGIN");
      transactionOpen = true;

      // Serialize all authorizations for the same PIN. Re-read and verify the
      // hash under the lock so a concurrent rotate/freeze/revoke is respected.
      const { rows: lockedRows } = await client.query(
        `SELECT p.*
         FROM pins p
         WHERE p.id = $1
           AND p.user_id = $2
           AND p.status = 'active'
           AND p.expires_at > NOW()
           AND p.uses_left > 0
         FOR UPDATE`,
        [candidate.id, req.user.id]
      );

      if (!lockedRows.length) {
        await client.query("ROLLBACK");
        transactionOpen = false;
        return res.status(409).json({
          approved: false,
          reason: "PIN is no longer active, has expired, or has no uses remaining",
        });
      }

      const matchedPin = lockedRows[0];
      if (
        matchedPin.pin_hash !== candidate.pin_hash ||
        !(await verifyPin(pin, matchedPin.pin_hash))
      ) {
        await client.query("ROLLBACK");
        transactionOpen = false;
        return res.status(401).json({ approved: false, reason: "Invalid or rotated PIN" });
      }

      // Use UTC midnight consistently with the database's NOW() timestamps.
      const midnight = new Date();
      midnight.setUTCHours(0, 0, 0, 0);
      const { rows: spendRows } = await client.query(
        `SELECT COALESCE(SUM(amount), 0) AS daily_spent
         FROM transactions
         WHERE pin_id = $1 AND type = 'approved' AND created_at >= $2`,
        [matchedPin.id, midnight]
      );
      const dailySpent = Number(spendRows[0].daily_spent || 0);

      let result = evaluateTransaction({
        mccCode,
        countryCode,
        amount,
        perTxLimit: Number(matchedPin.per_tx_limit),
        dailyLimit: Number(matchedPin.daily_limit),
        dailySpent,
        allowedCategories: JSON.parse(matchedPin.categories),
        geoRestriction: matchedPin.geo_restriction,
        remainingBalance: Number(matchedPin.remaining_amount),
        usesLeft: Number(matchedPin.uses_left),
      });

      let remainingBalance = Number(matchedPin.remaining_amount);
      if (result.approved) {
        // Atomic conditional debit. The row lock serializes PIN spending, and
        // the WHERE clause is a second guard against overspend or exhausted uses.
        const update = await client.query(
          `UPDATE pins
           SET remaining_amount = remaining_amount - $1,
               uses_left = uses_left - 1
           WHERE id = $2
             AND status = 'active'
             AND expires_at > NOW()
             AND uses_left > 0
             AND remaining_amount >= $1
           RETURNING remaining_amount`,
          [amount, matchedPin.id]
        );

        if (!update.rows.length) {
          result = {
            approved: false,
            reason: "PIN balance or use count changed during authorization",
          };
        } else {
          remainingBalance = Number(update.rows[0].remaining_amount);
        }
      }

      const txId = uuidv4();
      await client.query(
        `INSERT INTO transactions
           (id, pin_id, type, amount, merchant_name, merchant_city, mcc_code, country_code, reason, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
        [
          txId,
          matchedPin.id,
          result.approved ? "approved" : "declined",
          amount,
          merchantName,
          merchantCity || null,
          mccCode,
          countryCode,
          result.reason || null,
        ]
      );

      await client.query("COMMIT");
      transactionOpen = false;

      logger.info(
        `Transaction ${result.approved ? "APPROVED" : "DECLINED"}: $${amount} at ${merchantName} (${mccCode})`
      );

      return res.json({
        transactionId: txId,
        approved: result.approved,
        reason: result.reason,
        remainingBalance,
      });
    } catch (err) {
      if (client && transactionOpen) {
        try {
          await client.query("ROLLBACK");
        } catch (rollbackErr) {
          logger.error("Transaction rollback failed", { error: rollbackErr.message });
        }
      }
      return next(err);
    } finally {
      if (client) client.release();
    }
  }
);

module.exports = router;
