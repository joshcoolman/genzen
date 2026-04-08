# Continue: AD Context-Aware Edit Page + Push-In Layout

## What was worked on

Two commits shipped to main in this session:

1. **History page + Prompt Studio sets to Supabase** (`7ea4c1e`) -- merged from `feature/history-and-studio-sets` branch that had been sitting uncommitted. History page with list/grid views, prompt search, Supabase migration for prompt studio sets, AD context hooks for history + prompt studio.

2. **AD context-aware edit page with push-in layout** (`50353d2`) -- the main work of this session.

## Changes made (commit `50353d2`)

- **ADContext extended** (`src/features/ad/context/ad-context.tsx`): Added `ADContextImage` type, `contextImages` map, `registerImage`/`unregisterImage` callbacks, and `useRegisterADImage` hook. Features can now register images that AD auto-injects as vision blocks.
- **useADChat** (`src/features/ad/hooks/useADChat.ts`): On `sendMessage`, merges context images from `ADContext.contextImages` into the user's message as vision blocks. Deduplicates against user-attached images.
- **useEditPageADContext** (`src/features/ai-images/hooks/useEditPageADContext.ts`): New hook. Registers: (1) text context (image title, original prompt, model, aspect ratio, chain info) via `useRegisterADContext`, (2) the selected source image's base64 via `useRegisterADImage`. Strips data URL prefix to raw base64 + mediaType.
- **Edit page route** (`src/routes/dashboard/edit.$imageId.tsx`): Calls `useEditPageADContext`, uses `useADOpen` for AD-aware layout. Content div margin adjusts for edit sidebar (320px) + AD panel (480px). Edit sidebar shifts to `right-[480px]` when AD is open.
- **AI Images route** (`src/routes/dashboard/ai-images.tsx`): Same AD push-in treatment -- Generate sidebar shifts to `right-[480px]`, content margin adjusts for both panels.
- **DashboardLayout** (`src/components/DashboardLayout.tsx`): Pages with own sidebars (`isEditPage || isAiImagesPage`) are excluded from generic AD margin and get `pr-0`. Other pages get `md:mr-[480px]` push.
- **AD panel width**: Reduced from 640px to 480px (`src/features/ad/components/ADPanel.tsx`).
- **Source image preview**: `GeneratorPanel` uses `variant="square"` in edit mode instead of `compact`.

## Key decisions

- **Context image tracks selection**: When user clicks a different image in the edit chain, `generator.sourceImage` updates, which triggers the AD context hook to re-register the new image. AD sees whatever the user has selected.
- **Image injected per-message, not in system prompt**: Context images are merged into user messages as vision blocks, not baked into the system prompt. This means AD only "sees" the image on the turn it's sent.
- **Run button removed**: Built a `runPrompt` callback system (ADContext -> PromptCard -> edit page generator), tested it, then removed it at user's request. Copy+paste workflow is sufficient for now. The infrastructure pattern is documented in git history if needed later.
- **Push-in vs overlay**: AD panel pushes content on all pages. Pages with fixed sidebars (AI Images, edit) handle their own margin math. Other pages use DashboardLayout's generic `mr-[480px]`.

## Outstanding work / known issues

- **Edit page gap**: ~90px gap between content scrollbar and the edit sidebar when AD is open. `pr-0` on `<main>` helped but didn't fully close it. Likely needs the margin calc fine-tuned or the edit page content restructured. User accepted this as polish for later.
- **Run button**: Removed but the pattern exists in git if user wants it back after more testing.
- **Future AD context expansion**: Discussed but deferred -- registering recent generation results (not just source image) so AD can see "what just came back" without user clicking it. User wants to test the current select-and-talk workflow first before expanding.
- **Issue #87** (AD page-aware context): The `useRegisterADContext` + `useRegisterADImage` hooks are the per-feature approach. DOM scraping / screenshot capture discussed as a generic fallback but not built. Issue updated with progress.

## Git state

- Branch: `main`
- Clean working tree -- all changes committed and pushed
- Last commit: `50353d2`
- All stale branches cleaned up
- Supabase migrations from `7ea4c1e` may need `supabase db push` if not already applied
