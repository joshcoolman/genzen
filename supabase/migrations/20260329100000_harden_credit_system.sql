-- Harden credit system: CHECK constraints, amount guards, FOR UPDATE on add_credits

-- 1. CHECK constraint: credit_balance must never go negative
ALTER TABLE user_profiles ADD CONSTRAINT credit_balance_non_negative CHECK (credit_balance >= 0);

-- 2. CHECK constraint: balance_after in transaction ledger must never be negative
ALTER TABLE credit_transactions ADD CONSTRAINT credit_tx_balance_non_negative CHECK (balance_after >= 0);

-- 3. CHECK constraint: restrict reason to known values
ALTER TABLE credit_transactions ADD CONSTRAINT credit_tx_valid_reason
  CHECK (reason IN ('image_gen','variation','edit','first_frame','last_frame','video_gen','multishot_gen','pack_purchase','initial_grant'));

-- 4. Recreate deduct_credits with amount guard
CREATE OR REPLACE FUNCTION deduct_credits(p_user_id uuid, p_amount integer, p_reason text)
RETURNS TABLE(success boolean, new_balance integer) AS $$
DECLARE
  v_balance integer;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'amount must be positive';
  END IF;

  SELECT credit_balance INTO v_balance
  FROM user_profiles WHERE id = p_user_id FOR UPDATE;

  IF v_balance IS NULL THEN
    RETURN QUERY SELECT false, 0;
    RETURN;
  END IF;

  IF v_balance < p_amount THEN
    RETURN QUERY SELECT false, v_balance;
    RETURN;
  END IF;

  UPDATE user_profiles SET credit_balance = credit_balance - p_amount WHERE id = p_user_id;
  v_balance := v_balance - p_amount;

  INSERT INTO credit_transactions (user_id, amount, reason, balance_after)
  VALUES (p_user_id, -p_amount, p_reason, v_balance);

  RETURN QUERY SELECT true, v_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Recreate add_credits with amount guard + FOR UPDATE lock
CREATE OR REPLACE FUNCTION add_credits(p_user_id uuid, p_amount integer, p_reason text)
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
