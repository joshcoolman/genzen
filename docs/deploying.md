How genzen is deployed. Railway-specific; nothing here is required to run it
locally.

## Requirements

- A Railway account, and the app's repo reachable from it.
- The Railway CLI, authenticated (`railway login`) and linked (`railway link`),
  for `pnpm users` to reach a deployed database. Not needed to deploy.
- Three Railway resources in one project: the web service, a Postgres database,
  and a private object-storage bucket.

## Services

| Resource    | Notes                                                                     |
| ----------- | ------------------------------------------------------------------------- |
| web service | source = this repo, branch `main`                                         |
| Postgres    | any Postgres 17+; the volume is the only stateful part                    |
| bucket      | must be **private** (#226) — the app serves images itself via `/img/[id]` |

## Variables

Every variable the app reads, and where a deployment's value comes from.
If the app reads a var, it is in this table; `.env.example` deliberately lists
none of them, because locally `pnpm local:up` writes them all.

| Variable               | Required | Source                                                                                                                                                                                           |
| ---------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `DATABASE_URL`         | yes      | Reference to the Postgres resource (17+)                                                                                                                                                         |
| `R2_BUCKET_NAME`       | yes      | Reference to the bucket's `BUCKET`                                                                                                                                                               |
| `R2_ACCESS_KEY_ID`     | yes      | Reference to the bucket's `ACCESS_KEY_ID`                                                                                                                                                        |
| `R2_SECRET_ACCESS_KEY` | yes      | Reference to the bucket's `SECRET_ACCESS_KEY`                                                                                                                                                    |
| `R2_ENDPOINT`          | yes      | Reference to the bucket's `ENDPOINT`. Any S3-compatible bucket works; the `R2_` prefix is historical (#225). The bucket must be **private** (#226): the app serves images itself via `/img/[id]` |
| `AUTH_SESSION_SECRET`  | yes      | Generated per deployment, `openssl rand -hex 32`. Never reuse the local one; rotating it signs everyone out                                                                                      |
| `FAL_KEY`              | yes      | Yours, https://fal.ai/dashboard/keys. Image and video generation                                                                                                                                 |
| `ANTHROPIC_API_KEY`    | no       | Yours. Read implicitly by `@ai-sdk/anthropic`; powers every text and vision call. A feature that needs it fails loudly rather than degrading                                                     |
| `R2_ACCOUNT_ID`        | no       | Only read when `R2_ENDPOINT` is unset, to derive Cloudflare R2's endpoint. Unused on Railway                                                                                                     |
| `APP_URL`              | no       | The deployment's public URL. Only the `context:*` inspection scripts read it, to tell a pasted URL from this instance apart from another                                                         |
| `LOCAL_DEV_EMAIL`      | never    | Written by `local:up`; the generated local login. Must not be set on a deployment                                                                                                                |
| `LOCAL_DEV_PASSWORD`   | never    | Same                                                                                                                                                                                             |

## Settings that are not defaults

- **Pre-deploy command: `pnpm db:migrate`.** Migrations must run before the new
  container serves traffic.
- **Domain target port: 3000.** `start` runs Next on port 3000 through `scripts/serve.mjs`, which
  ignores an injected `PORT`. A platform that assigns a random port will route
  to the wrong one and serve 502s over a green deployment — the failure looks
  like a crash and isn't one.
- `prepare` runs `git config core.hooksPath` on every install and exits 128
  where there is no `.git`, which is every build container. It is guarded now;
  do not un-guard it.
- `pnpm users` resolves the deployed database by asking the Railway CLI for a
  service literally named `Postgres`. A different name falls back to local
  silently — the one quiet failure in this path.

## Director script-cut worker (#749)

The long-lived web process starts the Director worker through Next instrumentation.
`scripts/serve.mjs` warms `/login` on startup because Next initializes its render
server lazily. Both `pnpm dev` and `pnpm start` use it; no browser is needed to
resume a saved job after restart.
Apply migration 0027 before startup (the existing pre-deploy migration command
does this). No extra service or credentials are required. Jobs survive browser
closure and process restarts in Postgres. Each worker holds at most two reserved
connections for job locks; normal queries use the remaining pool. Multiple web
instances coordinate using advisory locks and checkpoint versions.

This worker requires a continuously running Node server. A request-only or
sleeping deployment cannot advance jobs while stopped; it resumes when the
server starts. A provider POST without a saved receipt is marked blocked on
recovery rather than submitted twice. Investigate that request in Activity and
the provider before cancelling/restarting; Retry never resubmits ambiguous work.
