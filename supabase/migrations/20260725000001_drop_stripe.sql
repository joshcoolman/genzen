-- Drop Stripe.
--
-- genzen has one user, who pays FAL directly. Credit packs, a hosted Checkout
-- flow and a billing webhook were machinery protecting an app from strangers
-- that do not exist.
--
-- `add_credits` loses its `p_stripe_event_id` parameter. That parameter existed
-- only as the webhook's idempotency guard (unique violation on a repeat
-- delivery); with no webhook there is nothing to deduplicate.

DROP FUNCTION IF EXISTS add_credits(uuid, integer, text, text);

CREATE OR REPLACE FUNCTION add_credits(
  p_user_id uuid,
  p_amount integer,
  p_reason text
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

  INSERT INTO credit_transactions (user_id, amount, reason, balance_after)
  VALUES (p_user_id, p_amount, p_reason, v_balance);

  RETURN v_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER TABLE user_profiles DROP COLUMN IF EXISTS stripe_customer_id;
ALTER TABLE credit_transactions DROP COLUMN IF EXISTS stripe_event_id;
