// backend/routes/resale-intelligence.js
const express = require("express");
const router = express.Router();
const pool = require("../db");

/**
 * Helper: clamp number between min/max
 */
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

/**
 * Helper: normalize category/color to avoid " Shirt " vs "Shirt"
 */
const norm = (v) => (v || "Unknown").toString().trim();

/**
 * ✅ Demand score logic (REAL WORKING, uses YOUR DB data)
 *
 * Signals used:
 * 1) Recent sold count in orders (same category/color) => demand
 * 2) Active listings count (same category/color, for_sale = true) => supply
 * 3) Item freshness (newer items slightly better)
 * 4) Color boost for neutral colors (EU/UK common demand)
 *
 * Notes:
 * - We don’t use external platforms. Only your app.
 * - This will work immediately with your existing orders + closet_items tables.
 */

// GET: /resale-intelligence/:userId
// Returns stored signals (and if missing, calculates on the fly once)
router.get("/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    // 1) return existing signals if present
    const existing = await pool.query(
      `SELECT * FROM resale_demand_signals
       WHERE user_id = $1
       ORDER BY demand_score DESC, calculated_at DESC`,
      [userId]
    );

    if (existing.rows.length > 0) {
      return res.json({
        userId,
        count: existing.rows.length,
        signals: existing.rows,
        source: "db",
      });
    }

    // 2) If no rows exist yet, do a one-time calculate (without forcing user)
    const computed = await computeAndStoreSignals(userId);

    return res.json({
      userId,
      count: computed.length,
      signals: computed,
      source: "computed",
    });
  } catch (err) {
    console.error("RESALE INTELLIGENCE GET ERROR:", err);
    res.status(500).json({ error: "Resale intelligence failed" });
  }
});

// POST: /resale-intelligence/recalculate/:userId
// Force recalculation (recommended to call after user adds items / buys / sells)
router.post("/recalculate/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    // Clear old signals for user (safe)
    await pool.query("DELETE FROM resale_demand_signals WHERE user_id = $1", [
      userId,
    ]);

    const computed = await computeAndStoreSignals(userId);

    res.json({
      message: "Recalculated resale demand ✅",
      userId,
      count: computed.length,
      signals: computed,
    });
  } catch (err) {
    console.error("RESALE INTELLIGENCE RECALC ERROR:", err);
    res.status(500).json({ error: "Recalculation failed" });
  }
});

/**
 * Core function: compute + store signals for all items
 */
async function computeAndStoreSignals(userId) {
  // Fetch user closet items
  const itemsRes = await pool.query(
    `SELECT id, user_id, category, color, created_at, for_sale, price
     FROM closet_items
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );

  const items = itemsRes.rows;

  // If no items, return empty
  if (items.length === 0) return [];

  // We compute demand based on marketplace activity in YOUR DB:
  // - SOLD items exist in orders table (item_id references closet_items)
  //
  // We'll use category+color matching on closet_items joined with orders
  //
  // We compute:
  // recentSoldCount = last 30 days sold for same category+color
  // activeListingsCount = current for_sale true for same category+color

  const results = [];

  for (const it of items) {
    const category = norm(it.category);
    const color = norm(it.color);

    // 1) SOLD COUNT (last 30 days)
    const soldRes = await pool.query(
      `
      SELECT COUNT(*)::int AS cnt
      FROM orders o
      JOIN closet_items c ON c.id = o.item_id
      WHERE c.category = $1
        AND c.color = $2
        AND o.created_at >= NOW() - INTERVAL '30 days'
      `,
      [category, color]
    );
    const recentSoldCount = soldRes.rows[0]?.cnt || 0;

    // 2) ACTIVE LISTINGS COUNT (supply)
    const activeRes = await pool.query(
      `
      SELECT COUNT(*)::int AS cnt
      FROM closet_items
      WHERE category = $1
        AND color = $2
        AND for_sale = true
      `,
      [category, color]
    );
    const activeListingsCount = activeRes.rows[0]?.cnt || 0;

    // 3) FRESHNESS (days old)
    const createdAt = it.created_at ? new Date(it.created_at) : new Date();
    const ageDays = Math.floor((Date.now() - createdAt.getTime()) / 86400000);

    // 4) Neutral color boost
    const neutralColors = ["black", "white", "grey", "gray", "beige", "navy", "denim"];
    const isNeutral = neutralColors.includes(color.toLowerCase());

    // ---------------------------
    // SCORE FORMULA (0..100)
    // ---------------------------
    // Demand driver: sold count
    // Supply penalty: active listings
    // Freshness: small boost if newer
    // Neutral: small boost
    //
    // This is deterministic and "real working".
    // Later we can upgrade this with ML without changing the table/API.
    let score = 0;

    // Demand from sold items
    score += recentSoldCount * 18; // each recent sale increases score

    // Supply penalty (too many listings reduces urgency)
    score -= activeListingsCount * 6;

    // Freshness: newer items slightly better (max boost 12)
    const freshnessBoost = clamp(12 - Math.floor(ageDays / 15), 0, 12);
    score += freshnessBoost;

    // Neutral boost
    if (isNeutral) score += 8;

    score = clamp(Math.round(score), 0, 100);

    // Demand level
    let level = "LOW";
    if (score >= 70) level = "HIGH";
    else if (score >= 40) level = "MEDIUM";

    // Price range:
    // - if item already has price (and for_sale), we suggest near it
    // - else use simple category base
    const base = getBasePriceGBP(category);
    const anchor = it.price ? Number(it.price) : base;

    const priceLow = clamp(anchor * 0.85, 3, 9999);
    const priceHigh = clamp(anchor * 1.15, 3, 9999);

    // Message (in-app)
    const message =
      level === "HIGH"
        ? `High resale demand: your ${color} ${category} could sell fast. List it now for £${priceLow.toFixed(
            0
          )}–£${priceHigh.toFixed(0)}.`
        : level === "MEDIUM"
        ? `Good resale potential: consider listing your ${color} ${category} for £${priceLow.toFixed(
            0
          )}–£${priceHigh.toFixed(0)}.`
        : `Low demand right now for ${color} ${category}. Hold or improve listing details.`;

    // Confidence heuristic
    // More sold signals => higher confidence
    const confidence = clamp(40 + recentSoldCount * 12 - activeListingsCount * 4, 20, 95);

    const factors = {
      category,
      color,
      recentSoldCount,
      activeListingsCount,
      ageDays,
      isNeutral,
    };

    // Store in DB (UPSERT by item_id)
    const insertRes = await pool.query(
      `
      INSERT INTO resale_demand_signals
        (user_id, item_id, demand_score, demand_level, price_low, price_high, currency, message, confidence, factors)
      VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      ON CONFLICT (item_id)
      DO UPDATE SET
        demand_score = EXCLUDED.demand_score,
        demand_level = EXCLUDED.demand_level,
        price_low = EXCLUDED.price_low,
        price_high = EXCLUDED.price_high,
        currency = EXCLUDED.currency,
        message = EXCLUDED.message,
        confidence = EXCLUDED.confidence,
        factors = EXCLUDED.factors,
        calculated_at = NOW()
      RETURNING *
      `,
      [
        userId,
        it.id,
        score,
        level,
        priceLow.toFixed(2),
        priceHigh.toFixed(2),
        "GBP",
        message,
        confidence,
        factors,
      ]
    );

    results.push(insertRes.rows[0]);
  }

  return results;
}

/**
 * Simple category base pricing in GBP (you can tune later)
 */
function getBasePriceGBP(category) {
  const c = category.toLowerCase();

  if (c.includes("jacket") || c.includes("coat")) return 55;
  if (c.includes("shoes")) return 40;
  if (c.includes("jeans") || c.includes("pants") || c.includes("trouser")) return 35;
  if (c.includes("hoodie")) return 30;
  if (c.includes("dress")) return 45;
  if (c.includes("shirt") || c.includes("t-shirt") || c.includes("top")) return 20;

  return 25;
}

module.exports = router;
