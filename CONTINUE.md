# Continue: Plan and Build Eval Workspace (#63)

## Branch: `feature/model-slots`

## Goal for this session

**Thorough planning session for GitHub issue #63 — Eval Workspace.** Interview style: extract all ideas, edge cases, and requirements before writing any code. Then produce a phased implementation plan to execute via worktree agents.

This is the user's first time trying the "plan thoroughly, kick off agents, review" workflow (vs turn-by-turn). The planning phase is where the time goes.

## What the Eval Workspace is

A dev-only tool (under `/dev/`) for side-by-side model and prompt strategy comparison. NOT a consumer feature. Follows the same pattern as the existing Dev Workspace (which was used to work out ModelSelector).

### Rev1 spec (from conversation)

- Select a source image from library
- Choose aspect ratio
- Select multiple models (reuse ModelSelector)
- One column per selected model — results side by side
- Debug output per column: raw prompt sent, raw API response, interim steps (enhance, JSON describe, rewrite)
- Completely isolated — generations don't appear in library, history, or anywhere else
- Hard delete — cleared results are gone forever, no soft delete, no trash

### Key eval scenarios discussed

- **JSON+delta vs JSON rewrite**: describe image as JSON, then either append natural language edit instructions OR have AI rewrite the JSON to reflect changes, then send to model. Which produces better results?
- **Prompt visibility**: see exactly what hits the model, not just what the user typed
- **Interim step transparency**: if there's an enhance or JSON describe step, show before/after

### Future vision (not Rev1)

- The dev space grows into a route with sub-routes for different testing tools
- Speed benchmarks, prompt strategy A/B tests, model quality comparisons
- Each new eval need becomes a new tool under `/dev/`
- Annotation/rating system, saved test cases, eval history

## Uncommitted changes (from prior session)

- `src/components/GenerationResultsGrid.tsx`: `ExpandablePrompt` with copy button
- `src/components/ImageGrid.tsx`: `alignItems: 'start'` on grid
- These are minor enhancements, unrelated to #63. Commit or stash before starting.

## Architecture context

- `ai-images` is the gold standard feature structure: `index.ts`, `components/`, `hooks/`, `server/`, `types.ts`
- Shared components: `ModelSelector`, `ImageGrid`, `ActionButton`, `GenerationResultsGrid`
- Server code uses `.server.ts` suffix in `src/lib/server/`
- Dev Workspace already exists at `/dev/` — this is a new route alongside it

## Approach

1. Start with interview-style planning — get all requirements and edge cases out
2. Write a detailed phased implementation plan
3. Execute phases via worktree agents
4. Review each phase's output before proceeding
