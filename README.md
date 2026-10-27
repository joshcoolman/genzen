# GenZen

A personal workspace for making, comparing, and organizing AI images and video.

![Images with grouped results, model labels, reference images, and a multi-model
generator](public/screenshots/genzen-images.jpg)

## Run it

1. Install Docker. It runs Postgres and the image bucket for you.
2. `pnpm install`, then `pnpm local:up`. It asks for your FAL key. The Anthropic
   key is optional: without it the AI text features are off and everything else
   works.
3. `pnpm dev`, then open http://localhost:3000 and sign in with the login
   `local:up` printed.

## Agents

Nothing above is for you. What is:

- [`docs/OVERVIEW.md`](docs/OVERVIEW.md): what the app is and what each surface does.
- [`docs/reference/local-dev.md`](docs/reference/local-dev.md): setup detail, scripts, env, repo map.
- [`docs/reference/dev-status.md`](docs/reference/dev-status.md): where development is, read at session start.
- `CLAUDE.md`: conventions and the failures behind them.
