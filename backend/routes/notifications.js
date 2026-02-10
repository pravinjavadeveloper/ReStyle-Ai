// backend/routes/notifications.js
const express = require("express");
const router = express.Router();
const pool = require("../db");

/**
 * ✅ Save/Update Expo push token for a user
 * POST /notifications/register-token
 * body: { userId, token }
 */
router.post("/register-token", async (req, res) => {
  try {
    const { userId, token } = req.body;

    if (!userId) return res.status(400).json({ error: "Missing userId" });
    if (!token) return res.status(400).json({ error: "Missing token" });

    await pool.query(
      `UPDATE users SET expo_push_token = $1 WHERE id = $2`,
      [token, userId]
    );

    res.json({ message: "Token saved" });
  } catch (e) {
    console.error("REGISTER TOKEN ERROR:", e);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * ✅ Get my notifications (inbox)
 * GET /notifications/:userId
 */
router.get("/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const rows = await pool.query(
      `SELECT id, title, body, type, data, is_read, created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [userId]
    );

    res.json({ items: rows.rows });
  } catch (e) {
    console.error("GET NOTIFICATIONS ERROR:", e);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * ✅ Mark one notification read
 * PUT /notifications/read/:id
 */
router.put("/read/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const updated = await pool.query(
      `UPDATE notifications SET is_read = true WHERE id = $1 RETURNING *`,
      [id]
    );

    if (!updated.rows.length) return res.status(404).json({ error: "Not found" });
    res.json({ message: "Marked read", item: updated.rows[0] });
  } catch (e) {
    console.error("READ NOTIFICATION ERROR:", e);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * ✅ Mark ALL read for a user
 * PUT /notifications/read-all/:userId
 */
router.put("/read-all/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    await pool.query(
      `UPDATE notifications SET is_read = true WHERE user_id = $1`,
      [userId]
    );

    res.json({ message: "All marked read" });
  } catch (e) {
    console.error("READ ALL ERROR:", e);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
