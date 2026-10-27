Where development is. A snapshot, overwritten at natural beats, never a log:
one Focus line naming the live card, then at most six one-line bullets of what
shipped, most recent first. What is queued lives on the upnext board, not here.

**Focus: #777, moving genzen to Vercel (Blob, Neon, no Docker). Code and docs are on branch `vercel-migration`; what remains is Josh's FAL and Anthropic keys via `pnpm local:up`, the first production deploy, and retiring Railway.**

Recent highlights:

- **Vercel migration (#777)** -- storage client rewritten on Vercel Blob,
  Postgres on Neon through the marketplace, `local:up` pulls the project's
  variables instead of starting Docker. MinIO had pulled its images from every
  registry, which is what forced the move.
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
