import { notFound } from 'next/navigation'
import { getNewsPost } from '../_actions/news'
import { PostView } from './view'

export default async function NewsPost({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const post = await getNewsPost(id)
  if (!post) notFound()
  return <PostView post={post} />
}
