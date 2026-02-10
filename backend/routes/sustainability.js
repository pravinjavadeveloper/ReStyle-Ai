const express = require("express");
const router = express.Router();
const pool = require("../db");

/**
 * Carbon & Water impact factors (V1)
 * NOTE: These are approximate default factors.
 * Later we can make this dynamic by brand/material/etc.
 */
const IMPACT = {
  "T-Shirt": { co2: 4, water: 2700 },
  "Shirt": { co2: 7, water: 3000 },
  "Jeans": { co2: 33, water: 7600 },
  "Pants": { co2: 20, water: 5000 },
  "Trouser": { co2: 20, water: 5000 },
  "Dress": { co2: 22, water: 6000 },
  "Skirt": { co2: 15, water: 4500 },
  "Jacket": { co2: 25, water: 4000 },
  "Coat": { co2: 35, water: 5000 },
  "Hoodie": { co2: 18, water: 4000 },
  "Shoes": { co2: 14, water: 2000 },
  "Unknown": { co2: 10, water: 3000 },
};

/**
 * Helper: normalize category to match keys above
 */
function normalizeCategory(cat) {
  if (!cat) return "Unknown";
  const c = String(cat).trim().toLowerCase();

  // basic matching rules
  if (c.includes("t-shirt") || c.includes("tee")) return "T-Shirt";
  if (c.includes("shirt")) return "Shirt";
  if (c.includes("jean")) return "Jeans";
  if (c.includes("trouser")) return "Trouser";
  if (c.includes("pant")) return "Pants";
  if (c.includes("dress")) return "Dress";
  if (c.includes("skirt")) return "Skirt";
  if (c.includes("jacket")) return "Jacket";
  if (c.includes("coat")) return "Coat";
  if (c.includes("hoodie")) return "Hoodie";
  if (c.includes("shoe") || c.includes("sneaker")) return "Shoes";

  // fallback: try title-case exact keys
  const title = c.charAt(0).toUpperCase() + c.slice(1);
  return IMPACT[title] ? title : "Unknown";
}

/**
 * GET /sustainability/:userId
 * Returns:
 * - wardrobe footprint estimate
 * - savings from second-hand purchases + selling
 * - breakdown by category
 */
router.get("/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    // 1) Fetch all closet items
    const closetRes = await pool.query(
      "SELECT id, category FROM closet_items WHERE user_id = $1",
      [userId]
    );
    const closetItems = closetRes.rows;

    // 2) Fetch orders (purchases + sold)
    const ordersRes = await pool.query(
      "SELECT id, buyer_id, seller_id, item_id, price, created_at FROM orders WHERE buyer_id = $1 OR seller_id = $1",
      [userId]
    );
    const orders = ordersRes.rows;

    // 3) Wardrobe footprint estimate (based on categories)
    const breakdown = {}; // {category: {count, co2, water}}
    let wardrobeCo2 = 0;
    let wardrobeWater = 0;

    for (const it of closetItems) {
      const cat = normalizeCategory(it.category);
      const f = IMPACT[cat] || IMPACT["Unknown"];

      if (!breakdown[cat]) breakdown[cat] = { count: 0, co2: 0, water: 0 };
      breakdown[cat].count += 1;
      breakdown[cat].co2 += f.co2;
      breakdown[cat].water += f.water;

      wardrobeCo2 += f.co2;
      wardrobeWater += f.water;
    }

    // 4) Savings model (V1):
    // - Buying second-hand avoids "new production" partially → 70% of new impact saved
    // - Selling extends garment life → 50% of new impact saved
    //
    // These are adjustable later.
    let savedCo2 = 0;
    let savedWater = 0;

    // Need item categories for orders.item_id (join)
    const orderItemIds = orders.map((o) => o.item_id).filter(Boolean);
    let orderItemsById = {};

    if (orderItemIds.length > 0) {
      const itemsRes = await pool.query(
        `SELECT id, category FROM closet_items WHERE id = ANY($1::int[])`,
        [orderItemIds]
      );
      for (const r of itemsRes.rows) {
        orderItemsById[String(r.id)] = r;
      }
    }

    const BUY_SAVINGS_RATE = 0.7;
    const SELL_SAVINGS_RATE = 0.5;

    for (const o of orders) {
      const item = orderItemsById[String(o.item_id)];
      const cat = normalizeCategory(item?.category);
      const f = IMPACT[cat] || IMPACT["Unknown"];

      // buyer savings
      if (String(o.buyer_id) === String(userId)) {
        savedCo2 += f.co2 * BUY_SAVINGS_RATE;
        savedWater += f.water * BUY_SAVINGS_RATE;
      }

      // seller savings
      if (String(o.seller_id) === String(userId)) {
        savedCo2 += f.co2 * SELL_SAVINGS_RATE;
        savedWater += f.water * SELL_SAVINGS_RATE;
      }
    }

    // 5) Top impact category in wardrobe
    let topImpactCategory = { key: null, value: 0 };
    for (const k of Object.keys(breakdown)) {
      if (breakdown[k].co2 > topImpactCategory.value) {
        topImpactCategory = { key: k, value: breakdown[k].co2 };
      }
    }

    // 6) Quick insight messages (we can expand later)
    const tips = [];
    if (closetItems.length === 0) {
      tips.push("Start scanning items to unlock sustainability insights.");
    } else {
      tips.push("Buying second-hand helps cut fashion emissions significantly.");
      if (topImpactCategory.key) {
        tips.push(`Your highest-impact category is ${topImpactCategory.key}. Consider reselling unused pieces.`);
      }
      if (savedCo2 > 0) {
        tips.push(`Nice! You’ve already saved about ${savedCo2.toFixed(1)}kg CO₂ by using circular fashion.`);
      }
    }

    // Send response
    res.json({
      userId,
      totalItems: closetItems.length,

      wardrobeFootprint: {
        co2Kg: Number(wardrobeCo2.toFixed(2)),
        waterLiters: Math.round(wardrobeWater),
      },

      savings: {
        co2Kg: Number(savedCo2.toFixed(2)),
        waterLiters: Math.round(savedWater),
      },

      topImpactCategory,
      breakdown,
      tips,
    });
  } catch (err) {
    console.error("SUSTAINABILITY ERROR:", err);
    res.status(500).json({ error: "Sustainability report failed" });
  }
});

module.exports = router;
