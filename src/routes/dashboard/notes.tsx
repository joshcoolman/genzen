import { createFileRoute } from '@tanstack/react-router'
import { NotesPage } from '@/features/notes/components/NotesPage'

export const Route = createFileRoute('/dashboard/notes')({
  component: NotesRoute,
})

function NotesRoute() {
  return <NotesPage />
}
