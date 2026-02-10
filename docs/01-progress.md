# Progress Log

Development progress for GenZen.

---

### FAL Image Generation with Model Selection and AI Prompts

**Issue:** #3 - FAL Direct: Simple image generation from dashboard

Added AI image generation at `/dashboard/ai-images`. Users can select from 7 curated FAL models (FLUX Schnell, FLUX.2 Turbo/Max, Nano Banana Pro, Recraft V3, Grok Imagine, ImagineArt 1.5) and generate images from text prompts. Includes a "Random Prompt" button that uses `fal-ai/any-llm` with Gemini 2.5 Flash to generate creative prompts. Server functions use TanStack Start `inputValidator` for type-safe input.

**Key files:**
- `src/features/ai-images/models.ts` - Curated model list with id/name/description
- `src/features/ai-images/server/generate-image.server.ts` - generateImage and generatePrompt server functions
- `src/routes/dashboard/ai-images.tsx` - Route with model dropdown, prompt textarea, generation UI

---

### Global Navigation and Route Restructure

Added a persistent global nav bar across all pages. Created public routes for home (`/`), about (`/about`), and login (`/login`). Dashboard routes remain auth-protected under `/dashboard`. Removed TanStack devtools panel from root layout.

**Key files:**
- `src/components/GlobalNav.tsx` - Site-wide navigation bar
- `src/routes/__root.tsx` - Root layout with GlobalNav, devtools removed
- `src/routes/index.tsx`, `src/routes/about.tsx`, `src/routes/login.tsx` - Public routes

---

### Docs Viewer

Added an in-app documentation viewer at `/docs` that renders markdown files from the `docs/` directory. Provides browsable access to feature docs and progress log without leaving the app.

**Key files:**
- `src/routes/docs.tsx` - Docs viewer route

---

### Added JSON output for color palettes and minor design refinements

Added JSON export tab to the color palette display so users can view and copy palette data for use in other tools. Palette/JSON toggle with copy-to-clipboard. Restructured the image edit dialog header with icon-only action buttons. Swatch hover interactions refined: regenerate and eyedropper show on hover, lock always visible. Image cards updated with smaller title text and bottom-pinned metadata. Dialog is now always side-by-side layout with min 800px width.

**Key files:**
- `src/features/user-images/components/ColorPaletteDisplay.tsx` - JSON tab, header layout, swatch hover behavior
- `src/features/user-images/components/ImageEditDialog.tsx` - Fixed layout, overflow constraints
- `src/features/user-images/components/ImageCard.tsx` - Title sizing, bottom-pinned metadata

---

### User Images Feature

**Issue:** #9 - User Images: Upload and manage images from dashboard

Added user images feature at `/dashboard/images`. Users can upload images (jpeg, png, webp, gif up to 50MB), view them in a responsive grid, edit title/description, and delete. Uses Supabase Storage with RLS for security. Auto-generates titles from filenames and computes SHA-256 hashes for future duplicate detection.

**Key files:**
- `src/features/user-images/` - Feature module (hooks, components, types)
- `src/routes/dashboard/images.tsx` - Route component
- `src/components/ui/dialog.tsx` - Dialog component
- `src/lib/types/supabase.ts` - Generated Supabase types
- `supabase/migrations/20260204215304_remote_schema.sql` - DB migration

---

### Dashboard UI/UX with Layout System

**Issue:** #2 - Dashboard UI/UX exploration with static content

Implemented the dashboard layout system with global dark theme styling. Created responsive sidebar navigation (desktop) and sheet-based mobile nav. Established color palette with gold accent (#C9A75C) and sage green (#8FA888) secondary. Set up TanStack Router layout routes for auth-protected dashboard pages.

**Key files:**
- `src/styles.css` - Global dark theme with CSS variables
- `src/components/DashboardLayout.tsx` - Layout wrapper
- `src/components/Sidebar.tsx` - Desktop navigation
- `src/components/MobileNav.tsx` - Mobile sheet navigation
- `src/routes/dashboard.tsx` - Layout route with auth protection
- `src/routes/dashboard/index.tsx` - Dashboard home
- `src/routes/dashboard/profile.tsx` - Profile page
- `src/routes/dashboard/settings.tsx` - Settings page

---

### Initial Setup Complete

**Issue:** #1 - Initial setup: Authenticated dashboard with full stack verification

Set up the foundational infrastructure for the GenZen AI image generation app. Created TanStack Start project with Supabase auth, Trigger.dev background jobs, and FAL image generation API. Deployed to Fly.io with connection status verification dashboard.

**Key files:**
- `src/routes/index.tsx` - Login page
- `src/routes/dashboard.tsx` - Protected dashboard with connection status
- `src/lib/server/check-connections.ts` - Server-side service checks
- `src/lib/auth.ts`, `src/components/auth-provider.tsx` - Auth context
- `trigger.config.ts` - Trigger.dev configuration
- `Dockerfile`, `fly.toml` - Fly.io deployment

---
