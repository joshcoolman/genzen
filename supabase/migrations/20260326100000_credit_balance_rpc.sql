-- Read credit balance via SECURITY DEFINER RPC
-- Ensures consistent auth behavior with add_credits/deduct_credits
CREATE OR REPLACE FUNCTION get_credit_balance(p_user_id uuid)
RETURNS integer AS $$
DECLARE
  v_balance integer;
BEGIN
  SELECT credit_balance INTO v_balance
  FROM user_profiles WHERE id = p_user_id;

  RETURN COALESCE(v_balance, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
