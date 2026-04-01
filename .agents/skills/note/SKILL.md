---
name: note
description: Capture ideas to ideas.md for later automated research and expansion. Use when the user says "note this", "capture this idea", "add this to notes/ideas", or mentions wanting to remember an idea.
user_invocable: true
invocation_hint: note idea capture remember this add to ideas
---

# Note Skill

Quickly capture ideas to `ideas.md` in the repo root. This file is consumed by an automated process that researches and expands ideas into full documents in `docs/`.

## When to trigger

- User says "note this", "capture this", "add to notes/ideas", "let's note that", "/note"
- User mentions having an idea they want to come back to
- User says something like "oh that's interesting, we should look into that"

## Step 1: Read existing ideas

Read `ideas.md` from the repo root. If it doesn't exist, create it with the header:

```markdown
# Ideas

Captured ideas for automated research and expansion.
```

## Step 2: Check for related entries

Scan the existing entries. If the new idea clearly relates to or extends an existing entry, update that entry instead of appending a duplicate.

## Step 3: Add or update the entry

Each entry is a bullet point with a date prefix and concise description. Keep the user's intent but clean up for clarity. Don't over-edit -- the automation will flesh things out.

Format:

```
- **2026-03-29** -- Short clear description of the idea. Additional context if the user provided it.
```

If the idea has sub-points or related thoughts, nest them:

```
- **2026-03-29** -- Main idea description
  - Supporting detail or related thought
  - Another angle to explore
```

## Step 4: Confirm

After writing, confirm what was captured with a brief one-liner. Don't over-explain.

## Rules

- Keep entries concise -- the automation will do the deep research
- Preserve the user's language and intent, just clean up for readability
- Don't add tags, categories, or metadata -- keep it simple
- If updating an existing entry, note the new date alongside the original
- Append new entries at the end of the list
