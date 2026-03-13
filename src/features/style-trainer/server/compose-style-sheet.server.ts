/**
 * Composes style collection images into contact sheet grids for use as
 * reference images during generation. If <=14 images, returns them directly.
 * If >14, tiles them into grid composites (~12 per sheet).
 */
import sharp from 'sharp'

const MAX_DIRECT_REFS = 14
const TILE_SIZE = 256
const IMAGES_PER_SHEET = 12

/**
 * Given raw image buffers, returns an array of buffers:
 * - If count <= MAX_DIRECT_REFS: returns the original buffers as-is
 * - If count > MAX_DIRECT_REFS: tiles into grid composites
 */
export async function composeStyleSheets(
  imageBuffers: Array<Buffer>,
): Promise<Array<Buffer>> {
  if (imageBuffers.length <= MAX_DIRECT_REFS) {
    return imageBuffers
  }

  // Split into chunks and compose each chunk into a grid
  const sheets: Array<Buffer> = []
  for (let i = 0; i < imageBuffers.length; i += IMAGES_PER_SHEET) {
    const chunk = imageBuffers.slice(i, i + IMAGES_PER_SHEET)
    const sheet = await composeGrid(chunk)
    sheets.push(sheet)
  }

  return sheets
}

async function composeGrid(imageBuffers: Array<Buffer>): Promise<Buffer> {
  const count = imageBuffers.length
  const cols = Math.ceil(Math.sqrt(count))
  const rows = Math.ceil(count / cols)

  const width = cols * TILE_SIZE
  const height = rows * TILE_SIZE

  // Resize all images to tiles
  const tiles = await Promise.all(
    imageBuffers.map((buf) =>
      sharp(buf)
        .resize(TILE_SIZE, TILE_SIZE, { fit: 'cover' })
        .jpeg({ quality: 85 })
        .toBuffer(),
    ),
  )

  // Compose into grid
  const composites = tiles.map((tile, i) => ({
    input: tile,
    left: (i % cols) * TILE_SIZE,
    top: Math.floor(i / cols) * TILE_SIZE,
  }))

  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 0, g: 0, b: 0 },
    },
  })
    .composite(composites)
    .jpeg({ quality: 90 })
    .toBuffer()
}
