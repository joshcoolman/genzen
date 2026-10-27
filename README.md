# GenZen

A personal workspace for making, comparing, and organizing AI images and video.
Work from prompts and reference images, try several models at once, and keep the
results together with the context that made them.

The working principle is immediate feedback: capture the idea, show the work in
progress, and let the next idea follow. Image submissions show pending thumbnails
before planning or rendering finishes, so you can keep prompting while earlier
batches run in the background.

![Images with grouped results, model labels, reference images, and a multi-model
generator](public/screenshots/genzen-images.jpg)

## Run it

1. Install Docker. It runs Postgres and the image bucket for you.
2. `pnpm install`, then `pnpm local:up`. It asks for your FAL key. The Anthropic
   key is optional: without it the AI text features are off and everything else
   works.
3. `pnpm dev`, then open http://localhost:3000 and sign in with the login
   `local:up` printed.

Nothing else to copy, edit or configure. Generations bill the FAL account whose
key you gave; nothing is mocked.

Agents and anyone working on the code: what used to be here is in
[`docs/OVERVIEW.md`](docs/OVERVIEW.md) (what each surface does),
[`docs/reference/local-dev.md`](docs/reference/local-dev.md) (setup detail,
scripts, env, repo map) and `CLAUDE.md` (conventions). Only `## Status` below
stays here, because sessions orient from it.

## Status

**Focus: nothing in the Focus column. Open #748 (top of Now) -- Director reordering after Extract or a storyboard write fails as "changed in another tab".**

Recent highlights:

- **Phone nav and swipe (#768-#770, #764-#767)** -- a green menu button
  bottom left (Images / Video / More, More flying out right), the plus bottom
  right. The image viewer swipes with a slide; fixed page scroll freezing after
  closing it, and blank images after a swipe. Hiding video controls on play was
  tried and reverted (#771): it stopped iOS playing at all.
- **Mobile viewers (#762)** -- Images and Video fill the screen, with title
  above, navigation below, and confirmation before Trash. Tap empty space to
  close; image prompts and actions live in a details sheet.
- **Code tidy (#758, #757)** -- knip's dead code removed, the S3 client
  guarded `server-only`; `src/lib/server/` grouped into `fal/ claude/
storage/ media/ generations/`, single-use files moved to their route.
- **Phone layout (#753, #755)** -- below 48rem: a nav (now the corner
  menu, #768); on Images and Video a floating plus opens a one-tap composer
  (prompt, chips, Generate with cost), 2-up bare walls, a Photos-first picker;
  the Images viewer has Generate from this and Animate. Desktop unchanged.
- **Director cuts (#744, #746, #747, #749, #751)** -- a run session holds
  several cuts as tabs. **New cut from script** remakes the open cut in one
  pass, clips chained through durable frame handoffs; reference clips can try
  Veo Fast.
- **Director chat answers end on a last beat (#740, #741)** -- a tease, an
  offer, a fork or a provocation that invites the next question, never a
  question about the person and never a tidy wrap-up. Its own prompt section.
