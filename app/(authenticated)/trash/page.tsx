import { listTrashedImages } from './_actions/trash'
import { View } from './view'

export default async function Trash() {
  const initial = await listTrashedImages()
  return <View initial={initial} />
}
