# Status Bar

Fixed bottom-right floating bar showing contextual hints to authenticated users.

## Key Files

- `index.ts` -- Re-exports `StatusBar` component
- `components/StatusBar.tsx` -- Pill-shaped container, only renders when user is logged in
- `components/StatusBarItem.tsx` -- Generic item wrapper (renders as button if clickable, div otherwise)
- `components/items/SpotlightHint.tsx` -- Displays Cmd+K keyboard shortcut hint

## Shared Dependencies

- `@/lib/auth` -- `useAuth()` to gate visibility behind authentication
