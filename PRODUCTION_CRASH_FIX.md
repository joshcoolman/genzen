# Production Crash Fix - Missing Import

## Issue

Production site was crashing with:

```
ReferenceError: X is not defined
```

The entire `/dashboard/ai-images` page showed "Something went wrong!" error screen.

## Root Cause

During the mobile UI refactor (commit 2723517), the `X` icon import from `lucide-react` was accidentally removed from `src/routes/dashboard/ai-images.tsx`:

```diff
-  X,
 } from 'lucide-react'
```

However, `X` was still being used on **line 798** for the desktop generator panel close button:

```tsx
<button onClick={() => setGeneratorOpen(false)}>
  <X className="h-3.5 w-3.5" /> {/* ❌ X not imported */}
</button>
```

The mobile version uses `MobileDialogHeader` component (which has its own `X` import), so the mobile dialog worked fine. But the desktop sidebar still referenced the undefined `X`.

## Why It Wasn't Caught Locally

- TypeScript/ESLint checks passed because the import existed in other files
- The error only manifests at runtime when the desktop sidebar is rendered
- Production build may have different tree-shaking behavior than dev

## The Fix

Re-added `X` to the lucide-react imports:

```tsx
import {
  ArrowDown,
  ArrowUp,
  FolderInput,
  Group,
  Info,
  LayoutGrid,
  Pin,
  PinOff,
  Plus,
  Trash2,
  Ungroup,
  Upload,
  X, // ✅ Added back
} from 'lucide-react'
```

## Files Changed

- ✅ `src/routes/dashboard/ai-images.tsx` - Added `X` back to imports

## Prevention

1. **Always test desktop AND mobile** views before deploying
2. **Check for unused import warnings** - ESLint may have flagged `X` as unused for mobile-only view
3. **Run production build locally** before deploying:
   ```bash
   pnpm build
   pnpm preview
   ```
4. **Test critical paths** after refactoring (generator panel open/close on both mobile and desktop)

## Deployment

After this fix:

1. Commit the change
2. Push to production
3. Test on both desktop and mobile
4. Verify no console errors
5. Test the grouping feature on iPhone to address the original issue
