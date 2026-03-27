# Notes

Persist AD chat conversations as markdown snapshots for review and context injection.

## Key Files

- `types.ts` -- Note (full record), NoteListItem (summary for lists)
- `components/NotesPage.tsx` -- list UI with expand (lazy-loads content), load-into-AD, and two-step delete confirmation
- `server/save-note.server.ts` -- insert note via Supabase
- `server/list-notes.server.ts` -- fetch user's notes (newest first by created_at; RLS filters to current user)
- `server/load-note.server.ts` -- fetch single note by id
- `server/delete-note.server.ts` -- delete note

## Route

`src/routes/dashboard/notes.tsx`

## Server Pattern

All server functions use `createServerFn()` from `@tanstack/react-start`, require auth via `requireAuth(accessToken)`, and create a Supabase client with bearer token for RLS.

## Integration with AD

- Notes saved from `ADPanel` via `saveNote()` -- content format managed by the caller (markdown with **User:** and **AD:** sections)
- "Load into AD" button calls `setLoadedNote()` from ADContext, injecting the note into the system prompt
- Loading also triggers `setIsOpen(true)` via `useADOpen()` from `@/lib/use-ad-open`

## Shared Dependencies

- `@tanstack/react-start` -- createServerFn
- `@supabase/supabase-js` -- DB queries
- `@/lib/server/auth.server` -- requireAuth
- `@/lib/auth` -- useAuth
- `@/features/ad/context/ad-context` -- useADContext for setLoadedNote
- `@/lib/use-ad-open` -- useADOpen for opening AD panel
- `lucide-react` -- Icons (BookOpen, Loader2, Trash2, Upload, X)

## Quirks / Notes

- Note content is lazy-loaded only when user expands a note (list query omits content field)
- Delete uses two-step confirmation to prevent accidental deletion
- Relative timestamps shown (e.g., "2h ago", "3d ago") via `relativeDate()` helper
