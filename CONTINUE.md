# Continue: AD Panel -- Complete (All 4 Sessions)

## Branch: `feature/ad-panel`

## What was built

### Session 1 (committed as 49bcce7)

- Panel shell: `ADPanel.tsx`, `ADToggle.tsx`, `use-ad-open.ts`
- Layout integration in `DashboardLayout.tsx`
- `@anthropic-ai/sdk` installed

### Session 2 (uncommitted)

- `src/features/ad/hooks/useAnthropicKey.ts` -- useSyncExternalStore + localStorage (`ad-anthropic-key`)
- `src/features/ad/hooks/useClaudeClient.ts` -- creates `new Anthropic({ apiKey, dangerouslyAllowBrowser: true })`
- `src/features/ad/components/ADSetup.tsx` -- password input with `sk-ant-` prefix validation
- `src/features/ad/components/ADPanel.tsx` -- conditional render ADSetup vs chat

### Session 3 (uncommitted)

- `src/features/ad/hooks/useADChat.ts` -- streaming chat via `client.messages.stream()` with `claude-sonnet-4-6`, rAF-throttled updates, abort support
- `src/features/ad/hooks/useChatHistory.ts` -- localStorage persist, 50-msg cap, 500ms debounced writes
- `src/features/ad/components/ChatMessages.tsx` -- scrollable message list, markdown via `marked`, copy button on assistant messages, auto-scroll with manual override
- `src/features/ad/components/ChatInput.tsx` -- auto-grow textarea, Enter/Shift+Enter, abort button during streaming
- `src/features/ad/components/ADPanel.tsx` -- wired ChatMessages + ChatInput via ChatBody component

### Session 4 (uncommitted)

- `src/features/ad/context/ad-context.tsx` -- ADContextProvider with register/unregister pattern, route-aware system prompt builder, useADContext + useRegisterADContext hooks
- `src/components/DashboardLayout.tsx` -- wrapped in ADContextProvider
- `src/features/ad/hooks/useADChat.ts` -- system prompt injection into `client.messages.stream()`, clearHistory exposed
- `src/features/ad/components/ADPanel.tsx` -- clear chat button wired via clearHistory
- `src/features/storyboard/hooks/useStoryboardADContext.ts` -- registers storyboard state (status, prompt, scenes, characters, generating states) into AD context
- `src/features/ai-images/hooks/useAiImagesADContext.ts` -- registers AI images state (prompt, models, aspect ratio, credits, gallery size) into AD context
- `src/routes/dashboard/storyboard.tsx` -- calls useStoryboardADContext(sb)
- `src/routes/dashboard/ai-images.tsx` -- calls useAiImagesADContext(page)

## Key decisions

- Same useSyncExternalStore pattern as sidebar/ad-open for API key storage
- `useClaudeClient` is a thin useMemo wrapper -- single abstraction point for future OAuth swap
- Streaming uses `stream.on('text', ...)` + `stream.finalMessage()` per SDK best practices
- rAF throttling prevents excessive renders during fast streaming
- Chat history separated from chat logic for clean persistence boundary
- Markdown rendered via `marked.parse()` with Tailwind prose classes scoped to `.ad-prose`
- Context uses register/unregister pattern so features opt-in without AD knowing about them
- System prompt built from base personality + route description + registered feature summaries
- Feature context hooks are co-located with their features (not centralized in AD)
- Route descriptions map common dashboard paths to human-readable descriptions

## Last file edited

`src/features/ad/context/ad-context.tsx`
