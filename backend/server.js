const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = require('./db');
const authRoutes = require('./routes/auth');
const closetRoutes = require('./routes/closet');
const analyticsRoutes = require('./routes/analytics');
const sustainabilityRoutes = require("./routes/sustainability");
const rewardsRoutes = require("./routes/rewards");

const resaleRoutes = require("./routes/resale");
const listingAiRoutes = require("./routes/listing-ai");
const resaleTimingRoutes = require("./routes/resale-timing");
const notificationsRoutes = require("./routes/notifications");
// const notificationsRoutes = require("./routes/notifications");


const app = express();
const PORT = process.env.PORT || 5000;

/* ===============================
   ✅ CORS (ONLY ONCE)
================================ */
app.use(cors({
  origin: [
    "http://localhost:8081", // Expo web
    "http://localhost:19006",
    "http://localhost:3000"
  ],
  credentials: true
}));

app.use(express.json());

app.use("/listing-ai", listingAiRoutes);
app.use("/resale-timing", resaleTimingRoutes);
app.use("/rewards", rewardsRoutes);
app.use("/notifications", notificationsRoutes);
// app.use("/notifications", notificationsRoutes);


/* ===============================
   ✅ Static uploads
================================ */
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use("/sustainability", sustainabilityRoutes);
app.use("/resale", resaleRoutes);

/* ===============================
   ✅ Routes
================================ */
app.use('/auth', authRoutes);
app.use('/closet', closetRoutes);
app.use('/analytics', analyticsRoutes);

/* ===============================
   Root
================================ */
app.get('/', (req, res) => {
  res.json({ message: "Re-Style AI Backend is Running!" });
});

/* ===============================
   DB Setup
================================ */
app.get('/setup-db', async (req, res) => {
  try {
    const schema = fs.readFileSync('./schema.sql', 'utf8');
    await pool.query(schema);
    res.send("<h1>SUCCESS: Database Tables Created!</h1>");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error: " + err.message);
  }
});

/* ===============================
   Start server
================================ */
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
