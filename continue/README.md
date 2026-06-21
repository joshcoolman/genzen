# continue/ — identity-keyed resume pointers

One file per developer, named by **GitHub login**: `continue/<login>.md`
(e.g. `continue/joshcoolman.md`). Each is a _live pointer_ to where that person
left off — what shipped, what's next — not an append log. Git history holds the past.

## How it's used

A `SessionStart` hook (`.claude/settings.json`) resolves the current user via
`gh api user --jq .login` and reads that person's file, so **"where are we at?"**
returns _your_ thread — identically on every machine you pull to.

- **"where are we at?"** → reads `continue/<your-login>.md`
- **"where's everyone at?" / "what did <name> do?"** → reads the other
  `continue/*.md` files, plus `git log --author=<login>` for the activity layer

Two layers in play: the **narrative/intent** (hand-written here — what's half-done,
what's safe to touch) and the **activity** (free from git/gh — commits, branches,
open PRs per author). The hook blends them.

## Conventions

- **Filename = GitHub login**, lowercase, exactly as `gh api user --jq .login` returns.
- Keep it short: a "Where I left off" section and a "Next up" section. Refresh + commit
  at the end of a session (the `/handoff` skill writes here).
- Per-user files **never merge-conflict** — that's the point. Don't merge threads into
  one shared file.
