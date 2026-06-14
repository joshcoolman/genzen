# Status Bar (Universal Toolbar)

Fixed bottom-left floating pill with context-independent action buttons. Replaces the old ADToggle FAB and Cmd+K hint. Styled to match Canvas toolbar aesthetic.

## Key Files

- `index.ts` -- Re-exports `StatusBar` component
- `components/StatusBar.tsx` -- Toolbar with the Chat (AD toggle) button. Takes no props.

## Shared Dependencies

- `@/lib/auth` -- `useAuth()` to gate visibility behind authentication
- `@/lib/use-ad-open` -- `useADOpen()` for Chat button toggle

## Quirks / Notes

- The Prompts button and ScenesProgress widget were removed when the prompts library and scenes feature were deleted; the toolbar is now just the AD chat toggle.
