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

`.env.example` is the contract: if the app reads a var, it is listed there.
Split by where the value comes from:

- **References** to the other two resources — `DATABASE_URL`, plus
  `R2_BUCKET_NAME` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_ENDPOINT`.
  Railway's bucket exposes these as `BUCKET`, `ACCESS_KEY_ID`,
  `SECRET_ACCESS_KEY`, `ENDPOINT`.
- **Yours** — `FAL_KEY`, and optionally `ANTHROPIC_API_KEY`. A feature whose key
  is missing fails loudly rather than degrading.
- **Generated per deployment** — `AUTH_SESSION_SECRET` (`openssl rand -hex 32`).
  Do not reuse the local one; rotating it invalidates every session.

`LOCAL_DEV_EMAIL` / `LOCAL_DEV_PASSWORD` are written by `local:up` and must not
be set on a deployment.

## Settings that are not defaults

- **Pre-deploy command: `pnpm db:migrate`.** Migrations must run before the new
  container serves traffic.
- **Domain target port: 3000.** `start` is `next start --port 3000`, which
  ignores an injected `PORT`. A platform that assigns a random port will route
  to the wrong one and serve 502s over a green deployment — the failure looks
  like a crash and isn't one.
- **One web replica for Director exports.** Upload ownership and temporary
  files belong to that process. A restart interrupts an export; retry from
  the saved session. Sessions, clips, pending provider receipts and completed
  exports are durable in Postgres and the private bucket; temporary uploads
  and in-progress stitching are not. Encoding stops after four minutes, leaving response
  headroom below Railway's five-minute idle request timeout.
- **Director Final Cut needs both AI keys.** Claude plans from the saved export;
  FAL renders picture, effects and score. Jobs run after the HTTP response using
  Next `after()`, so the browser need not stay open. A 90-second Postgres lease
  prevents duplicate workers. After a container restart, opening that session's
  Exports tab resumes queued/expired jobs using saved provider receipts. Uncertain
  submissions stop for review, never automatically spend again. Completed and
  intermediate assets live in the private bucket, not ephemeral disk. A worker
  pauses after 45 minutes and can be resumed; rough exports can be up to 180 seconds,
  with generated output capped at 120 seconds and one active Final Cut per user.
  Planning condenses the story and normalizes timing before video generation.
  Stopping cannot undo charges
  for requests already accepted by the provider.

## First user

A fresh database has no users, and there is no signup flow (#168). Nothing
propagates from local — schema travels with the repo, rows do not.

`pnpm users add '<email>' '<password>'` creates one. It reaches a deployed
database over Railway's public TCP proxy, so the Postgres service needs one
(Railway leaves `DATABASE_PUBLIC_URL` hostless until it does). Without a proxy,
run the same command inside the container instead.

## Known snags

- `prepare` runs `git config core.hooksPath` on every install and exits 128
  where there is no `.git`, which is every build container. It is guarded now;
  do not un-guard it.
- `pnpm users` resolves the deployed database by asking the Railway CLI for a
  service literally named `Postgres`. A different name falls back to local
  silently — the one quiet failure in this path.
