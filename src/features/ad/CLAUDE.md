# AD (Assistant Director)

Embedded AI chat assistant providing contextual creative direction. Renders as a right-sidebar panel, not a standalone page.

## Key Files

- `context/ad-context.tsx` -- ADContext provider: tracks route, feature context map, system prompt assembly, loaded note state
- `hooks/useADChat.ts` -- Message streaming with rAF-throttled state updates, abort support
- `hooks/useChatHistory.ts` -- localStorage persistence (50 msg cap, 500ms debounce)
- `hooks/useAnthropicKey.ts` -- API key management via external store pattern (localStorage, validates `sk-ant-` prefix)
- `hooks/useClaudeClient.ts` -- Memoized Anthropic SDK client initialization (`dangerouslyAllowBrowser: true`)
- `components/ADPanel.tsx` -- Fixed right-sidebar with header, chat body, or setup form
- `components/ADSetup.tsx` -- API key entry form with validation
- `components/ADToggle.tsx` -- Toggle button for opening/closing the AD panel
- `components/ChatMessages.tsx` -- Message list with markdown rendering + auto-scroll
- `components/ChatInput.tsx` -- Auto-growing textarea with rAF-throttled submit

## Route

No dedicated route -- sidebar panel integrated in `src/routes/__root.tsx`.

## System Prompt Assembly

1. Base prompt identifies AD as creative assistant for GenZen
2. Route descriptions map current pathname to context (e.g. "user is on the Storyboard page")
3. Feature contexts injected dynamically by features calling `useRegisterADContext(key, summary)`
4. Loaded note (from notes feature) optionally injected for continuity

## Shared Dependencies

- `@anthropic-ai/sdk` -- Anthropic client for streaming (`claude-sonnet-4-6`, max 4096 tokens)
- `@tanstack/react-router` -- useLocation for route tracking
- `@/lib/auth` -- useAuth for session gating
- `@/features/notes/` -- save chat as note, load note into context

## Integration Points

- Features register context via `useRegisterADContext(key, summary)` -- auto-unregisters on unmount
- Notes feature can save chat as markdown and load previous conversations back via `setLoadedNote()`
- `ADContextProvider` wraps the app in `__root.tsx`
- API key stored in browser localStorage only (never sent to server)
