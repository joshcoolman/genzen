import { useCallback, useEffect, useState } from 'react'
import { BookOpen, Loader2, Trash2, Upload, X } from 'lucide-react'
import { listNotes } from '../server/list-notes.server'
import { loadNote } from '../server/load-note.server'
import { deleteNote } from '../server/delete-note.server'
import type { NoteListItem } from '../types'
import { useADOpen } from '@/lib/use-ad-open'
import { useADContext } from '@/features/ad/context/ad-context'
import { useAuth } from '@/lib/auth'

function relativeDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 30) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

export function NotesPage() {
  const { session } = useAuth()
  const { setLoadedNote } = useADContext()
  const { setIsOpen } = useADOpen()
  const [notes, setNotes] = useState<Array<NoteListItem>>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [expandedContent, setExpandedContent] = useState<string | null>(null)
  const [loadingContent, setLoadingContent] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const fetchNotes = useCallback(async () => {
    if (!session?.access_token) return
    try {
      const { notes } = await listNotes({
        data: { accessToken: session.access_token },
      })
      setNotes(notes)
    } catch (err) {
      console.error('Failed to list notes:', err)
    } finally {
      setLoading(false)
    }
  }, [session?.access_token])

  useEffect(() => {
    fetchNotes()
  }, [fetchNotes])

  async function handleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null)
      setExpandedContent(null)
      return
    }
    if (!session?.access_token) return
    setExpandedId(id)
    setLoadingContent(true)
    try {
      const { note } = await loadNote({
        data: { accessToken: session.access_token, id },
      })
      setExpandedContent(note.content)
    } catch (err) {
      console.error('Failed to load note:', err)
      setExpandedContent('Failed to load note content.')
    } finally {
      setLoadingContent(false)
    }
  }

  async function handleDelete(id: string) {
    if (!session?.access_token) return
    try {
      await deleteNote({
        data: { accessToken: session.access_token, id },
      })
      setNotes((prev) => prev.filter((n) => n.id !== id))
      if (expandedId === id) {
        setExpandedId(null)
        setExpandedContent(null)
      }
    } catch (err) {
      console.error('Failed to delete note:', err)
    }
    setConfirmDeleteId(null)
  }

  async function handleLoadIntoAD(id: string) {
    if (!session?.access_token) return
    try {
      const { note } = await loadNote({
        data: { accessToken: session.access_token, id },
      })
      setLoadedNote({ id: note.id, title: note.title, content: note.content })
      setIsOpen(true)
    } catch (err) {
      console.error('Failed to load note for AD:', err)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (notes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <BookOpen className="mb-3 h-8 w-8" />
        <p className="text-sm">No saved notes yet.</p>
        <p className="text-xs">
          Save a conversation from the AD panel to see it here.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-2 p-6">
      {notes.map((note) => (
        <div key={note.id} className="rounded-lg border border-border">
          <div className="flex items-center gap-3 px-4 py-3">
            <button
              onClick={() => handleExpand(note.id)}
              className="flex-1 text-left"
            >
              <div className="text-sm font-medium">{note.title}</div>
              <div className="text-xs text-muted-foreground">
                {relativeDate(note.created_at)}
              </div>
            </button>
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleLoadIntoAD(note.id)}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                title="Load into AD"
              >
                <Upload className="h-3.5 w-3.5" />
              </button>
              {confirmDeleteId === note.id ? (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleDelete(note.id)}
                    className="rounded-md px-2 py-1 text-xs text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(null)}
                    className="rounded-md p-1 text-muted-foreground hover:bg-muted transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDeleteId(note.id)}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  title="Delete note"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
          {expandedId === note.id && (
            <div className="border-t border-border px-4 py-3">
              {loadingContent ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <pre className="whitespace-pre-wrap text-xs text-muted-foreground">
                  {expandedContent}
                </pre>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
