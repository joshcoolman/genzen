# Development Workflow

How we build, ship, and track work on GenZen.

> **Partially superseded (2026-06-13).** The mechanics below (branch → PR → `pnpm check`/`build` → merge) still apply. The _revenue framing_ — "first paying customer" milestones, dogfooding-as-a-paying-customer, launch goals — does not: GenZen is a personal playground, not a product chasing customers. Ignore the monetization/launch milestones; the project-board flow is optional for solo work.

## Board

All work is tracked on the <a href="https://github.com/users/joshcoolman-smc/projects/6" target="_blank">GenZen Roadmap</a> project board.

| Column      | What goes here                                          |
| ----------- | ------------------------------------------------------- |
| Backlog     | Parked work -- features, R&D, nice-to-haves             |
| Up Next     | On deck -- will pull from here after current work ships |
| In Progress | Actively working on right now (1-2 items max)           |
| Done        | Shipped                                                 |

## Ticket lifecycle

1. Pick the next ticket from **In Progress** (or pull one from **Up Next**)
2. Create a feature branch: `feat/<issue-number>-short-description`
3. Do the work -- break large issues into phases, commit as you go
4. `pnpm check` (prettier + eslint), then `pnpm build` to verify
5. Push the branch, create a PR linking the issue
6. Review the PR, merge to main
7. Close the issue, move it to **Done**, pull the next ticket into **In Progress**

## Branch naming

- Features: `feat/<issue>-description` (e.g. `feat/169-drop-stripe`)
- Fixes: `fix/<issue>-description`
- Chores: `chore/<description>`

Always branch from `main`. Never commit directly to `main`.

## Pre-commit checks

Before every commit:

```
pnpm check     # prettier + eslint fix
pnpm build     # production build must pass
```

Fix any errors before staging and committing.

## Epics

Large initiatives get an `epic` label and a checklist of sub-issues. The epic issue links to sub-issues and tracks overall progress. Current active epic: #116 (First Paying Customer).

## Milestones

Retired. genzen is a personal tool, not a product — there is nothing to launch
and no one to sell to. `docs/research/` keeps the earlier SaaS thinking as a
record of what was considered, not as a plan.
