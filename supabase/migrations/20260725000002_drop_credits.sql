-- Drop the credit system.
--
-- Credits metered a stranger's spending. There is no stranger: one user, who
-- pays FAL directly. What the ledger really tracked was a second, invented
-- currency layered on top of the real one. Activity now reports the only figure
-- that means anything — what FAL charged.

DROP FUNCTION IF EXISTS deduct_credits(uuid, integer, text);
DROP FUNCTION IF EXISTS add_credits(uuid, integer, text);
DROP FUNCTION IF EXISTS get_credit_balance(uuid);

-- The signup trigger no longer grants a starting balance.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_profiles (id, display_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'display_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TABLE IF EXISTS credit_transactions;

ALTER TABLE user_profiles DROP COLUMN IF EXISTS credit_balance;
