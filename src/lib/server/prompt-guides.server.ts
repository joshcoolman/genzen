import nanoBananaGuide from '#/lib/prompts/guide-nano-banana-2.md'
import zImageGuide from '#/lib/prompts/guide-z-image-turbo.md'
import { IMAGE_MODELS } from '#/features/ai-images/models'

/**
 * The per-model enhancer instructions, keyed by the path `models.ts` carries
 * (#463).
 *
 * **An explicit map rather than a dynamic import.** `.md` files are imported as
 * strings through a Turbopack loader, which is a build-time transform -- a path
 * assembled at runtime resolves to nothing. So the price of a guide is one line
 * here, and the test below is what stops that line being forgotten.
 *
 * A model with no `promptGuide` is not an error, and is the normal case: six
 * of eight fall back to `enhance-prompt.md`. **An empty map is a valid state**
 * -- the mechanism is worth keeping at zero guides, because the cost of holding
 * it open is this file and the cost of rebuilding it is a feature.
 */
const GUIDES: Record<string, string> = {
  'src/lib/prompts/guide-nano-banana-2.md': nanoBananaGuide,
  'src/lib/prompts/guide-z-image-turbo.md': zImageGuide,
}

/** Every guide path the lineup declares. Exported for the test. */
export function declaredGuidePaths(): Array<string> {
  return [
    ...new Set(
      IMAGE_MODELS.map((m) => m.promptGuide).filter(
        (p): p is string => p != null,
      ),
    ),
  ]
}

/**
 * The instruction for a model, or null when it has none and the caller should
 * use the shared one.
 *
 * Throws on a declared path with no import, because the alternative is a model
 * silently enhancing as though it had no guide -- which looks exactly like
 * working.
 */
export function promptGuideFor(slug: string | undefined): string | null {
  if (!slug) return null
  const path = IMAGE_MODELS.find((m) => m.slug === slug)?.promptGuide
  if (!path) return null
  const guide = GUIDES[path]
  if (!guide) {
    throw new Error(
      `${slug} declares promptGuide "${path}", which prompt-guides.server.ts does not import.`,
    )
  }
  return guide
}
