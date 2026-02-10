// backend/routes/closet.js
const express = require('express');
const router = express.Router();
const pool = require('../db');
const multer = require('multer');
const fs = require('fs');

// ✅ NEW: push notifications helper (safe)
let sendPushToTokens = null;
try {
  ({ sendPushToTokens } = require("../utils/push"));
} catch (e) {
  console.log("PUSH helper missing (skip):", e?.message || e);
}

// ✅ Configure Image Storage (uploads/)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage });

/* =========================================================
   ✅ Sustainability + Rewards (SAFE / NON-BREAKING)
========================================================= */

const clamp9999 = (n) => {
  const x = Number(n || 0);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(9999, Math.round(x)));
};

const estimateCO2Kg = (category) => {
  const c = String(category || '').toLowerCase();
  if (c.includes('coat')) return 15;
  if (c.includes('jacket')) return 12;
  if (c.includes('hoodie')) return 12;
  if (c.includes('jeans')) return 10;
  if (c.includes('pants')) return 9;
  if (c.includes('dress')) return 11;
  if (c.includes('skirt')) return 8;
  if (c.includes('shoes')) return 14;
  if (c.includes('shirt')) return 7;
  if (c.includes('t-shirt') || c.includes('tshirt')) return 6;
  return 8;
};

const computeBadgesToUnlock = (profile) => {
  const badges = [];
  const listed = Number(profile?.listed_count || 0);
  const sold = Number(profile?.sold_count || 0);
  const bought = Number(profile?.bought_count || 0);
  const co2 = Number(profile?.co2_saved_kg || 0);
  const score = Number(profile?.score || 0);
  const points = Number(profile?.points || 0);

  if (listed >= 1) badges.push('FIRST_LISTING');
  if (sold >= 1) badges.push('FIRST_SALE');
  if (bought >= 1) badges.push('FIRST_SECONDHAND_BUY');
  if (co2 >= 50) badges.push('CO2_SAVER_50');
  if (score >= 1000) badges.push('CIRCULAR_CREDIT_1000');
  if (points >= 500) badges.push('REWARDS_500');
  return badges;
};

const unlockBadges = async (userId, profileRow) => {
  try {
    const badges = computeBadgesToUnlock(profileRow);
    if (!badges.length) return;

    for (const code of badges) {
      await pool.query(
        `INSERT INTO user_badges (user_id, badge_code)
         VALUES ($1, $2)
         ON CONFLICT (user_id, badge_code) DO NOTHING`,
        [userId, code]
      );
    }
  } catch (e) {
    console.log("BADGE SKIP:", e?.message || e);
  }
};

const recordCircularEvent = async ({
  userId,
  eventType,
  scoreDelta = 0,
  pointsDelta = 0,
  co2Kg = 0,
  meta = {},
  counters = {},
}) => {
  try {
    if (!userId) return;

    const sDelta = clamp9999(scoreDelta);
    const pDelta = clamp9999(pointsDelta);
    const co2 = Number(co2Kg || 0);

    await pool.query(
      `INSERT INTO sustainability_events (user_id, event_type, score_delta, points_delta, co2_kg, meta)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, eventType, sDelta, pDelta, co2, meta]
    );

    const listedInc = Number(counters?.listed || 0);
    const soldInc = Number(counters?.sold || 0);
    const boughtInc = Number(counters?.bought || 0);

    const profileRes = await pool.query(
      `
      INSERT INTO user_sustainability
        (user_id, score, points, co2_saved_kg, listed_count, sold_count, bought_count)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (user_id) DO UPDATE SET
        score = LEAST(9999, user_sustainability.score + EXCLUDED.score),
        points = LEAST(9999, user_sustainability.points + EXCLUDED.points),
        co2_saved_kg = user_sustainability.co2_saved_kg + EXCLUDED.co2_saved_kg,
        listed_count = user_sustainability.listed_count + EXCLUDED.listed_count,
        sold_count = user_sustainability.sold_count + EXCLUDED.sold_count,
        bought_count = user_sustainability.bought_count + EXCLUDED.bought_count,
        updated_at = NOW()
      RETURNING *
      `,
      [userId, sDelta, pDelta, co2, listedInc, soldInc, boughtInc]
    );

    const profile = profileRes?.rows?.[0];
    if (profile) await unlockBadges(userId, profile);
  } catch (e) {
    console.log("SUSTAINABILITY SKIP:", e?.message || e);
  }
};

/* =========================================================
   ✅ SAFE PUSH: fetch tokens without crashing if column missing
========================================================= */
const tryGetAllTokensExceptUser = async (excludeUserId) => {
  try {
    const tokensRes = await pool.query(
      `SELECT expo_push_token
       FROM users
       WHERE expo_push_token IS NOT NULL
         AND expo_push_token <> ''
         AND id::text <> $1::text`,
      [String(excludeUserId)]
    );
    return tokensRes.rows.map(r => r.expo_push_token).filter(Boolean);
  } catch (e) {
    console.log("TOKENS SKIP:", e?.message || e);
    return [];
  }
};


/**
 * 1) UPLOAD ITEM (manual)
 */
router.post('/add', upload.single('image'), async (req, res) => {
  try {
    const { category, color, userId } = req.body;
    const imageUrl = req.file ? req.file.path : null;

    if (!userId) return res.status(400).json({ error: "Missing userId" });
    if (!category) return res.status(400).json({ error: "Missing category" });
    if (!imageUrl) return res.status(400).json({ error: "No image uploaded" });

    const newItem = await pool.query(
      'INSERT INTO closet_items (user_id, image_url, category, color) VALUES ($1, $2, $3, $4) RETURNING *',
      [userId, imageUrl, category, color || ""]
    );

    res.json({ message: "Item added!", item: newItem.rows[0] });
  } catch (err) {
    console.error("ADD ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * 2) GET MY ITEMS
 */
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const items = await pool.query(
      'SELECT * FROM closet_items WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    res.json(items.rows);
  } catch (err) {
    console.error("GET ITEMS ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * 3) LIST ITEM FOR SALE
 */
router.put('/sell/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { price, size, condition, description } = req.body;

    const updateItem = await pool.query(
      `UPDATE closet_items 
       SET for_sale = $1, price = $2, size = $3, condition = $4, description = $5 
       WHERE id = $6 RETURNING *`,
      [true, price, size, condition, description, id]
    );

    if (updateItem.rows.length === 0) {
      return res.json({ error: "Item not found" });
    }

    const listedItem = updateItem.rows[0];

    // ✅ Sustainability + rewards for LISTING
    await recordCircularEvent({
      userId: listedItem.user_id,
      eventType: "LISTED",
      scoreDelta: 60,
      pointsDelta: 100,
      co2Kg: 0,
      counters: { listed: 1 },
      meta: { itemId: listedItem.id, price: listedItem.price, category: listedItem.category }
    });

// 🔔 Save notification to DB (for inbox)
// 🔔 Save notification to DB (for inbox)
try {
  await pool.query(
    `
    INSERT INTO notifications (user_id, title, body, type, data)
    SELECT
      u.id,
      '🔥 New Marketplace Listing',
      $1,
      'MARKETPLACE_NEW_LISTING',
      $2::jsonb
    FROM users u
    WHERE u.id <> $3
    `,
    [
      `${listedItem.category}${listedItem.color ? " • " + listedItem.color : ""} is now available.`,
      JSON.stringify({ itemId: listedItem.id }),
      listedItem.user_id, // exclude seller
    ]
  );
} catch (e) {
  console.log("NOTIFICATION DB SKIP:", e?.message || e);
}



    // ✅ Push notification when any user lists item (notify others)
    try {
      if (sendPushToTokens) {
        const tokens = await tryGetAllTokensExceptUser(listedItem.user_id);

        if (tokens.length > 0) {
          const cat = listedItem.category || "Item";
          const col = listedItem.color || "";
          const p = listedItem.price || "";

          await sendPushToTokens(
            tokens,
            "🔥 New listing in Marketplace",
            `${cat}${col ? " • " + col : ""}${p ? " for $" + p : ""}. Tap to view.`,
            { type: "MARKETPLACE_NEW_LISTING", itemId: listedItem.id }
          );
        }
      }
    } catch (e) {
      console.log("PUSH SKIP:", e?.message || e);
    }

    res.json({ message: "Item Listed Successfully!", item: listedItem });
  } catch (err) {
    console.error("SELL ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * 4) MARKETPLACE FEED
 */
router.get('/marketplace/:userId', async (req, res) => {
  try {
    const items = await pool.query(
      'SELECT * FROM closet_items WHERE for_sale = $1 ORDER BY created_at DESC',
      [true]
    );
    res.json(items.rows);
  } catch (err) {
    console.error("MARKETPLACE ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * 5) BUY ITEM
 */
router.put('/buy/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { buyerId } = req.body;

    if (!buyerId) return res.status(400).json({ error: "Missing buyerId" });

    const itemResult = await pool.query('SELECT * FROM closet_items WHERE id = $1', [id]);
    if (itemResult.rows.length === 0) return res.status(404).json({ error: "Item not found" });

    const item = itemResult.rows[0];

    if (!item.for_sale) return res.status(400).json({ error: "Item is not for sale" });
    if (String(item.user_id) === String(buyerId)) return res.status(400).json({ error: "You cannot buy your own item!" });

    const orderResult = await pool.query(
      `INSERT INTO orders (item_id, buyer_id, seller_id, price)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [item.id, buyerId, item.user_id, item.price]
    );

    const updatedItem = await pool.query(
      'UPDATE closet_items SET for_sale = $1 WHERE id = $2 RETURNING *',
      [false, id]
    );

    const co2 = estimateCO2Kg(item.category);

    await recordCircularEvent({
      userId: item.user_id,
      eventType: "SOLD",
      scoreDelta: 180,
      pointsDelta: 200,
      co2Kg: co2,
      counters: { sold: 1 },
      meta: { itemId: item.id, orderId: orderResult.rows[0]?.id, price: item.price, category: item.category }
    });

    await recordCircularEvent({
      userId: buyerId,
      eventType: "BOUGHT",
      scoreDelta: 140,
      pointsDelta: 150,
      co2Kg: co2,
      counters: { bought: 1 },
      meta: { itemId: item.id, orderId: orderResult.rows[0]?.id, price: item.price, category: item.category }
    });

    res.json({
      message: "Purchase successful",
      order: orderResult.rows[0],
      item: updatedItem.rows[0]
    });

  } catch (err) {
    console.error("BUY ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * 6) MY PURCHASES
 */
router.get('/purchases/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const query = `
      SELECT o.id, o.price, o.created_at AS date_sold, c.category AS item_name, c.image_url
      FROM orders o
      JOIN closet_items c ON o.item_id = c.id
      WHERE o.buyer_id = $1
      ORDER BY o.created_at DESC
    `;

    const items = await pool.query(query, [userId]);
    res.json(items.rows);
  } catch (err) {
    console.error("PURCHASES ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * 7) MY SOLD ITEMS
 */
router.get('/sold/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const query = `
      SELECT o.id, o.price, o.created_at AS date_sold, o.buyer_id, c.category AS item_name, c.image_url
      FROM orders o
      JOIN closet_items c ON o.item_id = c.id
      WHERE o.seller_id = $1
      ORDER BY o.created_at DESC
    `;

    const items = await pool.query(query, [userId]);
    res.json(items.rows);
  } catch (err) {
    console.error("SOLD ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * 8) DELETE ITEM
 */
router.delete('/delete/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query('DELETE FROM orders WHERE item_id = $1', [id]);

    const deleted = await pool.query(
      'DELETE FROM closet_items WHERE id = $1 RETURNING *',
      [id]
    );

    if (deleted.rows.length === 0) return res.json({ error: "Item not found" });

    res.json({ message: "Item deleted successfully!" });
  } catch (err) {
    console.error("DELETE ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ---------------------------------------------------------
// 9) ⭐ AI AUTO ADD (MULTI IMAGE / MULTI ITEM) - FIXED ✅
// ---------------------------------------------------------
router.post('/auto-add', upload.array('images'), async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "Missing userId" });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No images uploaded" });
    }

    console.log(`🤖 AI Processing ${req.files.length} images...`);

    const { GoogleGenerativeAI } = await import("@google/generative-ai");

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "GEMINI_API_KEY missing in .env" });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

    const prompt = `
Analyze the image. It may contain ONE or MULTIPLE clothing items.

Rules:
- Detect ONLY clothing garments (Shirt, T-shirt, Jeans, Pants, Dress, Skirt, Jacket, Hoodie, Coat, Shoes).
- IGNORE accessories: hats, caps, watches, jewelry, bags, belts, sunglasses.
- Return ONLY raw JSON array.
Example:
[
  {"category":"T-Shirt","color":"Black"},
  {"category":"Jeans","color":"Blue"}
]
No text. No markdown.
`;

    const toPart = (file) => ({
      inlineData: {
        data: fs.readFileSync(file.path).toString("base64"),
        mimeType: file.mimetype || "image/jpeg",
      },
    });

    let addedItems = [];

    for (const file of req.files) {
      try {
        const imagePart = toPart(file);
        const result = await model.generateContent([prompt, imagePart]);
        const text = result.response.text();

        const start = text.indexOf("[");
        const end = text.lastIndexOf("]");

        if (start === -1 || end === -1) {
          console.log("❌ No JSON returned:", text);
          continue;
        }

        const jsonText = text.substring(start, end + 1);

        let detectedItems;
        try {
          detectedItems = JSON.parse(jsonText);
        } catch (e) {
          console.log("❌ JSON parse failed:", jsonText);
          continue;
        }

        for (const item of detectedItems) {
          if (!item || !item.category || !item.color) continue;

          const dbRes = await pool.query(
            `INSERT INTO closet_items (user_id, image_url, category, color)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [userId, file.path, item.category, item.color]
          );

          addedItems.push(dbRes.rows[0]);
        }

      } catch (imgErr) {
        console.error("❌ Image processing failed:", imgErr);
      }
    }

    res.json({
      message: "Auto add completed ✅",
      count: addedItems.length,
      items: addedItems,
    });

  } catch (err) {
    console.error("🔥 AUTO-ADD ERROR:", err);
    res.status(500).json({ error: "Auto add failed" });
  }
});

module.exports = router;
