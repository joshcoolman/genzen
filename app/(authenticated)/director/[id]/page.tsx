import { notFound } from 'next/navigation'
import { getSession } from '../_lib/sessions.server'
import { View } from './view'
import { resolveAuth } from '#/lib/server/auth.server'

export default async function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { userId } = await resolveAuth()
  const session = await getSession(userId, (await params).id)
  if (!session) notFound()
  return <View key={session.id} initial={session} />
}
