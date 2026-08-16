/**
 * What images went into a generation.
 *
 * The same fact is written under different names depending on which path
 * submitted the work (`generate-image-internal.server.ts`), so every surface
 * that wants "what did this come from" has to read all of them:
 *
 * | Writer input       | Stored as                      |
 * | ------------------ | ------------------------------ |
 * | `referenceImageIds`| `reference_image_ids`          |
 * | `sourceImageId`    | `source_image_id`              |
 * | `parentImageId`    | `source_image_id` + `parent_id`|
 *
 * Reading only one of them is why Activity's References block looked broken:
 * it read `reference_image_ids`, and an edit through a model's image endpoint
 * records its input as `source_image_id` instead. Both were always written;
 * only one was ever displayed.
 */

/** An input image, resolved against the library. */
export interface GenerationInputImage {
  id: string
  /** Null when the row is gone entirely, or never had bytes. */
  storagePath: string | null
  /** In Trash. The image is still shown, marked -- knowing the input was
   *  thrown away is the useful part, and hiding it would silently shorten the
   *  list. */
  isDeleted: boolean
}

function stringArray(value: unknown): Array<string> {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === 'string' && v.length > 0)
    : []
}

/**
 * Every image id this generation was given, in the order it was given them,
 * de-duplicated.
 *
 * Reads two fields and deliberately not the other two lineage keys:
 *
 * - **`parent_id` is excluded.** It is the mutable grouping parent and only
 *   happens to equal `source_image_id` at write time. It answers "what is this
 *   filed under", not "what went in", and a re-parented row would list an
 *   image that was never sent to the model.
 * - **`root_image_id` is excluded.** It is the far end of a variation chain,
 *   which is ancestry rather than input -- the thing multi-hop would walk to,
 *   not something this generation received.
 *
 * References come first because their order is the user's: index 0 is the one
 * the aspect ratio is derived from and the first submitted (#297). A row
 * carrying both is rare -- the two paths are alternatives -- so this is about
 * being defined rather than about a case that comes up.
 */
export function generationInputIds(metadata: unknown): Array<string> {
  if (!metadata || typeof metadata !== 'object') return []
  const m = metadata as {
    reference_image_ids?: unknown
    source_image_id?: unknown
  }

  const ids = stringArray(m.reference_image_ids)
  if (typeof m.source_image_id === 'string' && m.source_image_id.length > 0) {
    ids.push(m.source_image_id)
  }

  return [...new Set(ids)]
}
