# Continue: FAL MCP verification + genzen `fal-model-add` skill

## Where we are

- On `main`, clean. Seedance 2.0 work (PR #124) is **merged** — Seedance is the default video model, `VideoCard` renders model-name title + prompt description, and `generate-video.server.ts` writes the model name into `generation_metadata.model`.
- FAL's official hosted MCP server is **installed at user scope**: `claude mcp add --scope user --transport http fal-ai https://mcp.fal.ai/mcp --header "Authorization: Bearer $FAL_KEY"` — verified with `claude mcp list` (status: ✓ Connected). Config lives in `~/.claude.json`.
- The MCP **tools are not yet loaded in the current Claude session** — MCP tools only attach at Claude startup. **Restart Claude before doing anything in Step 1 below.**
- `FAL_KEY` is in `~/.zshrc` (len=69). A fresh Claude instance inherits it fine.

## The plan (3 steps)

### Step 1 — Verify the FAL MCP is live and test it

After restart, confirm the `fal-ai` MCP tools show up in your tool list. Expected tools (per FAL docs): something like `search_models`, a schema-fetch tool, an inference tool, a file-upload tool, and a docs browser — but **do not assume the exact names**. List them first, then pick.

Smoke test (pick any real FAL model — Seedance 2.0 is a good target since we know the ground truth):

1. Use the MCP search tool with a fuzzy query like `"bytedance seedance 2 image to video"`. Confirm it returns `bytedance/seedance-2.0/image-to-video` (no `fal-ai/` prefix) as the top hit.
2. Use the MCP schema tool to fetch that endpoint's OpenAPI input schema. Confirm it shows `image_url` (required), `end_image_url` (optional), `duration` enum with ~13 values, resolutions `480p/720p`, `generate_audio` default true, and no `cfg_scale` / no `negative_prompt`.
3. If both work cleanly, the MCP is trustworthy and you can move to Step 2. If the search returns garbage or the schema tool 404s, stop and investigate before writing the skill — the skill depends on these tools being reliable.

**Record the exact MCP tool names you used** — the skill in Step 2 will reference them by name.

### Step 2 — Write `~/.claude/skills/fal-model-add/SKILL.md`

This is a **user-scope skill** (lives in `~/.claude/skills/`, not the repo), because it's a workflow for Josh's local Claude, not something teammates need.

**Trigger phrases to bake into the skill description** (so it auto-fires):
- "add X model" / "add the X model from FAL"
- "can we use X on FAL"
- "verify X model id"
- any mention of FAL + a model name that isn't already in `ALL_VIDEO_MODELS` or `ALL_IMAGE_MODELS`

**Skill body — the workflow:**

1. **Resolve the id.** Call the MCP search tool with the user's fuzzy name. If there's one obvious match, proceed. If ambiguous (e.g. multiple Seedance variants), present the candidates and ask the user to pick. **Never guess the id from naming conventions** — this is a hard rule, see `feedback_fal_verify_model_ids.md`. Some ids are vendor-namespaced with no `fal-ai/` prefix.
2. **Fetch the schema.** Call the MCP schema tool for the resolved id. Keep the raw schema in context — you'll need multiple fields.
3. **Decide video vs image.** Video endpoints have `duration` / `resolution` / output is a video; image endpoints output images. Pick the matching registry:
   - Video → `src/features/ai-video/video-models.ts` (`VideoModel` interface, `ALL_VIDEO_MODELS` array)
   - Image → `src/features/ai-images/models.ts` (`ImageModel` interface, `ALL_IMAGE_MODELS` array)
4. **Map the schema to the TS interface.** The non-obvious mappings:
   - `supportsFlf` ← `end_image_url` present in input schema
   - `supportsCfgScale` ← `cfg_scale` present
   - `supportsNegativePrompt` ← `negative_prompt` present
   - `durations` ← the `duration` enum values, **curated** to a sensible subset (Seedance had 13 raw values; we exposed 3). Pick short/medium/long representatives unless the user says otherwise.
   - `resolutions` ← the `resolution` enum, passed through.
   - `defaultResolution` ← the schema's default, or the highest if no default.
   - Name / label / description: use the human name from FAL's model metadata (search result), not the raw id.
5. **Emit a paste-ready TS entry** with a confidence verdict line: `// Verified via FAL MCP: <tool_name> returned schema on <ISO date>`.
6. **Insert at the correct position.** If the user said "make it default" / "promote it", insert at index 0 (which makes `DEFAULT_VIDEO_MODEL` / `DEFAULT_IMAGE_MODEL` pick it up — see how Seedance was added). Otherwise insert below any existing locked/featured models.
7. **Run `pnpm check` + `pnpm build`.** Fix any TS errors. Do not mark the task done until both pass.
8. **Report what changed** with the file path and the new model's name + id.

**Hard rules in the skill body:**
- ❌ No `WebFetch` fallback. If the MCP can't resolve the model, ask the user directly.
- ❌ No guessing ids from naming patterns.
- ❌ Do not touch the generation pipeline — `fetchVideoModelSchema()` auto-detects schema at runtime, so a new registry entry is the only code change needed.
- ✅ First pass is **video-only**. Image support is a trivial extension (same workflow, different interface + registry file); add it to the skill as a second code path once video is proven.

**Genzen-specific context the skill should know** (include in the SKILL.md body):
- Registry files: `src/features/ai-video/video-models.ts`, `src/features/ai-images/models.ts`
- `DEFAULT_VIDEO_MODEL` / `DEFAULT_IMAGE_MODEL` are just `ALL_*_MODELS[0]` — order matters.
- Homepage `ModelShowcase` reads from the same arrays; index 0 shows first with a `New` badge if `isNew: true`.
- Commit convention: `feat: add <model name> as <video|image> model` for a new entry, `feat: promote <model> as default <video|image> model` if re-ordering.

### Step 3 — Optional smoke test

Once the skill is written, test it by asking Claude "add the Kling 2.0 video model from FAL" (or any other model not currently in `ALL_VIDEO_MODELS`). Confirm the skill fires, the MCP resolves the id, and the generated entry type-checks and builds. If it works end-to-end without manual intervention, the skill is done.

## Why this exists

Seedance 2.0 onboarding had a painful guessing loop: I assumed the id was `fal-ai/bytedance/seedance-2.0/image-to-video`, user pushed back, I verified against FAL's OpenAPI schema endpoint and found the correct `bytedance/seedance-2.0/image-to-video`. That dance should never happen again. The MCP makes verification a single tool call; the skill makes sure I actually reach for it instead of guessing.

## Git state

- Branch: `main`, up to date with `origin/main`
- Last commit: `9f6c1f0` (merged PR #124 — Seedance 2.0)
- Feature branch `feature/seedance-2.0` deleted locally and on remote
- Uncommitted: the previous `continue.md` was deleted (tracked deletion pending); this new one is being written fresh
- Nothing else dirty

## Sanity checks on resume

1. `git status` — should show just `continue.md` changes, nothing else
2. Restart Claude if you haven't already (MCP tools won't be there otherwise)
3. Check that `fal-ai` MCP tools appear in your tool list (look for names containing `search`, `schema`, `model`)
4. If yes → Step 1 (smoke test). If no → `claude mcp list` to debug; server may need the auth header refreshed.
