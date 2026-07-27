# Feature Architecture

Pattern for organizing feature pages. Established during the ai-images refactor. Every feature page should follow this structure.

## Structure

```
src/features/<feature>/
  constants.ts                    # Shared constants (enums, maps, ratio lists)
  types.ts                        # Domain types
  models.ts                       # Model/entity definitions + utility fns
  hooks/
    use-<feature>-page.ts         # Orchestrator — composes domain hooks
    use-<domain-slice>.ts         # One hook per state slice
  components/
    <Component>.tsx               # Presentational components
  server/
    <action>.server.ts            # Server functions

app/(authenticated)/<feature>.tsx  # Thin shell — 1 hook + composed components
```

## Rules

### Route files are thin shells

The route component calls one orchestrator hook and passes state to composed components. No `useState`, no handlers, no business logic. Target: 50-80 lines.

```tsx
function FeaturePage() {
  const page = useFeaturePage()
  return (
    <Layout>
      <PanelA generator={page.generator} />
      <PanelB gallery={page.gallery} />
      <DialogC editor={page.editor} />
    </Layout>
  )
}
```

### Orchestrator hook composes domain hooks

`use-<feature>-page.ts` wires together domain hooks and handles cross-cutting concerns (shared error state, bridging between slices). It does not own state directly except for shared concerns like `error`.

```tsx
export function useFeaturePage() {
  const credits = useCredits()
  const gallery = useImages({ ... })
  const generator = useGenerator({ credits, setError })
  const editor = useEditor({ credits, setError })
  // ...
  return { credits, gallery, generator, editor, error }
}
```

### Domain hooks own coherent state slices

Each hook owns related state + the actions that mutate it. A hook should be independently understandable — reading it tells you everything about that slice.

Good slices: generator (prompt + generate action), editor (edit dialog state + submit), lightbox (index + nav), variations (optimistic cards + generate).

Bad slices: "ui-state" (grab bag), "handlers" (actions without their state).

### Every hook exports an explicit interface

Never use `ReturnType<typeof useX>` for prop types. Export a named interface that describes the hook's public surface.

```tsx
export interface GeneratorState {
  prompt: string
  setPrompt: (prompt: string) => void
  loading: boolean
  canGenerate: boolean
  handleGenerate: () => Promise<void>
  toggleImageModel: (modelId: string, checked: boolean) => void
}

export function useGenerator(opts: GeneratorOptions): GeneratorState { ... }
```

Why: `ReturnType` is brittle (hook return changes silently break consumers), hides what components actually need, and defeats IDE autocomplete on prop types.

### Components are presentational

Components receive typed props and render UI. They do not:

- Call server actions directly
- Contain inline state mutation logic (use hook methods instead)
- Import hooks (except UI-only hooks like `useSensors`)

```tsx
// Bad: inline mutation
onChange={(e) => {
  if (e.target.checked) setModels([...models, m.id])
  else setModels(models.filter(id => id !== m.id))
}}

// Good: delegate to hook method
onChange={(e) => generator.toggleImageModel(m.id, e.target.checked)}
```

Components reference props as objects (`generator.prompt`, `editor.editTarget`) rather than destructuring the entire hook return. This makes dependencies visible.

### Constants live in one place

Shared values (ratio lists, flip maps, cost tables) go in `constants.ts`. If a value appears in more than one file, extract it.

Utility functions that derive from constants (like `getRatioOptions`, `flipOrientation`) live alongside them.

### Shared utilities live in domain files

Functions like `getModelName` that map domain data belong in `models.ts`, not duplicated in components or routes.

## Hook dependency flow

```
Route
  └── useFeaturePage (orchestrator)
        ├── useAuth, useCredits (external)
        ├── useImages (gallery)
        ├── useModelSettings
        ├── useGenerator ← receives selectedModels, credits, setError
        ├── useEditor ← receives credits, defaults from generator, setError
        ├── useLightbox ← receives completedImages
        ├── useVariations ← receives credits, gallery, setError
        └── usePromptTools ← receives setPrompt, getPrompt, setError
```

Dependencies flow downward. Domain hooks never import each other — the orchestrator wires them.

## When to use this pattern

- Feature page with 3+ `useState` calls and handler functions
- Any page with distinct UI sections (panel, gallery, dialog, lightbox)
- When you find yourself scrolling past 200 lines to understand a route

## When NOT to use this pattern

- Simple settings pages with 1-2 toggles
- Static content pages
- Pages where the entire state is a single form (use a form library instead)

## Reference implementation

`src/features/ai-images/` — the first feature refactored to this pattern.

| File                             | Purpose                             |
| -------------------------------- | ----------------------------------- |
| `hooks/use-ai-images-page.ts`    | Orchestrator                        |
| `hooks/use-generator.ts`         | Prompt + generate action            |
| `hooks/use-editor.ts`            | Edit dialog state                   |
| `hooks/use-lightbox.ts`          | Lightbox nav                        |
| `hooks/use-variations.ts`        | "More like this" + optimistic cards |
| `hooks/use-prompt-tools.ts`      | Random/enhance prompt               |
| `components/GeneratorPanel.tsx`  | Prompt + model selection UI         |
| `components/ImageGallery.tsx`    | DnD gallery grid                    |
| `components/EditImageDialog.tsx` | Edit dialog                         |
| `constants.ts`                   | Ratio lists, flip map               |
| `models.ts`                      | Model registry + getModelName       |
