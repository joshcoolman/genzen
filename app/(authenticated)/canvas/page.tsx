import { loadCanvasState } from './_actions/canvas'
import { InfiniteCanvas } from './_components/infinite-canvas/infinite-canvas'

// Reads on the server and seeds the view, per `docs/reference/route-shape.md`.
// The canvas has no skeleton and no empty first paint: every member's position
// and public URL is resolved before the first render (#212).
export default async function CanvasPage() {
  const initial = await loadCanvasState()
  return <InfiniteCanvas initial={initial} />
}
