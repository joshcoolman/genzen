# Docs

Presentation components for the documentation section. Content loading and types live in `@/lib/docs/`.

## Key Files

- `components/DocsContent.tsx` -- Renders a single doc page (category label, title, HTML body via `dangerouslySetInnerHTML`)
- `components/DocsSidebar.tsx` -- Collapsible category navigation with active-slug highlighting and expand/collapse icons
- `components/TableOfContents.tsx` -- Sticky "On this page" sidebar with IntersectionObserver-based scroll tracking; hidden below xl breakpoint

## Route

- `src/routes/docs.tsx` -- Layout that loads categories and renders sidebar + outlet
- `src/routes/docs/index.tsx` -- Redirects to first doc slug via `getFirstDocSlug()`
- `src/routes/docs/$.tsx` -- Splat route that loads doc by slug via `getDocBySlug()`, renders content + TOC

## Shared Dependencies

- `@/lib/docs/types` -- `DocFile`, `DocNavCategory`, `DocNavItem`, `TocHeading` types
- `@/lib/docs/loadDocs.server` -- `getDocNavCategories()`, `getDocBySlug()`, `getFirstDocSlug()`
- `@/lib/utils` -- `cn()` for class merging

## Quirks / Notes

- Docs route is password-protected via `verifyDocsPassword()` with localStorage persistence
- Mobile-responsive: sidebar and content toggle via menu/read mode on small screens
- This feature only contains display components; doc loading and parsing is in `@/lib/docs/`
- HTML content is injected raw -- docs are trusted (markdown pre-rendered server-side)
- TableOfContents uses IntersectionObserver with rootMargin `-80px 0px -80% 0px`
- DocsSidebar extracts current slug by removing `/docs/` prefix from pathname
- Each category section is independently collapsible (default: open)
