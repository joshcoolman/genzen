# GenZen

A personal workspace for making, comparing, and organizing AI images and video.

![Images with grouped results, model labels, reference images, and a multi-model
generator](public/screenshots/genzen-images.jpg)

## Run it

Three accounts: Vercel (hosting, database, images), FAL (generation) and
Anthropic (prompt help, optional). Nothing else.

1. Deploy the repo to a Vercel project. In its Storage tab add a private Blob
   store and a Neon Postgres database; both set their variables themselves.
2. `pnpm install`, `vercel link`, then `pnpm local:up`. It pulls the project's
   variables, migrates the database, makes you a login, and asks for your FAL
   key and, optionally, your Anthropic key. Keys go on the project, so the
   deployment and every other machine get them too.
3. Open http://localhost:3000 and sign in with the login `local:up` printed.
   The same login works on the deployed URL: local and deployed share one
   database and one image library.

To throw it away, delete the Vercel project. Everything goes with it.

## Agents

Nothing above is for you. What is:

- [`docs/OVERVIEW.md`](docs/OVERVIEW.md): what the app is and what each surface does.
- [`docs/reference/local-dev.md`](docs/reference/local-dev.md): setup detail, scripts, env, repo map.
- [`docs/reference/dev-status.md`](docs/reference/dev-status.md): where development is, read at session start.
- `CLAUDE.md`: conventions and the failures behind them.
