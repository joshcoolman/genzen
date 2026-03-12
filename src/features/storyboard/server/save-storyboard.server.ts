import { createServerFn } from '@tanstack/react-start'
import { createClient } from '@supabase/supabase-js'
import type { Scene, StoryboardStatus } from '../types'
import { requireAuth } from '@/lib/server/auth.server'

interface SaveStoryboardInput {
  accessToken: string
  id?: string
  title?: string
  story_prompt: string
  refined_story?: string | null
  scenes: Array<Scene>
  status: StoryboardStatus
}

export const saveStoryboard = createServerFn({ method: 'POST' })
  .inputValidator((data: SaveStoryboardInput) => data)
  .handler(async ({ data }) => {
    const user = await requireAuth(data.accessToken)

    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.VITE_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: { Authorization: `Bearer ${data.accessToken}` },
        },
      },
    )

    const row = {
      user_id: user.id,
      title: data.title ?? 'Untitled',
      story_prompt: data.story_prompt,
      refined_story: data.refined_story ?? null,
      scenes: JSON.stringify(data.scenes),
      status: data.status,
    }

    if (data.id) {
      const { data: updated, error } = await supabase
        .from('storyboards')
        .update(row)
        .eq('id', data.id)
        .select()
        .single()

      if (error) throw new Error(`Save failed: ${error.message}`)
      return { storyboard: updated }
    }

    const { data: inserted, error } = await supabase
      .from('storyboards')
      .insert(row)
      .select()
      .single()

    if (error) throw new Error(`Save failed: ${error.message}`)
    return { storyboard: inserted }
  })
