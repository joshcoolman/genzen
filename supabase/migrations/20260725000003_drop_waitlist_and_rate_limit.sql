-- Drop the waitlist gate and the rate limiter.
--
-- Same species as credits: both exist to defend the app from strangers.
-- `account_status` gated signups for an app with no signups — its only effect
-- was that seed.sql had to override a 'waitlist' default to make the sole real
-- user usable. `check_rate_limit` is a rolling-window abuse guard protecting me
-- from myself; Activity's cost column is the honest spend guard now.

DROP FUNCTION IF EXISTS check_rate_limit(uuid, integer, integer);

ALTER TABLE user_profiles DROP COLUMN IF EXISTS rate_window_start;
ALTER TABLE user_profiles DROP COLUMN IF EXISTS rate_window_count;

-- The update policy's WITH CHECK existed for exactly one reason: stop a user
-- promoting themselves off the waitlist by writing their own `account_status`.
-- Dropping the column would take the policy with it under CASCADE, so replace
-- the clause first with the guard that still means something — you may only
-- write a row that stays yours.
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

ALTER TABLE user_profiles DROP COLUMN IF EXISTS account_status;

DROP TYPE IF EXISTS account_status;
