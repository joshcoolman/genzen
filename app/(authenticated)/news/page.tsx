import { listNewsPosts } from './_actions/news'
import { View } from './view'

export default async function News() {
  const initial = await listNewsPosts()
  return <View initial={initial} />
}
