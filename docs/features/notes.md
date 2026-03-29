## Overview

Persist AD conversations as markdown notes for review and context injection. Notes can be loaded back into AD to continue previous conversations with full context.

## How It Works

1. Save from ADPanel -- content formatted as markdown with User/AD sections
2. Notes listed with lazy-loaded content (expanded on click)
3. "Load into AD" injects note into AD system prompt and opens the panel
4. Two-step delete confirmation prevents accidents

## Usage

- Save a conversation from the AD panel
- Navigate to Notes to review saved conversations
- Click "Load into AD" to resume a conversation with context

## Key Files

- `src/features/notes/types.ts` -- Note, NoteListItem types
- `src/features/notes/components/NotesPage.tsx` -- List with expand (lazy-loads content), load-into-AD, two-step delete
- `src/features/notes/server/save-note.server.ts` -- Insert note via Supabase
- `src/features/notes/server/list-notes.server.ts` -- Fetch user's notes (newest first, RLS filtered)
- `src/features/notes/server/load-note.server.ts` -- Fetch single note by id
- `src/features/notes/server/delete-note.server.ts` -- Delete note

## Dependencies

- Supabase -- note persistence with RLS
- `@/features/ad/` -- ADContext for loading notes back into chat

## Route

`/dashboard/notes`
