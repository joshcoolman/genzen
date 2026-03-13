import { useMemo } from 'react'
import type { UseStoryboardReturn } from './useStoryboard'
import { useRegisterADContext } from '@/features/ad/context/ad-context'

export function useStoryboardADContext(sb: UseStoryboardReturn) {
  const summary = useMemo(() => {
    const parts: Array<string> = []
    parts.push(`Current storyboard state:`)
    parts.push(`- Status: ${sb.status}`)

    if (sb.storyPrompt) {
      const truncated =
        sb.storyPrompt.length > 200
          ? sb.storyPrompt.slice(0, 200) + '...'
          : sb.storyPrompt
      parts.push(`- Story prompt: "${truncated}"`)
    }

    if (sb.refinedStory) {
      parts.push(`- Story has been refined`)
    }

    if (sb.scenes.length > 0) {
      const framesReady = sb.scenes.filter((s) => s.image_id).length
      parts.push(`- ${sb.scenes.length} scenes generated`)
      parts.push(`- ${framesReady}/${sb.scenes.length} frames selected`)

      if (sb.characters.length > 0) {
        const charNames = sb.characters.map((c) => c.name).join(', ')
        parts.push(`- Characters: ${charNames}`)
      }

      if (sb.generatingSceneIds.size > 0) {
        parts.push(
          `- Currently generating frames for ${sb.generatingSceneIds.size} scene(s)`,
        )
      }
    }

    if (sb.isRefining) parts.push(`- Currently refining story`)
    if (sb.isGeneratingScenes) parts.push(`- Currently generating scenes`)
    if (sb.isGeneratingVideo) parts.push(`- Currently generating video`)
    if (sb.videoUrl) parts.push(`- Video has been generated`)
    if (sb.error) parts.push(`- Error: ${sb.error}`)

    return parts.join('\n')
  }, [
    sb.status,
    sb.storyPrompt,
    sb.refinedStory,
    sb.scenes,
    sb.characters,
    sb.generatingSceneIds.size,
    sb.isRefining,
    sb.isGeneratingScenes,
    sb.isGeneratingVideo,
    sb.videoUrl,
    sb.error,
  ])

  useRegisterADContext('storyboard', summary)
}
