## Overview

A floating pill-shaped toolbar at the bottom-left with quick actions: open AD chat, open prompt library, and show scenes generation progress. Replaces the old ADToggle FAB. Only visible when authenticated.

## How It Works

1. Chat button toggles AD sidebar via `useADOpen()`
2. Prompts button opens prompt library bottom sheet (callback from DashboardLayout)
3. ScenesProgress polls localStorage for pending scene generations, links to `/dashboard/scenes`

## Usage

- Always visible at bottom-left when logged in
- Click Chat to toggle AD, Prompts to open library
- Pulsing dot indicates active scene generation

## Key Files

- `src/features/status-bar/components/StatusBar.tsx` -- Toolbar: Chat (AD toggle), Prompts (bottom sheet), ScenesProgress
- `src/features/status-bar/components/items/ScenesProgress.tsx` -- Pending scene count with pulsing dot, polls localStorage every 2s

## Dependencies

- `@/lib/use-ad-open` -- AD panel toggle
- `@/features/scenes/constants` -- SCENE_STORAGE_KEY for progress tracking
