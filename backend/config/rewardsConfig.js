module.exports = {
  MAX_SCORE: 9999,

  // “chunky” reward points
  POINTS: {
    LISTED: 50,   // user lists item for sale
    SOLD: 200,    // item sold
    BOUGHT: 150,  // user buys second-hand
    CO2_SAVED: 100 // awarded per CO2 milestone in code
  },

  // score increase weights (simple + easy to change later)
  SCORE: {
    LISTED: 25,
    SOLD: 120,
    BOUGHT: 80,
    // score from CO2 saved (per kg)
    CO2_PER_KG: 15
  },

  // badges (edit anytime)
  BADGES: [
    { code: "FIRST_LISTING", label: "First Listing", rule: { items_listed_gte: 1 } },
    { code: "FIRST_SALE", label: "First Sale", rule: { items_sold_gte: 1 } },
    { code: "FIRST_BUY", label: "First Purchase", rule: { items_bought_gte: 1 } },
    { code: "ECO_SAVER_10KG", label: "Eco Saver (10kg)", rule: { co2_saved_kg_gte: 10 } },
    { code: "ECO_SAVER_50KG", label: "Eco Hero (50kg)", rule: { co2_saved_kg_gte: 50 } },
    { code: "POWER_SELLER_10", label: "Power Seller (10)", rule: { items_sold_gte: 10 } },
  ],

  TIERS: [
    { name: "Starter", min: 0, max: 1999 },
    { name: "Building", min: 2000, max: 4999 },
    { name: "Strong", min: 5000, max: 7499 },
    { name: "Elite", min: 7500, max: 8999 },
    { name: "Champion", min: 9000, max: 9999 }
  ]
};
