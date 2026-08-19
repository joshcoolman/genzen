import { listCanvases } from './_actions/canvases'
import { View } from './view'

// The index (#446). `/canvas` used to be the one board; it is now the list of
// them, and a board lives at `/canvas/[id]`.
//
// Reads on the server and seeds the view, per `docs/reference/route-shape.md`.
export default async function CanvasIndexPage() {
  const initial = await listCanvases()
  return <View initial={initial} />
}
