## Overview

AD is a right-sidebar chat panel powered by Claude Sonnet that provides context-aware creative assistance. It understands which page the user is on, what feature they're using, and can see images via paste/drag-drop (vision). Conversations can be saved as markdown notes and loaded back for continuity.

## How It Works

1. ADContextProvider wraps the app in `__root.tsx`
2. System prompt assembled from: base prompt + route description + feature contexts + loaded note
3. Features register context via `useRegisterADContext(key, summary)` -- auto-unregisters on unmount
4. Messages streamed from Claude Sonnet via Anthropic SDK (browser-side, user's API key)
5. Chat history persisted to localStorage (50 messages, image data stripped)

## Usage

- Click the AD toggle button (bottom-right) to open the sidebar
- Enter your Anthropic API key on first use
- Chat naturally; AD knows which page you're on
- Paste or drag images into the chat for vision analysis
- Save conversations as notes for later reference

## Key Files

- `src/features/ad/context/ad-context.tsx` -- ADContext provider: route tracking, feature context map, system prompt assembly
- `src/features/ad/hooks/useADChat.ts` -- Message streaming with rAF-throttled updates, abort support, multimodal image handling
- `src/features/ad/hooks/useChatHistory.ts` -- localStorage persistence (50 msg cap, strips image base64)
- `src/features/ad/hooks/useAnthropicKey.ts` -- API key management (`sk-ant-` prefix)
- `src/features/ad/components/ADPanel.tsx` -- Fixed right-sidebar (640px on md+) with chat body, copy/save/clear
- `src/features/ad/components/ADToggle.tsx` -- Floating toggle button (bottom-right), hidden on mobile
- `src/features/ad/components/ChatInput.tsx` -- Auto-growing textarea with image paste/drag-drop

## Dependencies

- `@anthropic-ai/sdk` -- Claude Sonnet streaming (claude-sonnet-4-6, max 4096 tokens)
- `marked` -- Markdown rendering for responses
- `@/features/notes/` -- Save/load chat as markdown notes

## Configuration

- API key stored in browser localStorage only (never sent to server)
