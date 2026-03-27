# Status Bar (Universal Toolbar)

Fixed bottom-left floating pill with context-independent action buttons. Replaces the old ADToggle FAB and Cmd+K hint. Styled to match Canvas toolbar aesthetic.

## Key Files

- `index.ts` -- Re-exports `StatusBar` component
- `components/StatusBar.tsx` -- Toolbar with Chat (AD toggle), Prompts (bottom sheet), and ScenesProgress
- `components/items/ScenesProgress.tsx` -- Shows pending scene generation count; polls localStorage every 2s; links to `/dashboard/scenes`; animated pulsing dot

## Props

- `onOpenPrompts` -- Callback to open the prompt library bottom sheet (wired in DashboardLayout)

## Shared Dependencies

- `@/lib/auth` -- `useAuth()` to gate visibility behind authentication
- `@/lib/use-ad-open` -- `useADOpen()` for Chat button toggle
- `@tanstack/react-router` -- `Link` component (used in ScenesProgress)
- `@/features/scenes/constants` -- `SCENE_STORAGE_KEY` for reading scene generation status from localStorage

## Quirks / Notes

- ScenesProgress uses localStorage polling (2-second intervals) rather than state management for lightweight real-time updates
