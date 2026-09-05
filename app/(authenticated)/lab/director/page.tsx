import { View } from './view'
import { resolveAuth } from '#/lib/server/auth.server'

export default async function DirectorPage() {
  const { userId } = await resolveAuth()
  return <View owner={userId} />
}
