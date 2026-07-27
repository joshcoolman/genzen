# Mobile Reference

This document provides context for working on mobile-specific implementations in GenZen.

## Breakpoints

GenZen uses Tailwind v4 with a custom breakpoint defined in `src/styles.css`:

```css
@theme inline {
  --breakpoint-xs: 400px;
  /* Tailwind defaults: sm: 640px, md: 768px, lg: 1024px, xl: 1280px, 2xl: 1536px */
}
```

### Breakpoint Usage

| Breakpoint | Width   | Common Use Case                    |
| ---------- | ------- | ---------------------------------- |
| `xs:`      | 400px+  | Custom breakpoint for small phones |
| `sm:`      | 640px+  | Dialog widths (`sm:max-w-md`)      |
| `md:`      | 768px+  | **Primary mobile/desktop split**   |
| `lg:`      | 1024px+ | Large screens                      |
| `xl:`      | 1280px+ | Extra large screens                |
| `2xl:`     | 1536px+ | Ultra wide                         |

**Convention**: `md:` (768px) is the primary breakpoint for mobile vs desktop layouts.

## Mobile Detection Patterns

### JavaScript Media Query Detection

**Use the `useIsMobile` hook** (recommended):

```tsx
import { useIsMobile } from '#/lib/hooks/use-is-mobile'

// Default breakpoint is 400px (matches --breakpoint-xs)
const isMobile = useIsMobile()

// Or specify a custom breakpoint
const isTablet = useIsMobile(768) // md breakpoint

const effectiveThumbSize = isMobile ? 'lg' : thumbSize
```

**Features**:

- ✅ SSR-safe initialization
- ✅ Reactive updates via `matchMedia`
- ✅ Auto cleanup on unmount
- ✅ Custom breakpoints supported
- ✅ Matches Tailwind breakpoints

**Location**: `src/lib/hooks/use-is-mobile.ts`

### CSS-Only Responsive Utilities

For most cases, use Tailwind responsive classes instead of JavaScript:

```tsx
// Hide on mobile, show on desktop
<Sidebar className="hidden md:flex" />

// Show on mobile, hide on desktop
<MobileNav className="md:hidden" />

// Responsive grid
<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
```

## Shared Mobile Components

### MobileDialogHeader

Standardized header for full-screen mobile dialogs:

```tsx
import { MobileDialogHeader } from '#/components'
;<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent className="sm:max-w-full h-screen max-h-screen p-0 m-0 rounded-none border-0 flex flex-col">
    <MobileDialogHeader title="Generate" onClose={() => setIsOpen(false)} />
    <div className="flex-1 overflow-y-auto px-3 py-2">{/* Content */}</div>
  </DialogContent>
</Dialog>
```

**Features**:

- ✅ **Flexbox layout** - no manual height calculations needed
- ✅ Optimized mobile spacing (py-2.5, px-3, border-b)
- ✅ White close button (X icon, 24x24px)
- ✅ Content auto-fills remaining space with `flex-1`
- ✅ Sticky header via flex column layout

**Location**: `src/components/mobile-dialog-header/mobile-dialog-header.tsx`

### CircularIconButton

Consistent circular buttons for navigation and CTAs:

```tsx
import { CircularIconButton } from '../circular-icon-button/circular-icon-button'
import { ArrowLeft, Plus } from 'lucide-react'

// White variant (default) - for navigation/back buttons
<CircularIconButton
  icon={ArrowLeft}
  to="/images"
  title="Back to Images"
/>

// Primary variant - for CTAs
<CircularIconButton
  icon={Plus}
  onClick={() => setOpen(true)}
  variant="primary"
  title="New generation"
/>
```

**Props**:

- `icon`: Lucide icon component (required)
- `to`: TanStack Router path (renders as Link)
- `onClick`: Click handler (renders as button)
- `variant`: `'white'` | `'primary'` (default: `'white'`)
- `title`: Tooltip/aria-label text
- `className`: Additional Tailwind classes

**Location**: `app/(authenticated)/edit/[imageId]/_components/circular-icon-button/`

### Breakpoint Constants

Use constants instead of magic numbers:

```tsx
import { BREAKPOINTS } from '#/lib/constants/breakpoints'

// Breakpoint values
BREAKPOINTS.xs // 400px
BREAKPOINTS.sm // 640px
BREAKPOINTS.md // 768px
BREAKPOINTS.lg // 1024px
BREAKPOINTS.xl // 1280px
BREAKPOINTS['2xl'] // 1536px
```

**Location**: `src/lib/constants/breakpoints.ts`

## Mobile-Specific UI Patterns

### Navigation

**Desktop (md+)**: Persistent sidebar (`Sidebar.tsx`)

- Always visible, icons-only layout
- Tooltips on hover for collapsed state
- Located at `app/(authenticated)/_components/sidebar/sidebar.tsx`

**Mobile (<md)**: Slide-out sheet (`MobileNav.tsx`)

- Triggered by floating menu button (top-left)
- Full-height sheet from left side
- Auto-closes on route change
- **Hidden on edit pages** for focused editing experience
- Located at `app/(authenticated)/_components/mobile-nav/mobile-nav.tsx`

```tsx
// Pattern from app/(authenticated)/_components/app-chrome/app-chrome.tsx
const isEditPage = location.pathname.startsWith('/edit/')

<Sidebar className="hidden md:flex" />
{!isEditPage && <MobileNav className="md:hidden" />}
```

### Generator Panels

**Desktop**: Pinned sidebar (right side, 320px)
**Mobile**: Full-screen dialog

```tsx
import { useIsMobile } from '#/lib/hooks/use-is-mobile'
import { MobileDialogHeader } from '#/components'

const isMobile = useIsMobile()

{
  isMobile ? (
    <Dialog open={generatorOpen} onOpenChange={setGeneratorOpen}>
      <DialogContent className="sm:max-w-full h-screen max-h-screen p-0 m-0 rounded-none border-0 flex flex-col">
        <MobileDialogHeader
          title="Generate"
          onClose={() => setGeneratorOpen(false)}
        />
        <div className="flex-1 overflow-y-auto px-3 py-2">
          <GeneratorPanel {...props} />
        </div>
      </DialogContent>
    </Dialog>
  ) : (
    <aside className="w-80 border-l border-border bg-sidebar">
      <GeneratorPanel {...props} />
    </aside>
  )
}
```

**Why full-screen instead of drawer?**

- ✅ No iOS Safari zoom issues (no viewport height calculations)
- ✅ Keyboard handled natively by browser
- ✅ More reliable across iOS versions
- ✅ Better for complex forms with multiple inputs

**Key Files**:

- `src/components/ui/dialog/dialog.tsx` - Radix dialog component (used for mobile)
- `src/components/ui/drawer.tsx` - Vaul drawer component (deprecated for complex panels)
- `src/components/ui/sheet/sheet.tsx` - Radix sheet component

### Docs Navigation

**Desktop**: Persistent left sidebar
**Mobile**: Full-screen toggle overlay

```tsx
// Pattern from app/docs.tsx
<div
  className={cn(
    'md:block md:w-auto',
    mobileMenuOpen
      ? 'block w-full absolute inset-0 top-[49px] z-10 bg-background'
      : 'hidden',
  )}
>
  <DocsSidebar />
</div>
```

### Bottom Sheets

Used for simple contextual panels (e.g., prompts library). For complex forms with multiple inputs, use full-screen Dialog instead.

```tsx
// Pattern from src/features/prompts/components/PromptSheet.tsx
<div
  className={cn(
    'fixed inset-x-0 bottom-0 z-50',
    'transform transition-transform duration-300 ease-out',
    isOpen ? 'translate-y-0' : 'translate-y-full',
  )}
>
  {/* Sheet content */}
</div>
```

**When to use**:

- ✅ Simple lists or selections
- ✅ Quick actions without text input
- ✅ Preview content

**When NOT to use** (use full-screen Dialog instead):

- ❌ Multiple text inputs (iOS zoom issues)
- ❌ Complex forms
- ❌ Long scrollable content

## Responsive Class Patterns

### Show/Hide Elements

```tsx
// Hide on mobile, show on desktop
className = 'hidden md:block'
className = 'hidden md:flex'
className = 'hidden md:inline'

// Show on mobile, hide on desktop
className = 'md:hidden'

// Conditional layout
className = 'block md:hidden' // Mobile only
className = 'hidden md:block' // Desktop only
```

### Responsive Spacing

```tsx
// Smaller padding on mobile
className = 'px-4 md:px-8'
className = 'gap-2 md:gap-4'

// Responsive flex direction
className = 'flex flex-col md:flex-row'
```

### Responsive Grids

```tsx
// Stack on mobile, grid on desktop
className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3'

// Responsive gap
className = 'grid gap-4 md:gap-6'
```

### Responsive Dialog Sizing

```tsx
// From shadcn dialog components
className = 'sm:max-w-md' // 448px max on sm+
className = 'sm:max-w-lg' // 512px max on sm+
className = 'sm:max-w-xl' // 576px max on sm+
```

## Image Gallery Thumbnails

**Desktop**: User preference (`lg`, `md`, `sm`)
**Mobile (<400px)**: Force `lg` size

```tsx
// Grid sizing from src/features/ai-images/components/ImageGallery.tsx
const GRID_MIN_WIDTH: Record<string, string> = {
  lg: '200px',  // Large thumbnails
  md: '120px',  // Medium thumbnails
  sm: '80px',   // Small thumbnails
}

// Applied via inline styles
style={{
  gridTemplateColumns: `repeat(auto-fill, minmax(${GRID_MIN_WIDTH[thumbSize]}, 1fr))`
}}
```

**Mobile Override** (from `app/(authenticated)/images/page.tsx`):

```tsx
const effectiveThumbSize = isMobile ? 'lg' : thumbSize
```

**Rationale**: Small screens need larger tap targets and better visibility.

## Mobile-Specific Considerations

### Touch Targets

- Minimum 44x44px for interactive elements
- Expandable icon buttons use `ExpandableIconButton` component
- Buttons expand on hover/focus to show labels

### Viewport Height

For full-screen modals on mobile, use flexbox layout:

```tsx
// Best: Flexbox approach (recommended for mobile dialogs)
className = 'h-screen max-h-screen flex flex-col' // on DialogContent
className = 'flex-1 overflow-y-auto' // on content div

// Good: Full-screen dialog (when not using flex)
className = 'h-screen max-h-screen p-0 m-0 rounded-none'

// Good: Accounts for header in scrollable areas (legacy)
className = 'h-[calc(100vh-49px)]'

// Good: Accounts for dialog header (49px)
className = 'h-[calc(100%-49px)]'

// Bad: Uses vh on drawers (iOS zoom issues)
className = 'h-[75vh]'
```

### iOS Safari Input Zoom Prevention

To prevent auto-zoom when focusing inputs on iPhone, ensure font-size is at least 16px:

```css
/* In styles.css */
@media screen and (max-width: 767px) {
  input,
  textarea,
  select {
    font-size: max(16px, 1rem) !important;
  }
}
```

**Note**: This is already implemented in `src/styles.css`.

### Scrolling

- Mobile uses native scroll overflow
- Fixed positioning uses `fixed` with appropriate z-index
- Bottom sheets/drawers use `fixed inset-x-0 bottom-0`

### Performance

- Lazy load off-screen images
- Use `loading="lazy"` on img tags
- Minimize re-renders with `useCallback` and `useMemo`

### Auto-Close Behavior

Mobile sheets/drawers should auto-close on route changes:

```tsx
useEffect(() => {
  setOpen(false)
}, [location.pathname])
```

## File Locations

### Mobile-Specific Components

| Component     | Path                                          | Purpose                  |
| ------------- | --------------------------------------------- | ------------------------ |
| `MobileNav`   | `app/(authenticated)/_components/mobile-nav/` | Mobile navigation sheet  |
| `Drawer`      | `src/components/ui/drawer.tsx`                | Bottom drawer (Vaul)     |
| `Sheet`       | `src/components/ui/sheet/sheet.tsx`           | Side sheet (Radix UI)    |
| `PromptSheet` | `src/features/prompts/components/`            | Bottom sheet for prompts |

### Routes with Mobile Logic

| Route                                         | Mobile Pattern                                          |
| --------------------------------------------- | ------------------------------------------------------- |
| `app/(authenticated)/images/page.tsx`         | Full-screen dialog for generator, forced thumb size     |
| `app/(authenticated)/edit.$imageId.tsx`       | Full-screen dialog, simplified header (back + generate) |
| `app/(authenticated)/video.index.tsx`         | Hidden sidebar on mobile                                |
| `app/docs.tsx`                                | Full-screen toggle sidebar                              |
| `app/(authenticated)/_components/app-chrome/` | Mobile nav vs desktop sidebar                           |

## Common Mobile Tasks

### Adding Mobile Detection to a Page

1. **Import dependencies**:

   ```tsx
   import { useEffect, useState } from 'react'
   ```

2. **Add state and media query**:

   ```tsx
   const [isMobile, setIsMobile] = useState(
     () => typeof window !== 'undefined' && window.innerWidth < 400,
   )

   useEffect(() => {
     const mql = window.matchMedia('(max-width: 399px)')
     setIsMobile(mql.matches)
     const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches)
     mql.addEventListener('change', onChange)
     return () => mql.removeEventListener('change', onChange)
   }, [])
   ```

3. **Apply conditionally**:
   ```tsx
   const effectiveValue = isMobile ? mobileValue : desktopValue
   ```

### Converting Sidebar to Full-Screen Dialog on Mobile

For complex panels with inputs (generator, edit, etc.):

```tsx
import { useIsMobile } from '#/lib/hooks/use-is-mobile'
import { MobileDialogHeader } from '#/components'

const isMobile = useIsMobile()

{
  isMobile ? (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-full h-screen max-h-screen p-0 m-0 rounded-none border-0 flex flex-col">
        <MobileDialogHeader
          title="Panel Title"
          onClose={() => setIsOpen(false)}
        />
        <div className="flex-1 overflow-y-auto px-3 py-2">
          <YourPanel />
        </div>
      </DialogContent>
    </Dialog>
  ) : (
    <aside className="w-80 border-l border-border">
      <YourPanel />
    </aside>
  )
}
```

### Converting Sidebar to Drawer (Simple Panels Only)

For simple lists or previews without text inputs:

```tsx
{
  isMobile ? (
    <Drawer open={isOpen} onOpenChange={setIsOpen}>
      <DrawerContent>
        <YourSimplePanel />
      </DrawerContent>
    </Drawer>
  ) : (
    <aside className="w-80 border-l border-border">
      <YourSimplePanel />
    </aside>
  )
}
```

### Responsive Grid

```tsx
<div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
  {items.map((item) => (
    <Card key={item.id} {...item} />
  ))}
</div>
```

### Hide/Show Based on Screen Size

```tsx
{
  /* Desktop only */
}
;<div className="hidden md:block">Desktop content</div>

{
  /* Mobile only */
}
;<div className="md:hidden">Mobile content</div>

{
  /* Both with different layouts */
}
;<div className="flex flex-col md:flex-row">
  <div>Item 1</div>
  <div>Item 2</div>
</div>
```

## Testing Mobile Changes

### Browser DevTools

1. Open Chrome/Firefox DevTools
2. Toggle device toolbar (Cmd+Shift+M / Ctrl+Shift+M)
3. Select device preset or custom dimensions
4. Test breakpoints: 375px, 400px, 768px, 1024px

### Key Widths to Test

- **375px**: iPhone SE (smallest modern phone)
- **390px**: iPhone 12/13 Pro
- **400px**: Custom `xs` breakpoint
- **768px**: `md` breakpoint (primary split)
- **1024px**: `lg` breakpoint

### Mobile-Specific Checks

- [ ] Navigation is accessible (MobileNav opens)
- [ ] Drawers open from bottom (not clipped)
- [ ] Text is readable (not too small)
- [ ] Touch targets are 44x44px minimum
- [ ] No horizontal scroll
- [ ] Images fit viewport
- [ ] Modals don't overflow viewport

## Best Practices

1. **Mobile-first CSS**: Start with mobile layout, add `md:` for desktop
2. **Prefer CSS over JS**: Use responsive classes instead of `isMobile` checks
3. **Use shared utilities**:
   - ✅ `useIsMobile()` hook instead of manual `useState` + `useEffect`
   - ✅ `MobileDialogHeader` for consistent dialog headers
   - ✅ `CircularIconButton` for navigation/action buttons
   - ✅ `BREAKPOINTS` constants instead of magic numbers
4. **Use `isMobile` only when**:
   - Switching components (Dialog vs Sidebar)
   - Runtime value overrides (thumb sizes)
   - Conditional event handlers
5. **Auto-close on navigation**: Mobile dialogs should close when route changes
6. **SSR-safe**: `useIsMobile` handles this automatically
7. **Test at breakpoint edges**: 399px, 767px, 1023px to catch edge cases
8. **Use flexbox for mobile dialogs**: `flex flex-col` + `flex-1` instead of calc() for layout

### Circular Icon Button Pattern

```tsx
// White circular back button (edit pages, etc.)
<Link
  to="/images"
  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
  title="Back to Images"
>
  <ArrowLeft className="h-4 w-4" />
</Link>
```

**When to use**:

- ✅ Primary navigation (back buttons)
- ✅ Modal close buttons (white on dark backgrounds)
- ✅ Mobile-first action buttons
- ✅ Prominent CTAs in full-screen views

## Related Documentation

- [Feature Architecture](../feature-architecture.md) - Feature module patterns
- [Development Workflow](../development-workflow.md) - Testing and deployment
- [Tailwind v4 docs](https://tailwindcss.com/docs) - Responsive utilities
