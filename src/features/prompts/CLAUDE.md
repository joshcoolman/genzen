# Prompts

Personal prompt library accessible as a bottom sheet from the universal toolbar. Stores reusable prompts with copy-to-clipboard. Ships with seeded defaults per user.

## Key Files

- `defaults.ts` -- Default prompts (seeded on first access). Add new defaults here.
- `types.ts` -- UserPrompt type matching `user_prompts` table
- `server/list-prompts.server.ts` -- List + auto-seed defaults on first access
- `server/save-prompt.server.ts` -- Insert user prompt
- `server/delete-prompt.server.ts` -- Delete prompt by id
- `server/restore-defaults.server.ts` -- Re-insert missing defaults by `default_key`
- `hooks/use-prompt-sheet.ts` -- Sheet state + CRUD operations
- `components/PromptSheet.tsx` -- Bottom sheet UI with prompt cards

## No Route

Not a sidebar page. Rendered at layout level in `DashboardLayout.tsx`, triggered from StatusBar toolbar.

## DB Table

`user_prompts` with `is_default` flag and `default_key` for restore detection. RLS: user owns rows.

## Integration

StatusBar (`src/features/status-bar/`) has a Prompts button that opens the sheet.
