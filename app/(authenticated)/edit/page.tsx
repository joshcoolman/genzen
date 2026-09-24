import { listEdits } from './_lib/edits.server'
import { View } from './view'
import { resolveAuth } from '#/lib/server/auth.server'

export default async function EditPage() {
  const { userId } = await resolveAuth()
  return <View initial={await listEdits(userId)} />
}
