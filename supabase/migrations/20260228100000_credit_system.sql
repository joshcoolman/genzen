-- Credit system: balance on user_profiles + transaction ledger

-- Add credit_balance to user_profiles
ALTER TABLE user_profiles ADD COLUMN credit_balance integer NOT NULL DEFAULT 0;

-- Transaction ledger
CREATE TABLE credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  reason text NOT NULL,
  balance_after integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX idx_credit_transactions_created_at ON credit_transactions(user_id, created_at DESC);

-- RLS: users can read own transactions, no client writes
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own transactions" ON credit_transactions
  FOR SELECT USING (auth.uid() = user_id);

-- Atomic deduction (locks row to prevent races)
CREATE OR REPLACE FUNCTION deduct_credits(p_user_id uuid, p_amount integer, p_reason text)
RETURNS TABLE(success boolean, new_balance integer) AS $$
DECLARE
  v_balance integer;
BEGIN
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

-- Add credits
CREATE OR REPLACE FUNCTION add_credits(p_user_id uuid, p_amount integer, p_reason text)
RETURNS integer AS $$
DECLARE
  v_balance integer;
BEGIN
  UPDATE user_profiles SET credit_balance = credit_balance + p_amount WHERE id = p_user_id
  RETURNING credit_balance INTO v_balance;

  INSERT INTO credit_transactions (user_id, amount, reason, balance_after)
  VALUES (p_user_id, p_amount, p_reason, v_balance);

  RETURN v_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update signup trigger to grant 50 credits on new user creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_profiles (id, display_name, credit_balance)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'display_name', 50);

  INSERT INTO public.credit_transactions (user_id, amount, reason, balance_after)
  VALUES (NEW.id, 50, 'initial_grant', 50);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Backfill existing active users with 50 credits
UPDATE user_profiles SET credit_balance = 50
WHERE account_status = 'active' AND credit_balance = 0;

INSERT INTO credit_transactions (user_id, amount, reason, balance_after)
SELECT id, 50, 'initial_grant', 50
FROM user_profiles
WHERE account_status = 'active' AND credit_balance = 50
AND NOT EXISTS (
  SELECT 1 FROM credit_transactions ct
  WHERE ct.user_id = user_profiles.id AND ct.reason = 'initial_grant'
);
