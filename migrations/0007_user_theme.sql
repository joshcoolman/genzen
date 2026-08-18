-- #406: the six colors a user edits to restyle the whole app.
--
-- Only the *core* is stored. The rest of the palette is derived
-- (`src/features/theme/derive.ts`) rather than persisted, so a change to how a
-- step is computed reaches every existing theme instead of only new ones. A
-- stored palette would freeze today's derivation into every row.
--
-- One JSONB column rather than six text columns, and that is the reference
-- repo's lesson rather than a shortcut: bootsy stored a column per color and
-- needed a second migration (`0015_admin_theme_muted.sql`) the first time the
-- core grew by one. The set of knobs is the thing most likely to change here.
-- Validation lives in the action, which has to hex-check the input anyway --
-- the constraint below only guarantees the shape the reader destructures.
--
-- A row exists ONLY for a user who has saved a theme. That absence is
-- load-bearing: the layout emits no `<style>` at all without a row, so an
-- uncustomized app renders `tokens.css` untouched and the defaults in
-- `derive.ts` can never drift out of sync with it. bootsy carries a standing
-- warning to keep those two in sync; this shape removes the requirement.

create table user_theme (
  -- Primary key, not just a foreign key: one theme per user, enforced by the
  -- shape rather than by an index the writer has to remember to hit.
  user_id uuid primary key references users (id) on delete cascade,

  core jsonb not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint user_theme_core_keys check (
    core ?& array['bg', 'surface', 'text', 'muted', 'accent', 'border']
  )
);

comment on table user_theme is
  'The six core colors a user edits on /account/style. The rest of the palette is derived at render time, never stored. No row means no customization -- the app falls through to src/styles/tokens.css.';
comment on column user_theme.core is
  'Six hex colors: bg, surface, text, muted, accent, border. Hex because <input type="color"> speaks hex; derive.ts converts to the HSL that tokens.css uses.';

create trigger user_theme_set_updated_at
  before update on user_theme
  for each row execute function set_updated_at();
