// backend/routes/listing-ai.js
const express = require("express");
const router = express.Router();
const pool = require("../db");

// POST /listing-ai/generate
router.post("/generate", async (req, res) => {
  try {
    const { userId, itemId } = req.body;

    if (!userId || !itemId) {
      return res.status(400).json({ error: "Missing userId or itemId" });
    }

    // Get item from DB (must belong to user)
    const itemRes = await pool.query(
      `SELECT id, user_id, category, color, condition, size, description, for_sale, created_at
       FROM closet_items
       WHERE id = $1 AND user_id = $2`,
      [itemId, userId]
    );

    if (itemRes.rows.length === 0) {
      return res.status(404).json({ error: "Item not found for this user" });
    }

    const item = itemRes.rows[0];

    // If already listed
    if (item.for_sale) {
      return res.status(400).json({ error: "Item is already listed for sale" });
    }

    // ---------- Listing Generator (no external AI; always works) ----------
    const category = (item.category || "Item").trim();
    const color = (item.color || "Neutral").trim();
    const condition = (item.condition || "Good").trim();
    const size = (item.size || "").trim();

    // Condition multiplier (helps price range)
    const conditionMultiplier = (() => {
      const c = condition.toLowerCase();
      if (c.includes("new with tags")) return 1.25;
      if (c.includes("like new")) return 1.15;
      if (c.includes("good")) return 1.0;
      if (c.includes("fair")) return 0.8;
      return 1.0;
    })();

    // Base price by category (you can tune these)
    const baseByCategory = (() => {
      const c = category.toLowerCase();
      if (c.includes("jacket") || c.includes("coat")) return 35;
      if (c.includes("hoodie")) return 28;
      if (c.includes("dress")) return 30;
      if (c.includes("jeans")) return 26;
      if (c.includes("pants") || c.includes("trouser")) return 24;
      if (c.includes("shirt")) return 18;
      if (c.includes("t-shirt") || c.includes("tee")) return 15;
      if (c.includes("shoes") || c.includes("sneaker")) return 40;
      return 20;
    })();

    const mid = Math.round(baseByCategory * conditionMultiplier);

    // Range
    const priceMin = Math.max(5, mid - 6);
    const priceMax = mid + 8;

    // Title generator
    const niceSize = size ? ` • Size ${size}` : "";
    const title = `${color} ${category}${niceSize} | ${condition}`;

    // Tags generator
    const tags = [
      category,
      color,
      condition,
      size ? `Size ${size}` : null,
      "Pre-loved",
      "Resale",
      "Sustainable",
    ].filter(Boolean);

    // Description generator
    const bullets = [
      `• Category: ${category}`,
      `• Color: ${color}`,
      size ? `• Size: ${size}` : null,
      `• Condition: ${condition}`,
      `• Ships fast • Ready to wear`,
      `• Listed on RE-STYLE marketplace`,
    ].filter(Boolean);

    const description = [
      `Beautiful ${color.toLowerCase()} ${category.toLowerCase()} in ${condition.toLowerCase()} condition.`,
      item.description ? `\nSeller note: ${item.description}` : "",
      `\n\nDetails:\n${bullets.join("\n")}`,
    ].join("");

    return res.json({
      itemId: item.id,
      title,
      description,
      priceMin,
      priceMax,
      tags,
      // Optional: recommendation text for UI
      message: `Suggested range: $${priceMin}–$${priceMax}. Set a price near $${mid} for faster sale.`,
    });
  } catch (err) {
    console.error("LISTING-AI ERROR:", err);
    return res.status(500).json({ error: "Listing AI failed" });
  }
});

module.exports = router;
