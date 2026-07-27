# Architecture

Coming soon — see #188.

This described the TanStack Start and Supabase shape, which no longer exists:
the app runs on Next, Postgres, S3 and Node, with no Supabase and no realtime
(#168). Rather than leave a map of a stack that is gone, it was reduced to this.

Rewriting it waits on the conversion finishing (#187) — CSS Modules over
Tailwind, and Base UI replacing shadcn. Writing it before then would document a
layout that is still moving.

Until it lands, the shape of the app lives in:

- the root `CLAUDE.md` — services, structure, conventions, and the deltas from
  `project-standard`
- each feature's `CLAUDE.md` in `src/features/<name>/` — the local detail
- `migrations/0001_init.sql` — the data model, with the reasoning in comments
- `docs/SPEC.md` — what the app does and the rules that must hold

The two things worth preserving from the old version, and worth putting back
when it is rewritten: the framing of `user_images` as one deliberately
overloaded aggregate, and of a generation as a long-running saga rather than a
transaction.
