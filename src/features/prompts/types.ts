export interface UserPrompt {
  id: string
  user_id: string
  title: string
  content: string
  is_default: boolean
  default_key: string | null
  created_at: string
  updated_at: string
}
