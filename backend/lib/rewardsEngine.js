const pool = require("../db");
const CFG = require("../config/rewardsConfig");

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

function tierFor(score) {
  const t = CFG.TIERS.find(x => score >= x.min && score <= x.max);
  return t ? t.name : "Starter";
}

async function ensureProfile(userId) {
  await pool.query(
    `INSERT INTO sustainability_profile (user_id)
     VALUES ($1)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );
}

async function awardBadgesIfNeeded(userId) {
  const profRes = await pool.query(
    `SELECT circular_score, points_balance, co2_saved_kg, items_listed, items_sold, items_bought
     FROM sustainability_profile WHERE user_id = $1`,
    [userId]
  );
  const p = profRes.rows[0];
  if (!p) return;

  for (const b of CFG.BADGES) {
    const rule = b.rule || {};
    let ok = true;

    if (rule.items_listed_gte != null) ok = ok && p.items_listed >= rule.items_listed_gte;
    if (rule.items_sold_gte != null) ok = ok && p.items_sold >= rule.items_sold_gte;
    if (rule.items_bought_gte != null) ok = ok && p.items_bought >= rule.items_bought_gte;
    if (rule.co2_saved_kg_gte != null) ok = ok && Number(p.co2_saved_kg) >= rule.co2_saved_kg_gte;

    if (!ok) continue;

    await pool.query(
      `INSERT INTO user_badges (user_id, badge_code)
       VALUES ($1, $2)
       ON CONFLICT (user_id, badge_code) DO NOTHING`,
      [userId, b.code]
    );
  }
}

function computeDeltas(eventType, meta) {
  // meta can include co2_kg
  const co2 = Number(meta?.co2_kg || 0);
  let points = 0;
  let score = 0;

  if (eventType === "LISTED") {
    points = CFG.POINTS.LISTED;
    score = CFG.SCORE.LISTED;
  } else if (eventType === "SOLD") {
    points = CFG.POINTS.SOLD;
    score = CFG.SCORE.SOLD;
  } else if (eventType === "BOUGHT") {
    points = CFG.POINTS.BOUGHT;
    score = CFG.SCORE.BOUGHT;
  } else if (eventType === "CO2_SAVED") {
    // chunky points: award 100 points per 5kg saved (editable)
    const milestones = Math.floor(co2 / 5);
    points = milestones * CFG.POINTS.CO2_SAVED;
    score = Math.round(co2 * CFG.SCORE.CO2_PER_KG);
  }

  return { points, score, co2 };
}

async function recordEvent(userId, eventType, meta = {}) {
  const uid = Number(userId);
  if (!Number.isFinite(uid)) throw new Error("Invalid userId");

  await ensureProfile(uid);

  const { points, score, co2 } = computeDeltas(eventType, meta);

  // write event ledger
  await pool.query(
    `INSERT INTO circular_events (user_id, event_type, points_delta, score_delta, co2_delta_kg, meta)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
    [uid, eventType, points, score, co2, JSON.stringify(meta || {})]
  );

  // update profile totals
  const incListed = eventType === "LISTED" ? 1 : 0;
  const incSold = eventType === "SOLD" ? 1 : 0;
  const incBought = eventType === "BOUGHT" ? 1 : 0;

  const profRes = await pool.query(
    `UPDATE sustainability_profile
     SET
       points_balance = points_balance + $2,
       circular_score = circular_score + $3,
       co2_saved_kg = co2_saved_kg + $4,
       items_listed = items_listed + $5,
       items_sold = items_sold + $6,
       items_bought = items_bought + $7,
       updated_at = NOW()
     WHERE user_id = $1
     RETURNING circular_score`,
    [uid, points, score, co2, incListed, incSold, incBought]
  );

  // clamp score after update
  const rawScore = Number(profRes.rows?.[0]?.circular_score || 0);
  const clamped = clamp(rawScore, 0, CFG.MAX_SCORE);

  if (clamped !== rawScore) {
    await pool.query(
      `UPDATE sustainability_profile SET circular_score = $2, updated_at = NOW() WHERE user_id = $1`,
      [uid, clamped]
    );
  }

  await awardBadgesIfNeeded(uid);

  return { ok: true, pointsDelta: points, scoreDelta: score, co2DeltaKg: co2 };
}

async function getProfile(userId) {
  const uid = Number(userId);
  await ensureProfile(uid);

  const pRes = await pool.query(
    `SELECT user_id, circular_score, points_balance, co2_saved_kg, items_listed, items_sold, items_bought, updated_at
     FROM sustainability_profile WHERE user_id = $1`,
    [uid]
  );
  const p = pRes.rows[0];

  const badgesRes = await pool.query(
    `SELECT badge_code, earned_at FROM user_badges WHERE user_id = $1 ORDER BY earned_at DESC`,
    [uid]
  );

  const score = Number(p?.circular_score || 0);
  const tier = tierFor(score);

  // actionable recommendations
  const actions = [];
  if ((p?.items_listed || 0) < 1) actions.push("List your first item to earn points fast (+50).");
  if ((p?.items_sold || 0) < 1) actions.push("Sell one item to boost your score strongly (+200 points).");
  if ((p?.items_bought || 0) < 1) actions.push("Buy a second-hand piece to improve your circular score (+150 points).");
  if (Number(p?.co2_saved_kg || 0) < 5) actions.push("Complete a resale or second-hand buy to increase CO₂ savings.");

  return {
    profile: p,
    tier,
    maxScore: CFG.MAX_SCORE,
    recommendations: actions.slice(0, 3),
    badges: badgesRes.rows
  };
}

async function getHistory(userId, limit = 50) {
  const uid = Number(userId);
  const lim = Math.min(Math.max(Number(limit) || 50, 1), 200);

  const res = await pool.query(
    `SELECT id, event_type, points_delta, score_delta, co2_delta_kg, meta, created_at
     FROM circular_events
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [uid, lim]
  );
  return res.rows;
}

module.exports = {
  recordEvent,
  getProfile,
  getHistory
};
