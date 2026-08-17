import { View } from './view'
import { getUserTheme } from '#/features/theme/theme-store.server'
import { resolveAuth } from '#/lib/server/auth.server'

// The server half of the seam Trash established: the row is read here and
// handed down, so the client never fetches its own starting state.
export default async function Style() {
  const { userId } = await resolveAuth()
  const core = await getUserTheme(userId)

  return <View core={core} />
}
