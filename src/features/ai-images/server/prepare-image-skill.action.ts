'use server'

import { prepareImageSkillInternal } from './storyboard.server'

/** Also callable by a future image action; execution does not belong to the slash menu. */
export async function prepareImageSkill(data: {
  skillId: 'storyboard'
  brief: string
  originalInput?: string
  referenceIds: Array<string>
  models: Array<string>
  systemInstructions?: string
}) {
  return prepareImageSkillInternal(data)
}
