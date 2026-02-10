const express = require("express");
const router = express.Router();
const pool = require("../db");
const { refreshTrends } = require("../jobs/trendsRefreshJob");

// GET /trends/today?userId=1
router.get("/today", async (req, res) => {
  try {
    const userId = req.query.userId ? String(req.query.userId) : null;
    const today = new Date().toISOString().slice(0, 10);

    // If we have no snapshot today, auto-refresh once
    const check = await pool.query(
      "SELECT COUNT(*)::int AS c FROM trending_daily_rank WHERE trend_date = $1",
      [today]
    );
    if ((check.rows[0]?.c || 0) === 0) {
      try {
        await refreshTrends({ limit: 30 });
      } catch (e) {
        console.log("TREND AUTO-REFRESH FAILED:", e.message);
      }
    }

    // If userId provided, exclude items seen today
    const query = userId
      ? `
        SELECT t.rank, t.score,
               e.id AS item_id, e.source, e.title, e.category, e.tags, e.eco_badges,
               e.price_value, e.price_currency, e.image_url, e.product_url
        FROM trending_daily_rank t
        JOIN external_trending_items e ON e.id = t.item_id
        WHERE t.trend_date = $1
          AND NOT EXISTS (
            SELECT 1 FROM user_trend_impressions i
            WHERE i.user_id = $2 AND i.item_id = e.id AND i.seen_date = $1::date
          )
        ORDER BY t.rank ASC
        LIMIT 30
      `
      : `
        SELECT t.rank, t.score,
               e.id AS item_id, e.source, e.title, e.category, e.tags, e.eco_badges,
               e.price_value, e.price_currency, e.image_url, e.product_url
        FROM trending_daily_rank t
        JOIN external_trending_items e ON e.id = t.item_id
        WHERE t.trend_date = $1
        ORDER BY t.rank ASC
        LIMIT 30
      `;

    const params = userId ? [today, userId] : [today];
    const result = await pool.query(query, params);

    res.json({
      date: today,
      count: result.rows.length,
      items: result.rows,
      note:
        "Trend picks are refreshed daily. eBay is live via API keys; Vinted/Depop require partner/affiliate feed to be truly live.",
    });
  } catch (err) {
    console.error("TRENDS TODAY ERROR:", err);
    res.status(500).json({ error: "Failed to load today trends" });
  }
});

// POST /trends/refresh  (manual refresh)
router.post("/refresh", async (req, res) => {
  try {
    const out = await refreshTrends({ limit: 30 });
    res.json(out);
  } catch (err) {
    console.error("TRENDS REFRESH ERROR:", err);
    res.status(500).json({ error: err.message || "Refresh failed" });
  }
});

// POST /trends/seen  { userId, itemId }
router.post("/seen", async (req, res) => {
  try {
    const { userId, itemId } = req.body;
    if (!userId || !itemId) return res.status(400).json({ error: "Missing userId/itemId" });

    await pool.query(
      `INSERT INTO user_trend_impressions (user_id, item_id, seen_date)
       VALUES ($1,$2,CURRENT_DATE)
       ON CONFLICT (user_id, item_id, seen_date) DO NOTHING`,
      [userId, itemId]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error("TRENDS SEEN ERROR:", err);
    res.status(500).json({ error: "Failed to mark seen" });
  }
});

module.exports = router;
