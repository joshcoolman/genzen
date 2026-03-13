export interface Note {
  id: string
  user_id: string
  title: string
  content: string
  created_at: string
  updated_at: string
}

export interface NoteListItem {
  id: string
  title: string
  created_at: string
  updated_at: string
}
