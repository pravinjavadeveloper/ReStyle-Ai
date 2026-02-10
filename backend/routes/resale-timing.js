const express = require("express");
const router = express.Router();
const pool = require("../db");

// GET /resale-timing/:userId
// Returns: best items to list now/soon + reasons
router.get("/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    // 1) get user's items that are NOT for sale (suggest them to list)
    const itemsRes = await pool.query(
      `
      SELECT id, user_id, category, color, image_url, created_at, for_sale
      FROM closet_items
      WHERE user_id = $1
      ORDER BY created_at DESC
      `,
      [userId]
    );

    const items = itemsRes.rows || [];
    const candidates = items.filter((it) => !it.for_sale);

    // If no candidates, return empty but success
    if (candidates.length === 0) {
      return res.json({
        userId,
        nowMonth: new Date().getMonth() + 1,
        recommendations: [],
        message: "No items available for timing suggestions (everything may already be listed).",
      });
    }

    // 2) load seasonality rules
    const rulesRes = await pool.query(
      `SELECT category_name, peak_start_month, peak_end_month, notes FROM category_seasonality_rules`
    );
    const rules = rulesRes.rows || [];

    // helper: normalize category
    const norm = (s) => String(s || "").trim().toLowerCase();

    // map rules by category_name
    const rulesMap = new Map();
    for (const r of rules) rulesMap.set(norm(r.category_name), r);

    // 3) demand signal (simple real signal using your own marketplace history):
    // category sales count from orders in last 60 days (across ALL users)
    // This uses your existing orders table + closet_items join.
    const sales60Res = await pool.query(
      `
      SELECT c.category, COUNT(*)::int AS sold_count_60d
      FROM orders o
      JOIN closet_items c ON c.id = o.item_id
      WHERE o.created_at >= NOW() - INTERVAL '60 days'
      GROUP BY c.category
      `
    );

    const sold60Map = new Map();
    for (const row of sales60Res.rows || []) {
      sold60Map.set(norm(row.category), Number(row.sold_count_60d || 0));
    }

    // 4) user duplicates (if user owns many of same category → suggest selling extras)
    const userCounts = {};
    for (const it of items) {
      const k = norm(it.category || "unknown");
      userCounts[k] = (userCounts[k] || 0) + 1;
    }

    const now = new Date();
    const nowMonth = now.getMonth() + 1;

    // helper: is month inside a possibly-wrapping range
    // e.g. Oct(10) to Feb(2) wraps year end.
    const isInRange = (m, start, end) => {
      if (start <= end) return m >= start && m <= end;
      // wrap: start..12 OR 1..end
      return m >= start || m <= end;
    };

    // helper: distance in months to peak start (0..11)
    const monthsUntil = (m, target) => {
      let d = target - m;
      if (d < 0) d += 12;
      return d;
    };

    // 5) build recommendations
    const recommendations = candidates.map((it) => {
      const catKey = norm(it.category || "unknown");
      const rule = rulesMap.get(catKey);

      // default if not found in rules: year-round stable
      const peakStart = rule?.peak_start_month || 1;
      const peakEnd = rule?.peak_end_month || 12;

      const inPeak = isInRange(nowMonth, peakStart, peakEnd);
      const untilPeakStart = monthsUntil(nowMonth, peakStart);

      // timing label
      let timing = "WAIT";
      let bestWindow = "Later";
      if (inPeak) {
        timing = "SELL_NOW";
        bestWindow = "Next 14 days";
      } else if (untilPeakStart <= 2) {
        timing = "SELL_SOON";
        bestWindow = "Next 30–60 days";
      }

      const sold60 = sold60Map.get(catKey) || 0;
      const dupCount = userCounts[catKey] || 0;

      // Score (0..100) - stable and explainable
      // seasonality gives strong boost, sales velocity adds boost, duplicates add small boost
      const seasonBoost = timing === "SELL_NOW" ? 45 : timing === "SELL_SOON" ? 25 : 5;
      const demandBoost = Math.min(35, sold60 * 3); // more recent sales = higher demand
      const duplicateBoost = dupCount >= 5 ? 15 : dupCount >= 3 ? 8 : 0;

      const score = Math.min(100, seasonBoost + demandBoost + duplicateBoost);

      // Reason text (short, human)
      const reasons = [];
      if (timing === "SELL_NOW") reasons.push("Seasonal demand is high right now");
      if (timing === "SELL_SOON") reasons.push("Peak demand is coming soon");
      if (sold60 >= 3) reasons.push("This category is selling fast in our marketplace");
      if (dupCount >= 3) reasons.push("You have multiple items in this category");

      if (reasons.length === 0) reasons.push("Stable demand — list anytime");

      return {
        itemId: it.id,
        category: it.category,
        color: it.color,
        image_url: it.image_url,
        timing,
        bestWindow,
        score,
        confidence: Number((score / 100).toFixed(2)),
        reason: reasons.join(" • "),
      };
    });

    // sort best first
    recommendations.sort((a, b) => b.score - a.score);

    res.json({
      userId,
      nowMonth,
      recommendations,
    });
  } catch (err) {
    console.error("RESALE TIMING ERROR:", err);
    res.status(500).json({ error: "Resale timing failed" });
  }
});

module.exports = router;
