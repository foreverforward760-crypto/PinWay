const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");
const { body, param, validationResult } = require("express-validator");
const { query } = require("../config/database");
const { requireAuth } = require("../middleware/auth");

router.use(requireAuth);

// ─── GET /api/contacts ────────────────────────────────────────────────────────
router.get("/", async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT c.*,
              COUNT(p.id) AS pin_count,
              COALESCE(SUM(p.amount), 0) AS total_sent
       FROM contacts c
       LEFT JOIN pins p ON p.contact_id = c.id
       WHERE c.user_id = $1
       GROUP BY c.id
       ORDER BY c.name ASC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/contacts ───────────────────────────────────────────────────────
router.post(
  "/",
  [
    body("name").trim().isLength({ min: 2, max: 100 }),
    body("relation").optional().trim().isLength({ max: 50 }),
    body("phone").optional().isMobilePhone().withMessage("Invalid phone number"),
    body("email").optional().isEmail().normalizeEmail(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { name, relation, phone, email } = req.body;

      if (!phone && !email) {
        return res.status(400).json({ error: "At least a phone number or email is required" });
      }

      const id = uuidv4();
      const { rows } = await query(
        `INSERT INTO contacts (id, user_id, name, relation, phone, email, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         RETURNING *`,
        [id, req.user.id, name, relation || null, phone || null, email || null]
      );

      res.status(201).json(rows[0]);
    } catch (err) {
      next(err);
    }
  }
);

// ─── PUT /api/contacts/:id ────────────────────────────────────────────────────
router.put(
  "/:id",
  [
    param("id").isUUID(),
    body("name").optional().trim().isLength({ min: 2, max: 100 }),
    body("relation").optional().trim(),
    body("phone").optional().isMobilePhone(),
    body("email").optional().isEmail().normalizeEmail(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { rows: existing } = await query(
        "SELECT id FROM contacts WHERE id = $1 AND user_id = $2",
        [req.params.id, req.user.id]
      );
      if (!existing.length) return res.status(404).json({ error: "Contact not found" });

      const { name, relation, phone, email } = req.body;
      const { rows } = await query(
        `UPDATE contacts
         SET name = COALESCE($1, name),
             relation = COALESCE($2, relation),
             phone = COALESCE($3, phone),
             email = COALESCE($4, email)
         WHERE id = $5
         RETURNING *`,
        [name || null, relation || null, phone || null, email || null, req.params.id]
      );

      res.json(rows[0]);
    } catch (err) {
      next(err);
    }
  }
);

// ─── DELETE /api/contacts/:id ─────────────────────────────────────────────────
router.delete("/:id", param("id").isUUID(), async (req, res, next) => {
  try {
    const { rows } = await query(
      "DELETE FROM contacts WHERE id = $1 AND user_id = $2 RETURNING id",
      [req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Contact not found" });
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
