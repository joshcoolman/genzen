import sharp from 'sharp'
import { sql } from './db.server'
import { bestLayout } from '#/lib/shelf-pack'
import { createImageStorage } from '#/lib/image-storage'

/**
 * One sheet of several pictures, for use as a single reference image (#476).
 *
 * **Cell count is the budget, not pixels.** A reference gets downscaled by the
 * model before it looks at anything -- somewhere around a 1024-1536 long edge
 * is the realistic assumption -- so a bigger sheet is not more detail, it is
 * the same detail squeezed harder. Eleven cells at that size leaves a face
 * inside a full-body shot around 40px, which is gone; six cells leaves a
 * head-and-shoulders crop around 250px, which is not. So the sheet is built at
 * ~2048 and the number of cells is the thing that decides whether it works.
 */
const LONG_EDGE = 2048

/** Four at a time: the originals are full-res, and forty of them arriving at
 *  once is a spike in memory for no gain in wall-clock. */
const CONCURRENCY = 4

/**
 * Deliberately uncapped cell count (that is what V1 is for), but not
 * deliberately unbounded memory. sharp refuses an image over ~268MP and the
 * packed sheet is the biggest thing here -- roughly the source area over the
 * fill ratio. This refuses first, at a size that leaves room, and says what to
 * do about it.
 */
const MAX_PACKED_PIXELS = 250_000_000

export interface ReferenceSheet {
  png: Buffer
  cells: number
  width: number
  height: number
  /** The layout before the sheet was scaled down -- what the packer decided,
   *  which is not what the file ends up being. */
  packedWidth: number
  packedHeight: number
  fill: number
}

async function mapWithConcurrency<T, TResult>(
  items: Array<T>,
  limit: number,
  fn: (item: T) => Promise<TResult>,
): Promise<Array<TResult>> {
  const results = new Array<TResult>(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i])
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  )
  return results
}

/**
 * Composite the given images, in the order given, onto one black sheet.
 *
 * Nothing is cropped and nothing is resized on the way in -- the packer works
 * at native size and the finished sheet is scaled once at the end, so every
 * cell keeps its share of the result. Black rather than white or transparent:
 * it is the quietest background to hand a model, and a transparent PNG
 * flattens to white in enough places to be a surprise.
 *
 * Ids are filtered by `userId` here, not by the caller.
 */
export async function buildReferenceSheet(
  userId: string,
  imageIds: Array<string>,
): Promise<ReferenceSheet> {
  if (imageIds.length === 0) throw new Error('No images selected')

  const rows = await sql<Array<{ id: string; storage_path: string | null }>>`
    select id, storage_path
    from user_images
    where user_id = ${userId}
      and id = any(${imageIds})
      and storage_path is not null
  `

  // The selection's own order, not the database's: the sheet should read the
  // way the grid did.
  const byId = new Map(rows.map((row) => [row.id, row]))
  const paths = imageIds
    .map((id) => byId.get(id)?.storage_path)
    .filter((path): path is string => !!path)

  if (paths.length === 0) throw new Error('No images found')

  const storage = createImageStorage()
  const sources = await mapWithConcurrency(paths, CONCURRENCY, async (path) => {
    const file = await storage.download(path)
    // `rotate()` with no argument applies the EXIF orientation and drops the
    // tag. Without it a phone upload packs at its stored dimensions and then
    // lands in the sheet turned on its side -- the one way this could crop
    // something without ever calling a crop.
    const buffer = await sharp(Buffer.from(await file.arrayBuffer()))
      .rotate()
      .png()
      .toBuffer()
    const { width = 0, height = 0 } = await sharp(buffer).metadata()
    return { buffer, width, height }
  })

  const usable = sources.filter((source) => source.width && source.height)
  if (usable.length === 0) throw new Error('No readable images')

  const layout = bestLayout(usable)
  if (layout.width * layout.height > MAX_PACKED_PIXELS) {
    throw new Error(
      'That is more image than one sheet can hold. Select fewer and try again.',
    )
  }

  // Two passes, and it has to be two: sharp resizes before it composites
  // whatever order the calls are written in, so a single chain shrinks the
  // black canvas first and then refuses every full-res cell as too large to
  // fit it.
  const packed = await sharp({
    create: {
      width: layout.width,
      height: layout.height,
      channels: 3,
      background: { r: 0, g: 0, b: 0 },
    },
  })
    .composite(
      layout.placements.map((placement) => ({
        input: usable[placement.index].buffer,
        left: placement.x,
        top: placement.y,
      })),
    )
    .png()
    .toBuffer()

  const png = await sharp(packed)
    .resize(LONG_EDGE, LONG_EDGE, { fit: 'inside', withoutEnlargement: true })
    .png()
    .toBuffer()

  const { width = 0, height = 0 } = await sharp(png).metadata()

  return {
    png,
    cells: usable.length,
    width,
    height,
    packedWidth: layout.width,
    packedHeight: layout.height,
    fill: layout.fill,
  }
}

/**
 * `reference-sheet-12cells-1861x2048.png`.
 *
 * **The parameters are in the filename because otherwise the experiment has no
 * record.** V1 is uncapped on purpose -- the technical ceiling is far past the
 * useful one, so "select a lot and see if it chokes" produces no signal: forty
 * cells composites fine and looks fine, and the only symptom is weaker
 * generations later with nothing connecting the two. Comparing a 6-cell run
 * against a 12-cell one is then reading two filenames.
 */
export function referenceSheetFileName(sheet: ReferenceSheet): string {
  return `reference-sheet-${sheet.cells}cells-${sheet.width}x${sheet.height}.png`
}
