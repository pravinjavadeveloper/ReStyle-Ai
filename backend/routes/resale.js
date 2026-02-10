// backend/routes/resale.js
const express = require("express");
const router = express.Router();
const pool = require("../db");

/**
 * Demand weights (simple but real working logic)
 * You can tweak these anytime.
 */
const CATEGORY_WEIGHT = {
  jacket: 30,
  coat: 30,
  hoodie: 18,
  jeans: 25,
  trouser: 18,
  pants: 18,
  dress: 20,
  shoes: 20,
  sneaker: 20,
  skirt: 16,
  shirt: 10,
  "t-shirt": 10,
  tshirt: 10,
};

const COLOR_WEIGHT = {
  black: 20,
  white: 14,
  beige: 12,
  cream: 12,
  grey: 10,
  gray: 10,
  navy: 10,
  blue: 8,
  brown: 8,
};

const normalize = (s) => String(s || "").trim().toLowerCase();

/**
 * GET /resale/demand/:userId
 * Returns top demand items from user's closet that are NOT already listed for sale.
 */
router.get("/demand/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    // Pull user's items (exclude already for sale)
    const result = await pool.query(
      `
      SELECT id, user_id, image_url, category, color, created_at, for_sale
      FROM closet_items
      WHERE user_id = $1
        AND (for_sale = false OR for_sale IS NULL)
      ORDER BY created_at DESC
      `,
      [userId]
    );

    const items = result.rows || [];

    // Calculate demand score for each item
    const scored = items.map((it) => {
      const cat = normalize(it.category);
      const col = normalize(it.color);

      const base = 50; // baseline
      const catW = CATEGORY_WEIGHT[cat] || 8;
      const colW = COLOR_WEIGHT[col] || 4;

      // Freshness boost (newer items slight bonus)
      const created = it.created_at ? new Date(it.created_at).getTime() : Date.now();
      const daysOld = Math.max(0, Math.floor((Date.now() - created) / (1000 * 60 * 60 * 24)));

      // 0 to +10 boost if recent (0 days => +10, 30+ days => 0)
      const freshnessBoost = Math.max(0, 10 - Math.floor(daysOld / 3));

      let score = base + catW + colW + freshnessBoost;

      // clamp
      score = Math.max(0, Math.min(100, Math.round(score)));

      // message logic
      const message =
        score >= 85
          ? "Very high demand — resell now for fastest results."
          : score >= 70
          ? "High demand — good time to list it."
          : "Decent demand — list when you're ready.";

      return {
        ...it,
        demandScore: score,
        demandMessage: message,
      };
    });

    // Sort by demandScore desc
    scored.sort((a, b) => (b.demandScore || 0) - (a.demandScore || 0));

    // Take top 3
    const topItems = scored.slice(0, 3);

    res.json({
      userId,
      topItems,
      note:
        topItems.length === 0
          ? "No eligible items found (maybe all are already listed)."
          : "These are your highest resale-demand items right now.",
    });
  } catch (err) {
    console.error("RESALE DEMAND ERROR:", err);
    res.status(500).json({ error: "Resale demand failed" });
  }
});

module.exports = router;
