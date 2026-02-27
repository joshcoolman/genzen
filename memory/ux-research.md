# UX Research

Research from exploring Freepik's video generator UI alongside our FAL-based implementation.

## Model Stack (Freepik defaults)

- **Multiple** -- auto-generates with several models, user picks winner
- Kling 2.5 (default workhorse)
- Kling 2.5 Master (premium tier)
- Kling 2.0 Master
- Google Veo 2.1
- Hunyuan 1.3 Pro

## UX Patterns Worth Considering

### Multi-model generation

Fire same prompt to 2-3 models in parallel, show results side-by-side. Trigger.dev parallel tasks make this straightforward. Freepik leads with this as their top option.

### Aspect Ratio selector

Freepik exposes aspect ratio as a prominent control. Options likely include 16:9, 9:16, 1:1, 4:3. Important for social media targeting (9:16 for Reels/TikTok, 16:9 for YouTube, 1:1 for Instagram feed).

### Model tiering

Separate quality/cost tiers for the same model family (e.g. Kling 2.5 vs Kling 2.5 Master). Could expose as a quality slider or "standard/premium" toggle.

### Left panel layout

Model selector as a simple vertical list with generation settings below -- clean and scannable.

### Style Library

Freepik has a dedicated Styles page -- a visual grid of named style presets (Minimal, Majestic, RetroFuture, etc.) organized by category (Photo, Animation, Design). Each style is a thumbnail showing example output. User picks a style card and it gets applied to their generation automatically.

This is "style-as-a-parameter" -- abstracts away complex prompt engineering into a visual picker. Much more accessible than writing "cinematic, shallow DOF, warm tones..." in a prompt.

For genzen: two implementation approaches:

- **Simple (v1):** Style = name + thumbnail + prompt snippet appended to user text
- **Advanced (v2):** Style = reference image fed as style_reference param to the model (how Freepik actually does it). FAL/Kling support image references, so this is feasible.

Freepik's generation UI has 4 input tabs: Photo prompt / Video / Image reference / Style reference. The style reference is an actual image, not just text -- the model uses it for visual tone matching. This produces more consistent results than prompt text alone.

Also notable: Character references appear as face thumbnails in the left panel, separate from style. So the system is: prompt + style ref image + character ref image(s) = generation.

### Starter Style Presets (5 picks from Freepik's library)

Goal: small curated set, photographic-leaning, reproducible via prompt snippets. Based on Freepik's named categories.

1. **Photo Natural** -- realistic, well-lit, candid feel. The "no style" style with professional polish. Bread and butter for most video generation.
   - Prompt snippet: "natural lighting, photorealistic, candid composition, true-to-life colors, soft natural shadows"

2. **Art** -- painterly, expressive, more interpretive. Adds artistic flair without going full illustration.
   - Prompt snippet: "artistic style, painterly quality, expressive color palette, fine art aesthetic, creative composition"

3. **Product** -- clean, commercial, hero-shot energy. Designed for showcasing objects/items with polished lighting.
   - Prompt snippet: "product photography, clean studio lighting, sharp focus, professional commercial aesthetic, isolated subject"

4. **Cinematic** -- dramatic, moody, film-look. High contrast, shallow DOF, theatrical lighting.
   - Prompt snippet: "cinematic lighting, shallow depth of field, film grain, dramatic shadows, anamorphic lens, movie still"

5. **Cartoon Fun** -- playful, animated, stylized. Good contrast to the photo-realistic styles, appeals to a different use case entirely.
   - Prompt snippet: "cartoon style, playful and colorful, stylized characters, bold outlines, fun animated aesthetic, vibrant palette"

These 5 cover: realistic / artistic / commercial / dramatic / playful. Good range for v1.

### Image Gen as Storyboard Tool

Key insight: the image generator + characters = a rapid storyboarding tool for video. Generate multiple images of the same character in different scenes, then use those as first/last frames for video generation. Workflow:

1. Pick character(s)
2. Generate "scene A" image (first frame)
3. Generate "scene B" image (last frame)
4. Feed both to video gen -> coherent clip with character consistency

This is a tighter loop than genzen's current workflow where first/last frame generation is separate from the video prompt.

### Generation Grouping

Freepik groups results by input parameters (prompt + character + style). Re-generating with same settings adds to the existing group rather than creating a new section. This keeps iterations together and reduces visual clutter. "Generate more" is just hitting the button again -- zero friction for variations.

For genzen: group generations by their input combo. All variations of a scene stay together. Supports the storyboarding mental model where you're iterating on specific scenes.

### Unified Scene Workspace (Big Idea)

The current genzen workflow has image gen and video gen as separate concerns. The Freepik exploration reveals a tighter loop:

**Cast -> Storyboard -> Animate**

1. Cast: pick/create characters (face references)
2. Storyboard: rapid image gen with those characters in different scenes
3. Animate: select first frame + last frame from storyboard, generate video

The workspace should be a **scene workspace** where images and videos coexist. Any generated image can become a first/last frame with one click. Characters persist across all generations. The prompt bar stays consistent whether generating an image or a video.

This reframes the product from "video generator" to "scene builder with animation."

Screenshots saved to `memory/freepik-research/`.

## Open Questions

- How does Freepik handle generation progress/preview?
- What does their result gallery/comparison view look like?
