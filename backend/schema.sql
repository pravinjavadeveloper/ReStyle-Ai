-- RE-STYLE AI MVP TABLES

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Closet Items (Your Digital Wardrobe)
CREATE TABLE IF NOT EXISTS closet_items (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    image_url TEXT NOT NULL,
    category VARCHAR(50), -- e.g. Top, Bottom, Shoes
    color VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Marketplace Items (For Selling)
CREATE TABLE IF NOT EXISTS marketplace_items (
    id SERIAL PRIMARY KEY,
    seller_id INTEGER REFERENCES users(id),
    title VARCHAR(255),
    price DECIMAL(10, 2),
    status VARCHAR(20) DEFAULT 'AVAILABLE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



-- ===========================================
--  RESALE DEMAND SIGNALS (NEW TABLE)
-- ===========================================

CREATE TABLE IF NOT EXISTS resale_demand_signals (
  id SERIAL PRIMARY KEY,

  user_id INTEGER NOT NULL,
  item_id INTEGER NOT NULL UNIQUE,

  demand_score INTEGER NOT NULL DEFAULT 0,         -- 0..100
  demand_level VARCHAR(10) NOT NULL DEFAULT 'LOW', -- LOW / MEDIUM / HIGH

  price_low NUMERIC(10,2),
  price_high NUMERIC(10,2),
  currency VARCHAR(6) DEFAULT 'GBP',

  message TEXT,
  confidence INTEGER NOT NULL DEFAULT 50, -- 0..100

  factors JSONB DEFAULT '{}'::jsonb,

  calculated_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT fk_resale_item
    FOREIGN KEY (item_id) REFERENCES closet_items(id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_resale_signals_user_id
  ON resale_demand_signals(user_id);

CREATE INDEX IF NOT EXISTS idx_resale_signals_level
  ON resale_demand_signals(demand_level);

CREATE INDEX IF NOT EXISTS idx_resale_signals_score
  ON resale_demand_signals(demand_score);



CREATE TABLE IF NOT EXISTS category_seasonality_rules (
  id SERIAL PRIMARY KEY,
  category_name VARCHAR(80) UNIQUE NOT NULL,
  peak_start_month INT NOT NULL CHECK (peak_start_month BETWEEN 1 AND 12),
  peak_end_month INT NOT NULL CHECK (peak_end_month BETWEEN 1 AND 12),
  notes TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ✅ Starter data (UK/EU seasonality style)
INSERT INTO category_seasonality_rules (category_name, peak_start_month, peak_end_month, notes)
VALUES
  ('Jacket', 10, 2, 'Outerwear peaks in autumn/winter'),
  ('Coat', 10, 2, 'Outerwear peaks in autumn/winter'),
  ('Hoodie', 9, 2, 'High fall/winter demand'),
  ('Sweater', 9, 2, 'Cold season demand'),

  ('Dress', 5, 8, 'Spring/summer demand'),
  ('Skirt', 5, 8, 'Spring/summer demand'),
  ('Shorts', 5, 8, 'Summer demand'),
  ('Swimwear', 5, 8, 'Summer demand'),

  ('Jeans', 1, 12, 'Year-round stable demand'),
  ('T-Shirt', 1, 12, 'Year-round stable demand'),
  ('Shirt', 1, 12, 'Year-round stable demand'),
  ('Pants', 1, 12, 'Year-round stable demand'),
  ('Shoes', 1, 12, 'Year-round stable demand')
ON CONFLICT (category_name) DO NOTHING;
