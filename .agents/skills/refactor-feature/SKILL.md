---
name: refactor-feature
description: Analyze a feature route and generate a refactoring plan based on the feature architecture pattern. Use when a route file has grown too large or when starting a new feature that should follow the established pattern.
user_invocable: true
invocation_hint: refactor feature
---

# Refactor Feature

Analyze a feature route file against the architecture pattern in `docs/feature-architecture.md` and produce a refactoring plan.

## Instructions

### 1. Read the architecture doc

Read `docs/feature-architecture.md` to load the target pattern.

### 2. Identify the target

If the user provided a file path or feature name, use that. Otherwise, ask which feature route to analyze.

The route file is typically at `src/routes/dashboard/<feature>.tsx`.

### 3. Analyze the current state

Read the route file and its associated feature directory (`src/features/<feature>/`). Catalog:

- **State inventory**: Count `useState` calls. List each piece of state with its purpose.
- **Handler inventory**: List all handler/action functions with line counts.
- **Component structure**: Is it one monolithic return, or are there sub-components?
- **Existing hooks**: What's already extracted vs inline?
- **Shared constants**: Any duplicated values across files?
- **Server function usage**: Which server functions are called and where?

### 4. Propose hook slices

Group the state inventory into coherent slices. Each slice should:

- Own related state AND the actions that mutate it
- Be independently understandable
- Map to a UI section when possible (panel, dialog, gallery, lightbox)

Name them: `use-<slice>.ts` (e.g., `use-generator.ts`, `use-editor.ts`, `use-lightbox.ts`)

### 5. Propose component extractions

Identify JSX blocks that map to distinct UI sections. Each should:

- Receive props via an explicit interface (never `ReturnType<typeof useX>`)
- Contain no business logic (delegate to hook methods)
- Be named after what they render, not what they do

### 6. Generate the plan

Output a structured refactoring plan with:

```markdown
## Analysis

**Current state**: X useState calls, Y handlers, Z lines
**Verdict**: [Needs refactoring / Already follows pattern / Too simple for pattern]

## Proposed Architecture

### New files

- List each new hook and component with a one-line description

### Hook breakdown

For each hook:

- State it owns (list the useState calls moving into it)
- Actions it owns (list the handler functions)
- Dependencies it receives (credits, gallery, setError, etc.)
- Exported interface name

### Component breakdown

For each component:

- What JSX block it extracts (reference line numbers)
- Props interface (which hook states it receives)

### Route file becomes

Show the target route file (~50-80 lines)

### Migration order

Bottom-up: simplest hooks first, orchestrator last, then components, then slim route

### Constants to extract

Any duplicated values that need a constants.ts
```

## Key rules from the pattern

- Route = 1 hook call + composed components (50-80 lines)
- Orchestrator hook composes domain hooks, owns only shared concerns
- Domain hooks never import each other — orchestrator wires them
- Every hook exports a named interface (no ReturnType)
- Components reference props as objects (generator.prompt, not destructured)
- Toggle/mutation logic lives in hooks, not component JSX
- Constants appear in exactly one file
- Shared utilities (like getModelName) live in domain files (models.ts)

## Reference

The ai-images feature is the reference implementation. When uncertain about a pattern decision, check how it was solved there:

- Orchestrator: `src/features/ai-images/hooks/use-ai-images-page.ts`
- Domain hook: `src/features/ai-images/hooks/use-generator.ts`
- Component: `src/features/ai-images/components/GeneratorPanel.tsx`
- Constants: `src/features/ai-images/constants.ts`
