-- #406: when this account last signed in.
--
-- The one figure on the account overview that is not free. Everything else
-- there is aggregated out of `user_images`, which already records every
-- generation; this is a column that has to exist and a write on the login path
-- that has to happen, which is why it landed last and could have been cut
-- without touching anything else on the page.
--
-- Nullable with no default, and that absence means "has not signed in since
-- this migration ran" rather than "never". Backfilling it from `created_at`
-- would have invented a login that did not happen -- the overview says
-- "Unknown" instead, once, until the next sign-in.

alter table users add column last_login_at timestamptz;

comment on column users.last_login_at is
  'Set by the login action on a successful sign-in. Null until the first one after migration 0008.';
