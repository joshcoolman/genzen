# AD (Assistant Director)

Embedded AI chat assistant providing contextual creative direction with vision capabilities and tool calling. Renders as a right-sidebar panel, not a standalone page.

## Key Files

- `context/ad-context.tsx` -- ADContext provider: tracks route, feature context map, system prompt assembly, loaded note state
- `hooks/useADChat.ts` -- Message streaming with rAF-throttled state updates, abort support, multimodal image handling (ADImage type), tool calling (create_prompt_card)
- `hooks/useChatHistory.ts` -- localStorage persistence (50 msg cap, 500ms debounce, strips image base64 and tool call data)
- `hooks/useAnthropicKey.ts` -- API key management via external store pattern (localStorage, `sk-ant-` prefix)
- `hooks/useClaudeClient.ts` -- Memoized Anthropic SDK client initialization (`dangerouslyAllowBrowser: true`)
- `components/ADPanel.tsx` -- Fixed right-sidebar (w-80 / 320px on md+) with header, chat body, or setup form; copy/save/clear actions; prompt save/copy handlers
- `components/ADSetup.tsx` -- API key entry form with `sk-ant-` validation
- `components/ChatMessages.tsx` -- Message list with markdown rendering via `marked`, PromptCard tool rendering, copy buttons, auto-scroll
- `components/ChatInput.tsx` -- Auto-growing textarea with image paste/drag-drop/upload button support, streaming abort button

## Route

No dedicated route -- sidebar panel integrated in `src/components/DashboardLayout.tsx`. Opens/closes via `useADOpen()` from `@/lib/use-ad-open`. Toggle button lives in the status-bar feature.

## System Prompt Assembly

1. Base prompt identifies AD as creative assistant for GenZen with vision capabilities
2. Route descriptions map current pathname to context (hardcoded for 14+ dashboard routes)
3. Feature contexts injected dynamically by features calling `useRegisterADContext(key, summary)`
4. Loaded note (from notes feature) optionally injected for continuity

## Shared Dependencies

- `@anthropic-ai/sdk` -- Anthropic client for streaming with tool calling (claude-sonnet-4-6, max 4096 tokens)
- `@tanstack/react-router` -- useLocation for route tracking
- `@/lib/auth` -- useAuth for session gating (gates save functionality)
- `@/lib/use-ad-open` -- useADOpen for managing panel open/close state
- `@/features/notes/server/save-note.server` -- Server action to persist chat as markdown note
- `@/features/prompts/server/save-prompt.server` -- Server action to save prompts from PromptCard tool
- `marked` -- Markdown parsing for assistant responses
- `@/components/ActionButton` -- Action button component

## Integration Points

- Features register context via `useRegisterADContext(key, summary)` -- auto-unregisters on unmount
- Notes feature can save chat as markdown and load previous conversations back via `setLoadedNote()`
- `ADContextProvider` wraps dashboard content in `DashboardLayout.tsx`
- API key stored in browser localStorage only (never sent to server)

## Skills (prompt library)

AD ships with a library of authored `.md` skills at `src/lib/prompts/skills/` (top-level, shared — not nested under `src/features/ad/` so future server-side prompt migration can land in the same directory). Each file has frontmatter with `name` and `description`; the body is the heuristic text AD reads.

- Registry: `src/features/ad/skills/registry.ts` — raw-imports every skill via `import.meta.glob('/src/lib/prompts/skills/*.md', { query: '?raw', ... })`, parses frontmatter with `gray-matter`, exposes `skills`, `getSkill(name)`, `buildSkillsIndex()`.
- System prompt: `buildSkillsIndex()` returns an `## Available Skills` block listing `name — description` pairs, injected by `ad-context.tsx:buildSystemPrompt`. Metadata cost is ~30–50 tokens per skill.
- Tool: `load_skill({name})` — defined in `useADChat.ts`. When AD calls it, the hook runs an agentic loop: resolves the skill locally, appends `tool_use` + `tool_result` to the API messages, and re-streams. Existing render tools (`create_prompt_card`, `create_clarifying_card`) stay terminal and break the loop. Hard cap of 6 iterations.
- UI: `SkillLoadedCard` renders a click-to-expand chip above the assistant message showing exactly what body was injected. Mirrors Prompt Studio transparency.
- Persistence: loaded skills are scoped to the current user-turn. They are _not_ threaded back into the API on the next user message (AD re-requests if needed). They _are_ persisted to localStorage via `stripImagesForStorage` so the chip survives panel close/reopen.

**To add a new skill**: drop a new `.md` file at `src/lib/prompts/skills/<name>.md` with `name:` and `description:` frontmatter. The `description:` is imperative "Use when…" style — it's the only discovery signal AD has. Body is for AD to read; write it however helps.

## Tool Calling

Claude can call tools to render interactive UI components:

### create_prompt_card

Displays an image generation prompt with Copy and Save buttons.

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
- Save button (saves to prompts library, requires auth)

Tool calls are extracted from `stream.finalMessage()` by filtering content blocks with `type: 'tool_use'`, then rendered inline in the chat via PromptCard components.

## Legacy: render/ Directory

The `render/` directory contains unused json-render code (catalog, registry, README, TESTING, TOOL-CALLING docs) from a previous approach. The codebase has fully migrated to native Anthropic tool calling. These files are not imported anywhere and can be safely deleted.

## Quirks / Notes

- Users can attach images via paste, drag-drop, or upload button; images sent to Claude as base64 (vision-enabled model)
- Image data and tool call data stripped from localStorage history (only metadata kept) to avoid bloat
- `formatChatAsMarkdown()` converts messages to markdown for copying/saving (excludes tool data)
- Tool calls stream via Anthropic SDK events; text content and tool results render separately in chat
