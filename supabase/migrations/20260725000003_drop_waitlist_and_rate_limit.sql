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
ALTER TABLE user_profiles DROP COLUMN IF EXISTS account_status;

DROP TYPE IF EXISTS account_status;
