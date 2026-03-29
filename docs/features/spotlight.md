## Overview

A command palette for fast navigation. Opens with Cmd+K, searches across all dashboard routes plus static pages. Only renders when authenticated.

## How It Works

1. Mod+K opens the command dialog
2. Search handled by shadcn CommandInput (built-in filtering)
3. Extra routes (Home, Docs) appear before nav-items
4. Selection navigates via TanStack router

## Usage

- Press Cmd+K (Mac) or Ctrl+K (Windows/Linux)
- Type to search, select to navigate

## Key Files

- `src/features/spotlight/components/SpotlightNav.tsx` -- CommandDialog with Mod+K hotkey, navigates on select
- `src/features/spotlight/lib/spotlight-items.ts` -- SpotlightItem interface + `getSpotlightItems()` combining hardcoded routes with nav-items

## Dependencies

- `@tanstack/react-hotkeys` -- Mod+K binding
- `@/lib/nav-items` -- Dashboard navigation items
- `@/components/ui/command` -- shadcn command dialog
