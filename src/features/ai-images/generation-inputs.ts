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
  /** What the library calls it. Null when the row is gone. Needed by anything
   *  that puts the image back in the panel, where the strip labels it (#382);
   *  Activity's own strip does not use it. */
  title: string | null
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
 * **The source comes first, and that is the order the model saw** (#382). The
 * panel holds one ordered set and the submit splits it at index 0:
 * `sourceImageId = primary.id`, `referenceImageIds = the rest`
 * (`use-generator.ts`), and the server concatenates them back in that order
 * before FAL sees them (`allImageUrls`). So a row carrying both is not rare --
 * it is what every generation from a set of two or more looks like.
 *
 * This used to return the references first and append the source, which put
 * the image the aspect ratio was derived from at the *end* of a list meant to
 * be "what went in, in order". Harmless while the only reader was a display
 * strip; not harmless once a reader loads the set back into the panel, where
 * index 0 is load-bearing.
 */
export function generationInputIds(metadata: unknown): Array<string> {
  if (!metadata || typeof metadata !== 'object') return []
  const m = metadata as {
    reference_image_ids?: unknown
    source_image_id?: unknown
  }

  const ids: Array<string> = []
  if (typeof m.source_image_id === 'string' && m.source_image_id.length > 0) {
    ids.push(m.source_image_id)
  }
  ids.push(...stringArray(m.reference_image_ids))

  return [...new Set(ids)]
}
