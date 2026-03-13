export interface ADMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}
