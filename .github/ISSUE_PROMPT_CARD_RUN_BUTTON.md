# Feature: "Run it" button on PromptCard in AI Images context

## Problem

When using the AD chat assistant on the AI Images page, the workflow to use a generated prompt requires multiple manual steps:

1. User asks AD for a prompt
2. AD generates a PromptCard with the prompt
3. User clicks "Copy"
4. User closes the AD panel to access the AI Images UI
5. User pastes the prompt into the prompt input
6. User clicks generate

This breaks the conversational flow and requires UI gymnastics (closing panel, finding input, pasting).

## Proposed Solution

Add a **"Run it"** button to PromptCard components when the user is on the AI Images page (`/ai-images`).

### Behavior

When clicked, the "Run it" button should:

1. Take the prompt text from the PromptCard
2. Close the AD panel
3. Fill the prompt input in the AI Images generator
4. Trigger image generation with current settings (model, aspect ratio, etc.)

### User Flow

```
User: "Give me a Blade Runner prompt"
AD: [conversational response]
    [PromptCard with Copy, Save, and "Run it" buttons]
User: *clicks "Run it"*
→ AD panel closes
→ Prompt appears in AI Images input
→ Generation starts automatically
```

### Implementation Notes

**Context Detection:**

- Use `useLocation()` to check if current route is `/ai-images`
- Only show "Run it" button when on AI Images page
- Keep Copy/Save buttons everywhere

**Integration Points:**

- `src/features/ai-images/` - Need access to prompt setter and generate function
- `src/features/ad/components/ChatMessages.tsx` - PromptCard needs route awareness and generate handler
- Consider using `useADContext()` to pass feature-specific actions

**Optional Enhancements (future):**

- Allow setting model/aspect ratio from chat (e.g., "run it with FLUX 1.1 Pro at 16:9")
- Show generation progress in chat
- Allow variations/iterations without closing panel
- Extend to other features (Canvas, Scenes, etc.)

**Benefits:**

- Keeps user in conversational flow
- Reduces clicks from 6 steps to 1
- Makes AD feel more integrated with the app
- Happy path: chat → generate without touching UI

## Context

This enhancement builds on the newly implemented tool calling system for AD chat. The PromptCard component is rendered via the `create_prompt_card` tool and already has Copy/Save actions. Adding context-aware actions is a natural extension.

## Priority

**Medium** - Nice quality-of-life improvement that enhances the conversational workflow, but not blocking current functionality.
