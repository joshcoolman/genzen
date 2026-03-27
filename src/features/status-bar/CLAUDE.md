# Status Bar

Fixed bottom-right floating bar showing contextual hints and real-time indicators to authenticated users.

## Key Files

- `index.ts` -- Re-exports `StatusBar` component
- `components/StatusBar.tsx` -- Pill-shaped container (animated, bottom-right); composes ScenesProgress + SpotlightHint; only renders when logged in
- `components/StatusBarItem.tsx` -- Generic item wrapper (renders as button if clickable, div otherwise)
- `components/items/SpotlightHint.tsx` -- Displays Cmd+K keyboard shortcut hint
- `components/items/ScenesProgress.tsx` -- Shows pending scene generation count; polls localStorage every 2s; links to `/dashboard/scenes`; animated pulsing dot

## Shared Dependencies

- `@/lib/auth` -- `useAuth()` to gate visibility behind authentication
- `@tanstack/react-router` -- `Link` component (used in ScenesProgress)
- `@/features/scenes/constants` -- `SCENE_STORAGE_KEY` for reading scene generation status from localStorage

## Quirks / Notes

- ScenesProgress uses localStorage polling (2-second intervals) rather than state management for lightweight real-time updates
- StatusBar is a composition container rendering multiple independent item components
