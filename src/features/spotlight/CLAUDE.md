Cmd+K spotlight navigation dialog for jumping between pages.

## Key Files

- `components/SpotlightNav.tsx` -- CommandDialog with Cmd+K hotkey, filters nav items, navigates on select
- `lib/spotlight-items.ts` -- Builds searchable item list from nav-items plus extra routes (Home, Docs)

## Shared Dependencies

- `@/lib/nav-items` -- Dashboard navigation items (label, href, icon)
- `@/lib/auth` -- useAuth (only renders when logged in)
- `@/components/ui/command` -- shadcn CommandDialog, CommandInput, CommandItem, CommandList

## Quirks / Notes

- Only renders when user is authenticated
- Uses @tanstack/react-hotkeys for Cmd+K binding
