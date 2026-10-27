How genzen is deployed: one Vercel project, holding the app, a private Blob
store and a Neon Postgres database (#777). Local dev uses the same three, so
this is also the contract for a laptop.

## Requirements

- A Vercel account with the repo reachable from it, and the Vercel CLI logged
  in (`vercel login`) for `local:up` and `pnpm users`.
- A FAL key. An Anthropic key if the AI-assisted features are wanted.

## Resources

All inside the one project. Deleting the project deletes all of them.

| Resource | Notes                                                                                                 |
| -------- | ----------------------------------------------------------------------------------------------------- |
| app      | source = this repo, production branch `main`; `vercel.json` sets the build command                    |
| Blob     | Storage tab, **private** (#226) — the app serves images itself via `/img/[id]`                        |
| Neon     | Storage tab, through the marketplace. Free plan, scales to zero; billed on the Vercel invoice if ever |

## Variables

Every variable the app reads, and where its value comes from. If the app reads
a var, it is in this table. There is no `.env.example`: `pnpm local:up` pulls
these from the project and this table is the only list.

| Variable                | Required | Source                                                                                                                                               |
| ----------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`          | yes      | Set by the Neon integration (pooled)                                                                                                                 |
| `DATABASE_URL_UNPOOLED` | no       | Set by the Neon integration. Preferred when present: the Director worker holds a session advisory lock, which a pooler cannot keep on one connection |
| `BLOB_READ_WRITE_TOKEN` | yes      | Set by connecting the Blob store. The store must be **private** (#226)                                                                               |
| `AUTH_SESSION_SECRET`   | yes      | Generated once by `local:up` onto the project for every environment. Rotating it signs everyone out                                                  |
| `FAL_KEY`               | yes      | Yours, https://fal.ai/dashboard/keys. `local:up` asks and stores it on the project. Image and video generation                                       |
| `ANTHROPIC_API_KEY`     | no       | Yours. Read implicitly by `@ai-sdk/anthropic`; powers every text and vision call. A feature that needs it fails loudly rather than degrading         |
| `APP_URL`               | no       | The deployment's public URL. Only the `context:*` inspection scripts read it, to tell a pasted URL from this instance apart from another             |
| `LOCAL_DEV_EMAIL`       | never    | Written by `local:up` into `.env.local` only; the generated login. Must not be set on the project                                                    |
| `LOCAL_DEV_PASSWORD`    | never    | Same                                                                                                                                                 |

The Neon integration also sets a dozen `POSTGRES_*` and `PG*` aliases the app
does not read.

## Settings that are not defaults

- **Build command: `pnpm db:migrate && pnpm build`** (`vercel.json`).
  Migrations run before the build, against the project's database, so a new
  deployment never serves against an old schema. A preview build migrates the
  same database: there is one, on purpose.
- **Director script cuts run inside requests on Vercel.** There is no
  long-lived process, so the page that reads a cut's progress advances it one
  checkpointed stage per read; see `app/(authenticated)/director/CLAUDE.md`.
  A cut pauses while nobody has its page open.
- `prepare` runs `git config core.hooksPath` on every install and exits 128
  where there is no `.git`, which is every build container. It is guarded now;
  do not un-guard it.
- `scripts/serve.mjs` and `pnpm start` are for a self-hosted Node server and CI's
  boot check. Vercel does not run them.

## Director script-cut worker (#749)

A long-lived Node server (`pnpm dev`, or `pnpm start` self-hosted) starts the
worker through Next instrumentation and `scripts/serve.mjs` warms `/login` on
startup so a saved job resumes with no browser open. Jobs survive process
restarts in Postgres. Each worker holds at most two reserved connections for
job locks; normal queries use the remaining pool. Multiple instances coordinate
using advisory locks and checkpoint versions. A provider POST without a saved
receipt is marked blocked on recovery rather than submitted twice. Investigate
that request in Activity and the provider before cancelling or restarting;
Retry never resubmits ambiguous work.
