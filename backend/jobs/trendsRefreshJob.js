const axios = require("axios");
const pool = require("../db");

// ---------- Provider: eBay (real, official APIs) ----------
// Requires env:
// EBAY_CLIENT_ID, EBAY_CLIENT_SECRET
// EBAY_MARKETPLACE_ID=EBAY_GB (recommended)
// EBAY_ENV=production OR sandbox
let cachedToken = null;
let tokenExpiresAt = 0;

function ebayBaseUrl() {
  const env = (process.env.EBAY_ENV || "production").toLowerCase();
  return env === "sandbox"
    ? "https://api.sandbox.ebay.com"
    : "https://api.ebay.com";
}

async function getEbayAccessToken() {
  const now = Date.now();
  if (cachedToken && tokenExpiresAt > now + 30_000) return cachedToken;

  const clientId = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Missing EBAY_CLIENT_ID / EBAY_CLIENT_SECRET in .env");
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const url = `${ebayBaseUrl()}/identity/v1/oauth2/token`;

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    scope: "https://api.ebay.com/oauth/api_scope",
  });

  const resp = await axios.post(url, body.toString(), {
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  cachedToken = resp.data.access_token;
  const expiresIn = Number(resp.data.expires_in || 3600);
  tokenExpiresAt = now + expiresIn * 1000;

  return cachedToken;
}

async function fetchEbayTrending() {
  // We don’t have “official trending” endpoint across all categories,
  // so we approximate “trending picks” by searching popular fashion queries.
  // This STILL changes daily because the marketplace changes.
  const marketplaceId = process.env.EBAY_MARKETPLACE_ID || "EBAY_GB";

  const token = await getEbayAccessToken();
  const url = `${ebayBaseUrl()}/buy/browse/v1/item_summary/search`;

  const queries = [
    "vintage jacket",
    "leather jacket",
    "trench coat",
    "hoodie",
    "sneakers",
    "denim jeans",
    "wool coat",
  ];

  const all = [];

  for (const q of queries) {
    const resp = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-EBAY-C-MARKETPLACE-ID": marketplaceId,
      },
      params: {
        q,
        limit: 10,
        sort: "newlyListed", // makes daily changes visible
      },
    });

    const items = Array.isArray(resp.data?.itemSummaries)
      ? resp.data.itemSummaries
      : [];

    for (const it of items) {
      const externalId = String(it.itemId || "");
      if (!externalId) continue;

      all.push({
        source: "ebay",
        external_id: externalId,
        title: it.title || "Item",
        category: (it?.categories?.[0]?.categoryName || "").slice(0, 200),
        tags: ["second_hand"],
        eco_badges: ["second_hand"],
        price_value: Number(it?.price?.value || 0),
        price_currency: String(it?.price?.currency || "GBP"),
        image_url: it?.image?.imageUrl || "",
        product_url: it?.itemWebUrl || "",
      });
    }
  }

  // de-duplicate by external_id
  const map = new Map();
  for (const x of all) map.set(x.external_id, x);
  return Array.from(map.values()).slice(0, 30);
}

// ---------- Providers: Vinted/Depop ----------
// NOTE: These platforms do not offer stable official public APIs.
// To keep your app "real working", we implement stubs that return [].
// Later you can integrate via partner/affiliate feeds or your own ingestion service.
async function fetchVintedTrending() {
  return [];
}
async function fetchDepopTrending() {
  return [];
}

// ---------- Scoring ----------
// Simple scoring: cheaper items + eco badges get slight boost.
// You can refine anytime.
function scoreItem(item) {
  const price = Number(item.price_value || 0);
  let score = 50;

  if (price > 0) score += Math.max(0, 30 - Math.min(30, price / 5)); // cheaper = higher
  if (Array.isArray(item.eco_badges) && item.eco_badges.includes("second_hand")) score += 10;
  if (Array.isArray(item.tags) && item.tags.includes("vintage")) score += 8;

  // clamp 0..100
  score = Math.max(0, Math.min(100, score));
  return score;
}

// ---------- Main refresh ----------
async function refreshTrends({ limit = 30 } = {}) {
  const client = await pool.connect();

  try {
    const ebay = await fetchEbayTrending();
    const vinted = await fetchVintedTrending();
    const depop = await fetchDepopTrending();

    const merged = [...ebay, ...vinted, ...depop].slice(0, 200);

    // If everything is empty (no keys), fallback to keep UI working
    const items = merged.length
      ? merged
      : [
          {
            source: "ebay",
            external_id: "demo-1",
            title: "Demo Trend Pick — Add EBAY keys to make real feed",
            category: "Demo",
            tags: ["second_hand"],
            eco_badges: ["second_hand"],
            price_value: 25,
            price_currency: "GBP",
            image_url: "",
            product_url: "",
          },
        ];

    await client.query("BEGIN");

    // Upsert items into external_trending_items
    const insertedIds = [];

    for (const it of items) {
      const q = `
        INSERT INTO external_trending_items
          (source, external_id, title, category, tags, eco_badges, price_value, price_currency, image_url, product_url, fetched_at)
        VALUES
          ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, NOW())
        ON CONFLICT (source, external_id)
        DO UPDATE SET
          title = EXCLUDED.title,
          category = EXCLUDED.category,
          tags = EXCLUDED.tags,
          eco_badges = EXCLUDED.eco_badges,
          price_value = EXCLUDED.price_value,
          price_currency = EXCLUDED.price_currency,
          image_url = EXCLUDED.image_url,
          product_url = EXCLUDED.product_url,
          fetched_at = NOW()
        RETURNING id
      `;
      const r = await client.query(q, [
        it.source,
        it.external_id,
        it.title,
        it.category || "",
        it.tags || [],
        it.eco_badges || [],
        Number(it.price_value || 0),
        String(it.price_currency || "GBP"),
        it.image_url || "",
        it.product_url || "",
      ]);
      insertedIds.push({ id: r.rows[0].id, item: it });
    }

    // Build today snapshot
    const today = new Date().toISOString().slice(0, 10);

    // clear today's rank (so refresh overwrites daily)
    await client.query("DELETE FROM trending_daily_rank WHERE trend_date = $1", [today]);

    const ranked = insertedIds
      .map((x) => ({ item_id: x.id, score: scoreItem(x.item) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((x, idx) => ({ ...x, rank: idx + 1 }));

    for (const r of ranked) {
      await client.query(
        `
        INSERT INTO trending_daily_rank (trend_date, item_id, score, rank, refreshed_at)
        VALUES ($1,$2,$3,$4,NOW())
        ON CONFLICT (trend_date, item_id)
        DO UPDATE SET score = EXCLUDED.score, rank = EXCLUDED.rank, refreshed_at = NOW()
      `,
        [today, r.item_id, r.score, r.rank]
      );
    }

    await client.query("COMMIT");

    return { ok: true, trend_date: today, count: ranked.length };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

module.exports = { refreshTrends };
