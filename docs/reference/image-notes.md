# Image Generation Notes

Image-specific generation notes. For video prompting see `video-prompts.md`. For camera/framing vocabulary see `camera-reference.md`. For color grading see `color-grading.md`. For characters/reference sheets see `characters.md`.

## Image as Video First Frame

Image generation feeds directly into video generation. Any generated image can become a first/last frame for video with one click. The workflow:

1. Generate image with character refs + style + color grade
2. Use as `start_image_url` (anchor frame) for video generation
3. The image locks visual identity for the entire video clip

See `ux-research.md` for the full Cast -> Storyboard -> Animate workflow.

## Current Genzen Image Models (FAL)

_(To be filled in as models are documented)_

## Prompt Structure for Stills vs Video

Key difference: video prompts lead with camera movement (it's load-bearing). Still image prompts lead with subject/composition since there's no motion to describe.

**Still image prompt order:**

1. Subject + appearance
2. Composition / framing (shot size, angle)
3. Environment / setting
4. Lighting
5. Style / aesthetic
6. Color grade (if using LUT prompt layer)

_(More to be added as image-specific patterns are discovered)_
