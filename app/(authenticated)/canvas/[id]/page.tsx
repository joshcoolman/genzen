import { notFound } from 'next/navigation'
import { loadCanvasState } from './_actions/canvas'
import { View } from './view'

// Reads on the server and seeds the view, per `docs/reference/route-shape.md`.
// The canvas has no skeleton and no empty first paint: every member's position
// and public URL is resolved before the first render (#212).
//
// A board is addressable now (#446), so this is the first canvas page that can
// be asked for something that is not there. An id this user does not own 404s
// exactly like one that never existed -- the read returns null either way, so
// the page cannot leak the difference.
export default async function CanvasPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const initial = await loadCanvasState(id)
  if (!initial) notFound()

  return <View initial={initial} />
}
