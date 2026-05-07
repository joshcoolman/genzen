CREATE TABLE fal_price_cache (
  endpoint_id text PRIMARY KEY,
  unit_price numeric(10, 6) NOT NULL,
  unit text NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  fetched_at timestamptz NOT NULL DEFAULT now()
);
