import { View } from './view'
import { getAccountStats } from '#/lib/server/account-stats.server'
import { resolveAuth } from '#/lib/server/auth.server'

// Same seam as `/account/style`: the aggregation runs here and is handed down,
// so the client never fetches its own starting state and the figures are in the
// first byte of HTML rather than arriving after a spinner.
export default async function Account() {
  const { userId } = await resolveAuth()
  const stats = await getAccountStats(userId)

  return <View stats={stats} />
}
