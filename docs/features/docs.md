## Overview

Renders markdown documentation with category-based sidebar navigation and a sticky table of contents. Content loading and parsing lives in `@/lib/docs/`; this feature only contains display components.

## How It Works

1. Layout route loads doc categories via `getDocNavCategories()`
2. Splat route loads individual doc by slug via `getDocBySlug()`
3. HTML content injected via `dangerouslySetInnerHTML` (docs are trusted, pre-rendered server-side)
4. TableOfContents tracks scroll position with IntersectionObserver

## Usage

- Navigate to /docs
- Browse categories in the sidebar
- Table of contents tracks scroll position on wide screens

## Key Files

- `src/features/docs/components/DocsContent.tsx` -- Renders a single doc page (category label, title, HTML body)
- `src/features/docs/components/DocsSidebar.tsx` -- Collapsible category navigation with active-slug highlighting
- `src/features/docs/components/TableOfContents.tsx` -- Sticky "On this page" sidebar with IntersectionObserver scroll tracking (hidden below xl)
- `src/routes/docs.tsx` -- Layout: loads categories, renders sidebar + outlet
- `src/routes/docs/index.tsx` -- Redirects to first doc slug
- `src/routes/docs/$.tsx` -- Splat route: loads doc by slug, renders content + TOC

## Dependencies

- `@/lib/docs/loadDocs.server` -- `getDocNavCategories()`, `getDocBySlug()`, `getFirstDocSlug()`
- `@/lib/docs/types` -- DocFile, DocNavCategory, TocHeading types
