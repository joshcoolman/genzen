# Codebase Assessment

_Generated: 2026-02-26 | Branch: main | Last commit: a165add_

---

## Overall Health: **Needs Attention**

The codebase is well-structured and architecturally sound, but has a handful of real bugs (including one introduced in the latest drag-reorder commit), several missing ownership guards that rely entirely on RLS for security, and significant dead code accumulation from removed features.

---

## 🔴 Critical

### C1. Drag Reorder `insertBefore` Ternary Always Returns `newIndex`

**File:** `src/routes/dashboard/ai-images.tsx:159`

```ts
const insertBefore = oldIndex < newIndex ? newIndex : newIndex
// Both branches return newIndex — copy-paste error
```

When dragging **upward**, the wrong neighbors are used for the midpoint calculation, so cards land at slightly incorrect positions. Fix:

```ts
const insertBefore = oldIndex < newIndex ? newIndex : newIndex - 1
```

### C2. Missing `user_id` Ownership Filter on Source Image Fetches

**Files:** `src/features/ai-images/server/edit-image.server.ts:40–44`, `src/features/ai-images/server/generate-variation.server.ts:70–74`

Neither fetch adds `.eq('user_id', user.id)`. Security depends entirely on Supabase RLS being correctly configured and never disabled. Add the filter at the query level as defense-in-depth.

### C3. `.env.local` Credentials Are Live — No `.env.example` Exists

No `.env.example` documents required variables. Required env vars:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `FAL_KEY`
- `ANTHROPIC_API_KEY` (used implicitly by `@ai-sdk/anthropic`)
- `TRIGGER_SECRET_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` _(present in `.env.local` but never used in code — remove it)_

---

## 🟠 Major

### M1. `checkConnections` Server Function Has No Auth

**File:** `src/lib/server/check-connections.ts:4`

The handler has no `requireAuth` call. Any unauthenticated request can probe whether `FAL_KEY` and `TRIGGER_SECRET_KEY` are configured.

### M2. `deleteImage` Passes `null` Storage Path to Storage Remove

**File:** `src/features/ai-images/hooks/use-images.ts:197`

```ts
await supabase.storage.from('user-images').remove([img.storage_path])
// storage_path is string | null — null guard missing
```

For pending/failed images, `storage_path` is `null`. Fix:

```ts
if (img.storage_path) {
  await supabase.storage.from('user-images').remove([img.storage_path])
}
```

### M3. PostgREST `.or()` Filter Interpolates Unvalidated UUIDs

**File:** `src/features/ai-images/server/generate-variation.server.ts:153–155`

```ts
.or(`generation_metadata->>source_image_id.eq.${rootSourceId},...`)
```

Both IDs come from user input or stored JSONB. Validate as UUID (`/^[0-9a-f-]{36}$/i`) before interpolation.

### M4. Polling Interval Resets on Every `savedImages` Change

**File:** `src/features/ai-images/hooks/use-images.ts:147–167`

`savedImages` is in the `useEffect` dependency array, so every realtime UPDATE resets the 3-second polling timer. Under rapid realtime events, pending images may never get polled. Use a `useRef` to track pending IDs without `savedImages` as a direct dependency.

### M5. Signed URLs Generated Sequentially in a Loop

**File:** `src/features/ai-images/hooks/use-images.ts:46–54`

20 sequential `createSignedUrl` calls on gallery load. Use Supabase `createSignedUrls` (batch) or `Promise.all()`.

### M6. `generation_metadata` Cast Skips Null Check in Polling

**File:** `src/features/ai-images/server/check-pending-images.server.ts:60–64`

`generation_metadata` is `Json | null`. The cast to `{ model, prompt, fal_model_id }` will throw if the field is null. Add a null guard before destructuring.

---

## 🟡 Minor

### m1. `save-image.server.ts` Is Orphaned Dead Code

**File:** `src/features/ai-images/server/save-image.server.ts`
No imports found anywhere. Image saving now happens inside `check-pending-images.server.ts`. Safe to delete.

### m2. `describe-image.server.ts` Is Exported but Never Imported

**File:** `src/features/ai-images/server/describe-image.server.ts`
Zero callers. The same logic is re-implemented inline in `generate-image.server.ts`. Either consolidate or delete.

### m3. `hello-world.ts` Trigger Task Is Unused Scaffolding

**File:** `src/trigger/hello-world.ts` — delete.

### m4. `src/lib/animations/` Directory Appears Unused

The entire animations module has no imports in any route or feature. Verify and delete if confirmed unused.

### m5. Old DB Tables Are Dead Weight

Tables `counts`, `todos`, and `images` (the old gallery), along with their RLS policies and `gallery-images`/`image-tool` storage bucket policies, exist in migrations but are never referenced in application code. Schedule for removal.

### m6. `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` Is Never Used

This key bypasses RLS entirely. If unused, remove it to reduce the blast radius of a credential leak.

### m7. `generate-variation.server.ts` Ignores `model` Input

The `model` field is accepted and stored but `flux-pro/kontext` is always used regardless. This may be intentional, but the parameter is misleading. Document or remove it.

### m8. Supabase Generated Types Not Regenerated After `sort_order` Migration

**File:** `src/lib/types/supabase.ts`
The new `sort_order` column is not in the generated types. Run `supabase gen types typescript` to update.

### m9. `supabase: any` Parameter in Video Server Function

**File:** `src/features/ai-video/server/generate-flf-video.server.ts:18`
Type as `ReturnType<typeof createClient>` instead of `any`.

### m10. `safety_tolerance: 6` Hardcoded Everywhere

All FAL submissions disable safety filtering. This is a deliberate product decision but worth documenting explicitly.

---

## Positive Findings

- **Auth is consistently used** — every user-facing server function calls `requireAuth` (except `checkConnections`)
- **Optimistic UI pattern is solid** — add/replace/remove optimistic cards with realtime deduplication works well
- **No hardcoded secrets in source files** — all keys are in `.env.local` (gitignored)
- **Clean module structure** — `src/features/` separation is well-maintained, no circular dependencies detected
- **Realtime + polling hybrid** is an elegant fallback pattern
- **Fractional sort_order** is the right approach for drag-reorder; precision collapse is not a concern at ≤20 items

---

## Recommendations

1. **Immediate:** Fix the `insertBefore` drag bug (C1) and add `user_id` filters (C2)
2. **This week:** Create `.env.example`, fix the null storage path guard (M2), add auth to `checkConnections` (M1)
3. **Next cleanup pass:** Delete `save-image.server.ts`, `describe-image.server.ts`, `hello-world.ts`, and `src/lib/animations/` after confirming unused; regenerate Supabase types
4. **Architecture:** Consider a shared `createUserSupabaseClient(accessToken)` helper to reduce the 20+ identical `createClient(url, key, { headers: { Authorization } })` blocks across server functions
