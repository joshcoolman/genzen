import sharp from 'sharp'
import { first, sql } from './db.server'
import { justifiedLayout } from '#/lib/justified-rows'
import { createImageStorage } from '#/lib/image-storage'
import { countedBaseName } from '#/lib/download-name'

/**
 * One sheet of several pictures, for use as a single reference image (#476).
 *
 * **Cell count is the budget, not pixels.** A reference gets downscaled by the
 * model before it looks at anything -- somewhere around a 1024-1536 long edge
 * is the realistic assumption -- so a bigger sheet is not more detail, it is
 * the same detail squeezed harder. Eleven cells at that size leaves a face
 * inside a full-body shot around 40px, which is gone; six cells leaves a
 * head-and-shoulders crop around 250px, which is not. So the sheet is built at
 * 2048 and the number of cells is the thing that decides whether it works.
 *
 * With justified rows that budget is arithmetic rather than a surprise: a cell
 * is about `2048 / sqrt(A)` tall, where `A` is the sum of the aspect ratios. Six
 * square cells are ~836px each, eleven ~617px, forty ~324px.
 */
const LONG_EDGE = 2048

/** Four at a time: the originals are full-res, and forty of them arriving at
 *  once is a spike in memory for no gain in wall-clock. */
const CONCURRENCY = 4

/**
 * Deliberately uncapped cell count (that is what V1 is for), but not
 * deliberately unbounded memory. The sheet itself is bounded now -- it is never
 * larger than `LONG_EDGE` square -- so what is left to bound is the originals
 * being decoded to measure and scale them. This refuses first and says what to
 * do about it.
 */
const MAX_SOURCE_PIXELS = 400_000_000

/** High enough that the sheet is not what limits a likeness -- the cell size
 *  is (see the note on the long edge). Measured on a twelve-cell sheet: 95
 *  lands at ~1.1MB, 90 at ~0.8MB, and the PNG it replaced at 9MB. */
const JPEG_QUALITY = 95

export interface ReferenceSheet {
  /** JPEG, not PNG (#482). The sheet is a photographic composite on opaque
   *  black, which PNG stores at around 9MB for twelve cells and JPEG at ~1MB
   *  -- and the app's own upload path could not take the 9MB one back, which
   *  is the loop this feature exists for. Quality 95 is indistinguishable at
   *  the cell sizes that decide anything, and every model downscales the sheet
   *  before it looks at it. The cells composited into it stay lossless PNG;
   *  only the encode on the way out is lossy, so nothing is compressed twice. */
  image: Buffer
  cells: number
  width: number
  height: number
  rows: number
  /** The height of a cell in the first row, in sheet pixels. */
  cellHeight: number
  fill: number
  /** The group every selected image sits in, if they all sit in one. Names the
   *  file; absent for a selection made at top level or across groups. */
  groupName: string | null
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
 * **Nothing is cropped, and every cell is scaled rather than placed at its
 * source resolution.** Placing at native size made cell area a function of
 * which model made the picture -- a 1536x768 frame took twice the sheet of a
 * 720x1280 one, and two pictures of the same shape came out different sizes.
 * Aspect ratios are kept exactly; only scale changes. Black rather than white
 * or transparent: it is the quietest background to hand a model, and a
 * transparent PNG flattens to white in enough places to be a surprise.
 *
 * Ids are filtered by `userId` here, not by the caller.
 */
export async function buildReferenceSheet(
  userId: string,
  imageIds: Array<string>,
): Promise<ReferenceSheet> {
  if (imageIds.length === 0) throw new Error('No images selected')

  const rows = await sql<
    Array<{ id: string; storage_path: string | null; group_id: string | null }>
  >`
    select id, storage_path, group_id
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

  const groupName = await sheetGroupName(userId, rows)

  const storage = createImageStorage()
  const sources = await mapWithConcurrency(paths, CONCURRENCY, async (path) => {
    try {
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
      return width && height ? { buffer, width, height } : null
    } catch {
      // **One unreadable row must not cost the whole sheet.** The library holds
      // video alongside stills, and a clip in the selection made sharp throw on
      // the first buffer it saw -- so a sheet of ten pictures failed outright
      // because an eleventh thing was not a picture. Skipped rather than
      // reported: the count in the filename and the toast is what actually
      // landed, so the sheet says how many it is made of.
      return null
    }
  })

  const usable = sources.filter((source) => source !== null)
  if (usable.length === 0) throw new Error('No readable images')

  const pixels = usable.reduce((sum, s) => sum + s.width * s.height, 0)
  if (pixels > MAX_SOURCE_PIXELS) {
    throw new Error(
      'That is more image than one sheet can hold. Select fewer and try again.',
    )
  }

  const layout = justifiedLayout(usable, LONG_EDGE)

  // Each cell is scaled to its own box before anything is composited. That is
  // what makes the sheet's size independent of the sources' -- and it also
  // sidesteps sharp resizing before it composites whatever order the calls are
  // written in, which is what made the earlier native-size version need a
  // second full-sheet pass over a canvas many times this one's area.
  const cells = await mapWithConcurrency(
    layout.placements,
    CONCURRENCY,
    async (placement) => ({
      input: await sharp(usable[placement.index].buffer)
        // `fill` rather than `inside`: the box already carries the image's own
        // aspect, so the only difference is a rounded pixel, and `inside` would
        // answer with a box a pixel short of the one being placed.
        .resize(placement.width, placement.height, { fit: 'fill' })
        .png()
        .toBuffer(),
      left: placement.x,
      top: placement.y,
    }),
  )

  const image = await sharp({
    create: {
      width: layout.width,
      height: layout.height,
      channels: 3,
      background: { r: 0, g: 0, b: 0 },
    },
  })
    .composite(cells)
    // `mozjpeg` for the smaller file at the same quality; the sheet is built
    // once and then travels, so the extra encode time is not the cost that
    // matters.
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer()

  const { width = 0, height = 0 } = await sharp(image).metadata()

  return {
    image,
    cells: usable.length,
    width,
    height,
    rows: layout.rows,
    /** What one cell is worth, which is the number that decides whether a
     *  sheet still holds a likeness -- see the note on the long edge. */
    cellHeight: layout.placements[0]?.height ?? 0,
    fill: layout.fill,
    groupName,
  }
}

/**
 * The one group every selected image is in, or null.
 *
 * Derived from the rows rather than taken from the caller: the client knows
 * which group is open, but a name that ends up on a file the user keeps should
 * come from the same query that authorised the images. A selection spanning two
 * groups, or made at top level, has no single name and gets the generic one.
 */
async function sheetGroupName(
  userId: string,
  rows: Array<{ group_id: string | null }>,
): Promise<string | null> {
  const groupIds = new Set(rows.map((row) => row.group_id))
  if (groupIds.size !== 1) return null
  const [groupId] = [...groupIds]
  if (!groupId) return null

  const found = first(
    await sql<Array<{ name: string }>>`
      select name from image_groups
      where id = ${groupId} and user_id = ${userId}
    `,
  )
  return found?.name ?? null
}

/**
 * `select-one-11imgs.jpg`, or `reference-sheet-11imgs.jpg` outside a group.
 *
 * **The count is in the name because otherwise the experiment has no record.**
 * V1 is uncapped on purpose -- the technical ceiling is far past the useful one,
 * so "select a lot and see if it chokes" produces no signal: forty images
 * composite fine and look fine, and the only symptom is weaker generations later
 * with nothing connecting the two. Comparing a 6-image run against a 12-image
 * one is then reading two filenames.
 *
 * Nothing else rides along. The sheet's pixel dimensions are derivable and are
 * not what anyone compares, and cell size -- the number that actually predicts
 * whether a likeness survives -- is read once, on the way out, so it is a toast
 * rather than something to sort a folder by.
 */
export function referenceSheetFileName(sheet: ReferenceSheet): string {
  return `${countedBaseName(sheet.groupName, sheet.cells, 'reference-sheet')}.jpg`
}
