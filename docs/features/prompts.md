## Overview

Store reusable prompts with copy-to-clipboard. Ships with seeded defaults per user. Accessible from the status bar toolbar, not a standalone page.

## How It Works

1. First access auto-seeds default prompts from `defaults.ts`
2. Users can add, delete, and restore default prompts
3. Triggered from StatusBar toolbar (not a sidebar nav item)

## Usage

- Click the Prompts button in the bottom status bar
- Browse, copy, add, or delete prompts
- Restore defaults if deleted

## Key Files

- `src/features/prompts/defaults.ts` -- Default prompts seeded on first access
- `src/features/prompts/types.ts` -- UserPrompt type matching `user_prompts` table
- `src/features/prompts/server/list-prompts.server.ts` -- List + auto-seed defaults on first access
- `src/features/prompts/server/save-prompt.server.ts` -- Insert user prompt
- `src/features/prompts/server/delete-prompt.server.ts` -- Delete prompt by id
- `src/features/prompts/server/restore-defaults.server.ts` -- Re-insert missing defaults by `default_key`
- `src/features/prompts/hooks/use-prompt-sheet.ts` -- Sheet state + CRUD operations
- `src/features/prompts/components/PromptSheet.tsx` -- Bottom sheet UI with prompt cards

## Dependencies

- Supabase -- `user_prompts` table with RLS
- `@/features/status-bar/` -- Prompts button triggers the sheet

## Database

- `user_prompts` -- with `is_default` flag and `default_key` for restore detection
