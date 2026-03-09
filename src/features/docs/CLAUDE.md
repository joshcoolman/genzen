# Docs

Presentation components for the documentation section. Content loading and types live in `@/lib/docs/`.

## Key Files

- `components/DocsContent.tsx` -- Renders a single doc page (category label, title, HTML body via `dangerouslySetInnerHTML`)
- `components/DocsSidebar.tsx` -- Collapsible category navigation with active-slug highlighting
- `components/TableOfContents.tsx` -- Sticky "On this page" sidebar with IntersectionObserver-based scroll tracking

## Route

`src/routes/docs.tsx` (layout), `src/routes/docs/index.tsx`, `src/routes/docs/$.tsx` (splat)

## Shared Dependencies

- `@/lib/docs/types` -- `DocFile`, `DocNavCategory`, `TocHeading` types
- `@/lib/utils` -- `cn()` for class merging

## Quirks / Notes

- This feature only contains display components; doc loading (`getDocNavCategories`, `loadDoc`) is in `@/lib/docs/`
- HTML content is injected raw -- docs are trusted (markdown pre-rendered server-side)
- TableOfContents only renders on xl breakpoints and above
