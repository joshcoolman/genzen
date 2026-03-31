import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/supabase'

let adminClient: ReturnType<typeof createClient<Database>> | null = null

export function getSupabaseAdmin() {
  if (!adminClient) {
    adminClient = createClient<Database>(
      process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
  }
  return adminClient
}
