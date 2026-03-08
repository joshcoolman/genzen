## Context: Block out Characters (#54) and Style Trainer (#55) features

Last session was research + planning. No code changes. Git is clean on `main` at `61e8c90`.

### What was done

- Researched FAL LoRA training capabilities (portrait trainer, style trainer, Kontext trainer, Wan video LoRA)
- Posted detailed research comment on issue #54 covering three tiers of character consistency (ref images -> LoRA training -> video LoRA)
- Created issue #55 "Style Trainer: LoRA-based style creation workflow"
- Both issues have full specs with feature structure, DB migration outlines, and FAL integration details

### Task: Block out both features following the Shots pattern

Create non-functional but navigable UI shells for Characters and Style Trainer, exactly like how Shots (`src/features/shots/`) is currently implemented. Read the Shots feature first to understand the pattern:

- `src/routes/dashboard/shots.tsx` -- thin route wrapper
- `src/features/shots/hooks/useShotsPage.ts` -- hook with step state (`ShotsStep = 'upload' | 'select' | 'upscale'`), useCallback handlers, useMemo return object
- `src/features/shots/components/ShotsPageContent.tsx` -- conditional rendering per step, inline sub-components, mock placeholder content (gradient boxes)
- `src/features/shots/index.ts` -- public exports

**Characters (#54):**

- Steps: `'generate' | 'angles' | 'saved'`
- Generate: prompt input + count selector + generate button + face grid (mock gradient boxes)
- Angles: 3x3 grid with angle labels (mock cells)
- Saved: character cards grid with name/thumbnail
- Nav icon: `Users` (from lucide)

**Style Trainer (#55):**

- Steps: `'upload' | 'training' | 'test' | 'library'`
- Upload: drag/drop zone for reference images + style name input (reuse ImageSourceButtons if applicable)
- Training: progress/status placeholder
- Test: prompt input + test image grid (mock)
- Library: saved styles grid
- Nav icon: pick something appropriate from lucide

Both need: route file, feature folder (components/, hooks/, index.ts), nav item in `src/lib/nav-items.ts`. Follow composable feature pattern. Placeholder content only -- no DB migrations, no FAL calls, no server files yet.
