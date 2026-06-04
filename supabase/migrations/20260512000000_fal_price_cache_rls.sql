ALTER TABLE fal_price_cache ENABLE ROW LEVEL SECURITY;

-- Pricing data is public; anyone can read it
CREATE POLICY "fal_price_cache_select" ON fal_price_cache
  FOR SELECT USING (true);

-- Writes are service-role only (service role bypasses RLS)
