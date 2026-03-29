# AD (Assistant Director)

Embedded AI chat assistant providing contextual creative direction with vision capabilities. Renders as a right-sidebar panel, not a standalone page.

## Key Files

- `context/ad-context.tsx` -- ADContext provider: tracks route, feature context map, system prompt assembly, loaded note state
- `hooks/useADChat.ts` -- Message streaming with rAF-throttled state updates, abort support, multimodal image handling (ADImage type)
- `hooks/useChatHistory.ts` -- localStorage persistence (50 msg cap, 500ms debounce, strips image base64 data)
- `hooks/useAnthropicKey.ts` -- API key management via external store pattern (localStorage, `sk-ant-` prefix)
- `hooks/useClaudeClient.ts` -- Memoized Anthropic SDK client initialization (`dangerouslyAllowBrowser: true`)
- `components/ADPanel.tsx` -- Fixed right-sidebar (640px on md+) with header, chat body, or setup form; copy/save/clear actions
- `components/ADSetup.tsx` -- API key entry form with `sk-ant-` validation
- `components/ChatMessages.tsx` -- Message list with markdown rendering via `marked`, copy buttons, auto-scroll
- `components/ChatInput.tsx` -- Auto-growing textarea with image paste/drag-drop support, streaming abort button

## Route

No dedicated route -- sidebar panel integrated in `src/components/DashboardLayout.tsx`. Opens/closes via `useADOpen()` from `@/lib/use-ad-open`. Toggle button lives in the status-bar feature.

## System Prompt Assembly

1. Base prompt identifies AD as creative assistant for GenZen with vision capabilities
2. Route descriptions map current pathname to context (hardcoded for 14+ dashboard routes)
3. Feature contexts injected dynamically by features calling `useRegisterADContext(key, summary)`
4. Loaded note (from notes feature) optionally injected for continuity

## Shared Dependencies

- `@anthropic-ai/sdk` -- Anthropic client for streaming (claude-sonnet-4-6, max 4096 tokens)
- `@tanstack/react-router` -- useLocation for route tracking
- `@/lib/auth` -- useAuth for session gating (gates save functionality)
- `@/lib/use-ad-open` -- useADOpen for managing panel open/close state
- `@/features/notes/server/save-note.server` -- Server action to persist chat as markdown note
- `marked` -- Markdown parsing for assistant responses
- `@/components/ActionButton` -- Action button component

## Integration Points

- Features register context via `useRegisterADContext(key, summary)` -- auto-unregisters on unmount
- Notes feature can save chat as markdown and load previous conversations back via `setLoadedNote()`
- `ADContextProvider` wraps dashboard content in `DashboardLayout.tsx`
- API key stored in browser localStorage only (never sent to server)

## Quirks / Notes

- Users can attach images via paste or drag-drop; images sent to Claude as base64 (vision-enabled model)
- Image data stripped from localStorage history (only metadata kept) to avoid bloat
- `formatChatAsMarkdown()` converts messages to markdown for copying/saving
