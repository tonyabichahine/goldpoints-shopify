-- GoldPoints Database Schema

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Merchants (connected via Shopify OAuth)
CREATE TABLE IF NOT EXISTS merchants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shopify_domain TEXT UNIQUE NOT NULL,
  shopify_access_token TEXT NOT NULL,
  store_name TEXT,
  email TEXT,
  points_per_dollar INTEGER DEFAULT 1,
  signup_bonus INTEGER DEFAULT 100,
  birthday_bonus INTEGER DEFAULT 200,
  widget_primary_color TEXT DEFAULT '#6c3fff',
  widget_position TEXT DEFAULT 'bottom-right',
  widget_title TEXT DEFAULT 'Rewards',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customers (loyalty members per merchant)
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id UUID REFERENCES merchants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  phone TEXT,
  birthday DATE,
  points INTEGER DEFAULT 0,
  tier TEXT DEFAULT 'Bronze',
  shopify_customer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(merchant_id, email)
);

-- Offers (rewards merchants create)
CREATE TABLE IF NOT EXISTS offers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id UUID REFERENCES merchants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  points_required INTEGER NOT NULL,
  offer_type TEXT NOT NULL,
  offer_value TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Point transactions log
CREATE TABLE IF NOT EXISTS point_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id UUID REFERENCES merchants(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  points INTEGER NOT NULL,
  shopify_order_id TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Redemptions
CREATE TABLE IF NOT EXISTS redemptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id UUID REFERENCES merchants(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  offer_id UUID REFERENCES offers(id) ON DELETE SET NULL,
  discount_code TEXT,
  points_spent INTEGER NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default offers for new merchants (used by trigger)
CREATE OR REPLACE FUNCTION seed_default_offers()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO offers (merchant_id, name, description, points_required, offer_type, offer_value)
  VALUES
    (NEW.id, '10% Off', '10% discount on your next order', 500, 'percentage', '10'),
    (NEW.id, 'Free Shipping', 'Free standard shipping on your next order', 300, 'shipping', '0'),
    (NEW.id, '20% Off', '20% discount on your next order', 1000, 'percentage', '20');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_merchant_created
  AFTER INSERT ON merchants
  FOR EACH ROW EXECUTE FUNCTION seed_default_offers();
