const express = require("express");
const router = express.Router();
const pool = require("../db");

// GET /analytics/:userId
router.get("/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const itemsRes = await pool.query(
      "SELECT category, color, created_at FROM closet_items WHERE user_id = $1",
      [userId]
    );

    const items = itemsRes.rows;

    const totalItems = items.length;

    // category counts
    const categoryCounts = {};
    const colorCounts = {};

    for (const it of items) {
      const cat = (it.category || "Unknown").trim();
      const col = (it.color || "Unknown").trim();

      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
      colorCounts[col] = (colorCounts[col] || 0) + 1;
    }

    // helper: find top key
    const topKey = (obj) => {
      let bestKey = null;
      let bestVal = 0;
      for (const k of Object.keys(obj)) {
        if (obj[k] > bestVal) {
          bestVal = obj[k];
          bestKey = k;
        }
      }
      return { key: bestKey, value: bestVal };
    };

    const topCategory = topKey(categoryCounts);
    const topColor = topKey(colorCounts);

    // simple health score: based on variety + size
    const uniqueCats = Object.keys(categoryCounts).length;
    const uniqueColors = Object.keys(colorCounts).length;

    // Score formula (simple and stable):
    // - variety helps
    // - having some items helps
    // Clamp to 0..100
    let score = Math.round(
      Math.min(
        100,
        (uniqueCats * 12) + (uniqueColors * 6) + Math.min(40, totalItems)
      )
    );

    res.json({
      userId,
      totalItems,
      score,
      topCategory,
      topColor,
      categoryCounts,
      colorCounts,
    });
  } catch (err) {
    console.error("ANALYTICS ERROR:", err);
    res.status(500).json({ error: "Analytics failed" });
  }
});

module.exports = router;
