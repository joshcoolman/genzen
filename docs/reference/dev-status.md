Where development is. A snapshot, overwritten at natural beats, never a log:
one Focus line naming the live card, then at most six one-line bullets of what
shipped, most recent first. What is queued lives on the upnext board, not here.

**Focus: empty. Now holds #777 (Vercel migration: code is on `main`; what remains is the first production deploy and retiring Railway), #780 (tests leave rows in the shared Neon database) and #748 (Director reorder conflict). Promote one.**

Recent highlights:

- **Images opens on All (#781)** -- the default scope no longer follows the
  first pill, so a fresh browser with uploads and no generations is not an
  empty wall. Under Generations, "Where are my uploads?" widens to All.
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
