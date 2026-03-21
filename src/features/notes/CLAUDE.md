# Notes

Persist AD chat conversations as markdown snapshots for review and context injection.

## Key Files

- `types.ts` -- Note (full record), NoteListItem (summary for lists)
- `components/NotesPage.tsx` -- list UI with expand, load-into-AD, and delete actions
- `server/save-note.server.ts` -- insert note via Supabase
- `server/list-notes.server.ts` -- fetch user's notes (newest first)
- `server/load-note.server.ts` -- fetch single note by id
- `server/delete-note.server.ts` -- delete note

## Route

`src/routes/dashboard/notes.tsx`

## Server Pattern

All server functions use `createServerFn()` from `@tanstack/react-start`, require auth via `requireAuth(accessToken)`, and create a Supabase client with bearer token for RLS.

## Integration with AD

- Notes saved from `ADPanel` via `saveNote()` -- markdown format: `**User:**\n{content}\n\n**AD:**\n{response}`
- "Load into AD" button calls `setLoadedNote()` from ADContext, injecting the note into the system prompt
- Opening AD panel is triggered alongside loading

## Shared Dependencies

- `@tanstack/react-start` -- createServerFn
- `@supabase/supabase-js` -- DB queries
- `@/lib/server/auth.server` -- requireAuth
- `@/lib/auth` -- useAuth
- `@/features/ad/context/ad-context` -- useADContext, useADOpen for load-into-AD
