-- Stripe integration: customer mapping + webhook idempotency

-- 1. Stripe customer ID on user profiles
ALTER TABLE user_profiles ADD COLUMN stripe_customer_id text UNIQUE;

-- 2. Stripe event ID on transaction ledger for webhook idempotency.
-- UNIQUE allows multiple NULLs (existing transactions). A duplicate
-- webhook delivery will fail INSERT with 23505 unique_violation, which
-- the webhook handler catches as "already processed".
ALTER TABLE credit_transactions ADD COLUMN stripe_event_id text UNIQUE;

-- 3. Recreate add_credits with optional p_stripe_event_id.
-- Optional param with DEFAULT NULL keeps existing callers (initial_grant,
-- future bonus credits) working unchanged.
CREATE OR REPLACE FUNCTION add_credits(
  p_user_id uuid,
  p_amount integer,
  p_reason text,
  p_stripe_event_id text DEFAULT NULL
)
RETURNS integer AS $$
DECLARE
  v_balance integer;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'amount must be positive';
  END IF;

  SELECT credit_balance INTO v_balance
  FROM user_profiles WHERE id = p_user_id FOR UPDATE;

  v_balance := COALESCE(v_balance, 0) + p_amount;

  UPDATE user_profiles SET credit_balance = v_balance WHERE id = p_user_id;

  INSERT INTO credit_transactions (user_id, amount, reason, balance_after, stripe_event_id)
  VALUES (p_user_id, p_amount, p_reason, v_balance, p_stripe_event_id);

  RETURN v_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
