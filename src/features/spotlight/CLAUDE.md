Cmd+K / Ctrl+K spotlight navigation dialog for quickly jumping between pages.

## Key Files

- `components/SpotlightNav.tsx` -- CommandDialog with Mod+K hotkey via `useHotkey`, navigates on select
- `lib/spotlight-items.ts` -- `SpotlightItem` interface + `getSpotlightItems()` combining hardcoded routes (Home, Docs) with nav-items
- `index.ts` -- barrel export of SpotlightNav component

## Shared Dependencies

- `@tanstack/react-router` -- useNavigate for navigation
- `@tanstack/react-hotkeys` -- useHotkey for Mod+K binding
- `#/lib/nav-items` -- Dashboard navigation items (label, href, icon)
- `#/lib/auth` -- useAuth (only renders when logged in)
- `#/components/ui/command` -- shadcn CommandDialog, CommandInput, CommandItem, CommandList, CommandEmpty

## Quirks / Notes

- Only renders when user is authenticated
- Client-side search handled by shadcn CommandInput (not custom filtering)
- Extra routes (Home, Docs) appear before nav-items in results
- `SpotlightItem` has optional `keywords` field but it's not currently populated
