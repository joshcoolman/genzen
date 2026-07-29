Read-only inventory for #211: every path that creates a `user_images` row, and
what each one records. No behaviour changed to produce it.

**There are exactly two insert statements in the app.** Everything else is a
caller of one of them:

- `src/lib/server/create-pending-generation.server.ts:67` — every generation
- `src/features/user-images/server/images.actions.ts:73` — every upload

That is the good news, and it is why the holes below are consistent rather than
scattered: a fact missing from a row is almost always a fact the _caller_ never
handed down, not a second insert that forgot it.

## The four live creation paths

| #   | Path               | Chain                                                                                                  |
| --- | ------------------ | ------------------------------------------------------------------------------------------------------ |
| U1  | Upload, Images     | `images/_hooks/use-uploads.ts` → `useImageUpload.upload` → `createImageRecord`                         |
| U2  | Upload, canvas     | `infinite-canvas.tsx:723` (paste/drop) → `useUserImages.create` → `createImageRecord`                  |
| G1  | Generation, Images | `use-generator.handleGenerate` → `generateImage` → `generateImageInternal` → `createPendingGeneration` |
| G2  | Generation, canvas | `use-canvas-generate.ts` → same chain, with `onCanvas: true` and `sourceClient: 'genzen-canvas'`       |

Not creation paths, listed because they look like ones:

- **Retry** (`retry-generation.server.ts`) — reuses the failed row. Inserts
  nothing, and _rebuilds_ the request from `generation_metadata`, so it is the
  only reader that depends on this inventory being complete. It is wrong today:
  #214.
- **Library picker** (canvas) — membership only, no insert.
- **`useUserImages.createOptimistic`** — a third upload implementation with **no
  caller**. Dead.

## Two moments, not one

A generation row is **reserved** before any fallible work and **settled**
afterwards, so "recorded at creation" has two times:

- **R — reserve.** `createPendingGeneration`. Present on every row, including
  ones that fail.
- **S — settle.** `markGenerationSubmitted` (post-submit facts) or
  `processImageResult` / `markGenerationFailedWithBlob` (post-result facts).
  **Absent for any generation that fails before that point.**

Uploads have one moment: the row is inserted after the object is in storage.

## What each path records

`E` explicit · `O` by-omission (a column default or a fallback fills it in) ·
`N` not recorded · `—` not applicable

| Fact                        | U1  | U2    | G1            | G2            |
| --------------------------- | --- | ----- | ------------- | ------------- |
| `source`                    | O   | O     | E (R)         | E (R)         |
| origin surface              | N   | N     | **N**         | E (R)         |
| canvas membership           | N   | E¹    | N             | E (R)         |
| prompt sent                 | —   | —     | E (R)         | E (R)         |
| prompt typed                | —   | —     | E (R)²        | E (R)²        |
| prompt before enhance       | —   | —     | E (R)²        | E (R)²        |
| source image (library)      | —   | —     | E (R)         | E (R)         |
| source image (pasted bytes) | —   | —     | E (R)²        | E (R)²        |
| reference images            | —   | —     | E (R)³        | E (R)³        |
| reference order             | —   | —     | E (R)³        | E (R)³        |
| model                       | —   | —     | E (R+S)       | E (R+S)       |
| aspect ratio                | —   | —     | E (R)         | E (R)         |
| seed                        | —   | —     | E (S)         | E (S)         |
| cost                        | —   | —     | E (S)         | E (S)         |
| provenance edges            | N   | N     | N⁴            | N⁴            |
| `sort_order`                | N   | N     | E (R)         | E (R)         |
| `thumbnail_path`            | E   | **N** | E (S)         | E (S)         |
| `title`                     | E   | E     | O (R) → E (S) | O (R) → E (S) |
| `description`               | N   | N     | E (S)         | E (S)         |
| dimensions                  | N   | N     | N             | N             |

¹ Not at insert — `setOnCanvas([id], true)` immediately after, plus a
diff-based reconcile on each debounced save. A crash between the two leaves an
image on screen that the DB does not consider on-canvas; the mount reconcile
then prunes it. #212 replaces the whole mechanism.
² New in #210. Absent on every row created before it.
³ Ids in a JSONB array, so order is preserved but nothing enforces the ids point
at live rows: #208 failure mode 1.
⁴ `source_image_id` and `root_image_id` are recorded when present, but nothing
derives a relationship from them (#204). A queryable graph is #208.

## Every N and O, filed or explained

**Filed.**

- **origin surface, G1 = N.** `source_client` is set by exactly one caller
  (`use-canvas-generate.ts:356`), so "generated on Images" is the _absence_ of
  evidence and is indistinguishable from a row predating the field. #207 makes
  it a column with three declared values.
- **`thumbnail_path`, U2 = N.** `useImageUpload.upload` fires `createThumbnail`;
  `useUserImages.create` does not. So an image pasted onto the canvas never gets
  a thumbnail and the gallery renders the full-size object for it — a difference
  that comes from which of three near-identical upload functions the caller
  happened to reach for, not from any decision. Filed: #215.
- **provenance edges = N** everywhere. #208.
- **canvas membership, all four = N-at-insert** except G2. #212.

**Explained, no ticket.**

- **`source` = O on uploads.** The column default _is_ `'upload'`, and an upload
  is the only thing that path creates. This is a default that cannot be wrong.
- **`sort_order` = N on uploads.** The gallery's SQL orders by
  `sort_order desc nulls last`, so uploads sort last in the query — and
  `use-gallery.ts:28` repairs it client-side by falling back to
  `created_at / 1000`, which is the same scale `createPendingGeneration` writes
  (`Date.now() / 1000`). It works, and it is a hidden coupling: the fallback and
  the insert have to agree on a unit, in two files, with nothing asserting it.
  Any future consumer that trusts the SQL order gets uploads at the bottom.
- **`description` = N on uploads.** There is nothing to write at upload time.
  Describe fills it in later on demand (`describe-dialog.tsx`).
- **`title` = O then E on generations.** `'Generating...'` at reserve, the model
  name at settle — including on the failure path, since #189's `failureTitle`.
  Deliberate: a row must be titled before anything fallible runs.
- **dimensions = N everywhere.** `width` / `height` have **no writer in the
  app**, and neither does `color_palette`. All three are selected by
  `userImageColumns()` and typed in `db.ts`, and nothing reads them. They are
  Supabase-era columns that survived the translation. Not filed as a bug because
  nothing is broken by their absence; if a reader ever appears it needs a
  backfill, and that is the ticket to write then.

## Corrections to what #211 assumed

- **`parent_id` is not being written back.** The branch at
  `generate-image-internal.server.ts` that writes it is guarded by
  `parentImageId`, and **no caller passes it** — the variation generator that
  did was removed with #204. `migrations/0002` is still true about the table.
  The branch is unreachable code, not a live regression, so it dies as cleanup
  rather than as a fix. Same for `isRefine` / `buildRefinePrompt`.
- **`has_source_image` and `original_prompt` are already closed** (#210), which
  is why they appear as `E (R)²` above rather than as holes.

## What this inventory says about the pass

The insert sites are not the problem — the **callers** are, and they are wrong in
one direction. Every hole is a fact the client knew and did not pass down:
which surface submitted, which container it belongs to, what the user actually
typed. None of it is data the app never had.

That is why #207 and #212 are additive-then-subtractive rather than
speculative, and it is also the argument for doing them as columns and rows: a
fact that only one of four callers bothers to send is a fact the schema never
required.
