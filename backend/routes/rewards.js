const express = require("express");
const router = express.Router();
const { recordEvent, getProfile, getHistory } = require("../lib/rewardsEngine");

// GET /rewards/:userId -> profile + tier + recommendations + badges
router.get("/:userId", async (req, res) => {
  try {
    const data = await getProfile(req.params.userId);
    res.json(data);
  } catch (e) {
    console.error("REWARDS PROFILE ERROR:", e);
    res.status(500).json({ error: "Failed to load rewards profile" });
  }
});

// GET /rewards/:userId/history?limit=50
router.get("/:userId/history", async (req, res) => {
  try {
    const rows = await getHistory(req.params.userId, req.query.limit);
    res.json({ items: rows });
  } catch (e) {
    console.error("REWARDS HISTORY ERROR:", e);
    res.status(500).json({ error: "Failed to load rewards history" });
  }
});

// POST /rewards/event
// body: { userId, eventType, meta }
router.post("/event", async (req, res) => {
  try {
    const { userId, eventType, meta } = req.body || {};
    if (!userId || !eventType) {
      return res.status(400).json({ error: "userId and eventType are required" });
    }
    const out = await recordEvent(userId, String(eventType), meta || {});
    res.json(out);
  } catch (e) {
    console.error("REWARDS EVENT ERROR:", e);
    res.status(500).json({ error: "Failed to record event" });
  }
});

module.exports = router;
