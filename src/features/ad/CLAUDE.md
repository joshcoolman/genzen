# AD (Assistant Director)

Embedded AI chat assistant providing contextual creative direction with vision capabilities and tool calling. Renders as a right-sidebar panel, not a standalone page.

## Key Files

- `context/ad-context.tsx` -- ADContext provider: tracks route, feature context map, system prompt assembly
- `hooks/useADChat.ts` -- Message streaming with rAF-throttled state updates, abort support, URL-based image attachments (ADImage = { id, url, title? }), tool calling (create_prompt_card, create_clarifying_card, load_skill)
- `hooks/useChatHistory.ts` -- localStorage persistence (50 msg cap, 500ms debounce). URLs are small so images now persist as-is and survive panel close/reopen and page refresh.
- `hooks/useAnthropicKey.ts` -- API key management via external store pattern (localStorage, `sk-ant-` prefix)
- `hooks/useClaudeClient.ts` -- Memoized Anthropic SDK client initialization (`dangerouslyAllowBrowser: true`)
- `components/ADPanel.tsx` -- Fixed right-sidebar (w-80 / 320px on md+) with header, chat body, or setup form; copy + clear actions (no save); prompt copy handler; dismissible error banner (AlertCircle) surfaces chat errors instead of silently failing; renders SkillChipRow above input
- `components/ADSetup.tsx` -- API key entry form with `sk-ant-` validation
- `components/ChatMessages.tsx` -- Message list with markdown rendering via `marked`, PromptCard tool rendering, SkillLoadedCard rendering for loaded skills, copy buttons, auto-scroll
- `components/ChatInput.tsx` -- Auto-growing textarea. Image attachments open `ImageSourceDialog` (shared picker) showing the user's library with in-dialog upload and paste. No direct upload / paste-into-textarea / drag-drop — all image intake flows through the picker so uploaded images land in the persistent library rather than existing only for a single turn.
- `components/SkillChipRow.tsx` -- Full-width "Agent Skills" chip button with skill count badge; opens a Popover with searchable skill list (search appears at 6+ skills); clicking a skill fires `onLaunch` with the skill's natural-language intent
- `components/SkillLoadedCard.tsx` -- Click-to-expand chip rendered above assistant messages showing the exact skill body that was injected during an agentic turn

## Route

No dedicated route -- sidebar panel integrated in `src/components/DashboardLayout.tsx`. Opens/closes via `useADOpen()` from `#/lib/use-ad-open`. Toggle button lives in the status-bar feature.

## System Prompt Assembly

1. Base prompt identifies AD as creative assistant for GenZen with vision capabilities
2. Route descriptions map current pathname to context (hardcoded for a few dashboard routes)
3. Feature contexts injected dynamically by features calling `useRegisterADContext(key, summary)`

## Shared Dependencies

- `@anthropic-ai/sdk` -- Anthropic client for streaming with tool calling (claude-sonnet-4-6, max 4096 tokens)
- `@tanstack/react-router` -- useLocation for route tracking
- `#/lib/auth` -- useAuth for session gating (gates image upload in the picker)
- `#/lib/use-ad-open` -- useADOpen for managing panel open/close state
- `marked` -- Markdown parsing for assistant responses
- `#/components/ActionButton` -- Action button component

## Integration Points

- Features register context via `useRegisterADContext(key, summary)` -- auto-unregisters on unmount
- `ADContextProvider` wraps dashboard content in `DashboardLayout.tsx`
- API key stored in browser localStorage only (never sent to server)

## Skills (prompt library)

AD ships with a library of authored `.md` skills at `src/lib/prompts/skills/` (top-level, shared — not nested under `src/features/ad/` so future server-side prompt migration can land in the same directory). Each file has frontmatter with `name` and `description`; the body is the heuristic text AD reads.

- Registry: `src/features/ad/skills/registry.ts` — raw-imports every skill via `import.meta.glob('/src/lib/prompts/skills/*.md', { query: '?raw', ... })`, parses frontmatter with a hand-rolled browser-safe parser (gray-matter needs Node's Buffer), exposes `skills`, `getSkill(name)`, `buildSkillsIndex()`. Each skill has `name`, `description`, `label` (chip text), and `launch` (natural-language intent for SkillChipRow).
- System prompt: `buildSkillsIndex()` returns an `## Available Skills` block listing `name — description` pairs, injected by `ad-context.tsx:buildSystemPrompt`. Metadata cost is ~30–50 tokens per skill.
- Tool: `load_skill({name})` — defined in `useADChat.ts`. When AD calls it, the hook runs an agentic loop: resolves the skill locally, appends `tool_use` + `tool_result` to the API messages, and re-streams. Existing render tools (`create_prompt_card`, `create_clarifying_card`) stay terminal and break the loop. Hard cap of 6 iterations.
- UI: `SkillLoadedCard` renders a click-to-expand chip above the assistant message showing exactly what body was injected. Mirrors Prompt Studio transparency.
- Persistence: loaded skills are scoped to the current user-turn. They are _not_ threaded back into the API on the next user message (AD re-requests if needed). They _are_ persisted to localStorage via `stripImagesForStorage` so the chip survives panel close/reopen.

**To add a new skill**: drop a new `.md` file at `src/lib/prompts/skills/<name>.md` with `name:` and `description:` frontmatter. The `description:` is imperative "Use when…" style — it's the only discovery signal AD has. Body is for AD to read; write it however helps.

## Tool Calling

Claude can call tools to render interactive UI components:

### create_prompt_card

Displays an image generation prompt with a Copy button.

**Input:**

- `prompt` (string, required) - The image generation prompt (10-2000 chars)
- `title` (string, optional) - Short title for the prompt (max 100 chars)
- `tags` (string[], optional) - Category/style keywords (max 8 tags)

**When used:**

- Writing a new image generation prompt
- Improving/rewriting an existing prompt
- Analyzing an image and suggesting a prompt to recreate it
- Providing prompt variations

**Rendered as:**

- Title (if provided)
- Prompt in monospace box
- Tags as colored badges
- Copy button (copies to clipboard)

Tool calls are extracted from `stream.finalMessage()` by filtering content blocks with `type: 'tool_use'`, then rendered inline in the chat via PromptCard components.

## Image attachments

User-attached images go through the shared `ImageSourceDialog` at `#/components/ImageSourceDialog/ImageSourceDialog`. Clicking the ImagePlus button in `ChatInput` opens the picker titled "Attach Image"; the user picks from their library (All / Uploads / AI Generated tabs) or uploads/pastes a new image inside the dialog. Uploaded images land in the persistent `user_images` library via the shared `useUserImages` hook, so every attachment is reusable and visible in the Assets page.

`ADImage = { id, url, title? }` — URL-referenced (R2 public URL, no expiry). Sent to Anthropic via `{ type: 'image', source: { type: 'url', url } }`. No base64 plumbing on user attachments.

Feature-registered context images (via `useRegisterADImage` from `ad-context.tsx`) remain base64 and are attached at API-build time to the _current_ turn only — they are not persisted in message history or threaded into historical turns. `buildMessageContent` in `useADChat.ts` accepts both shapes (URL attached + base64 context) and emits the right Anthropic image block for each.

Known limitations: signed-out users see an empty picker with no upload ability (hook requires `user.id`). Multi-attach is achieved by opening the picker multiple times — single-select per open.

## Quirks / Notes

- `formatChatAsMarkdown()` converts messages to markdown for copying/saving (excludes tool data)
- Tool calls stream via Anthropic SDK events; text content and tool results render separately in chat
