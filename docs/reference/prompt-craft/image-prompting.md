---
name: image-prompting
label: Image Prompt
launch: I want to write an image generation prompt. Help me get started.
description: Write or improve a text-to-image generation prompt for a general image model (FLUX, Imagen, Seedream, SDXL). Use when the user asks for help writing a prompt, rewriting a prompt, or generating an image from a described scene — and no more specific skill applies.
---

# Image prompting

A recipe for turning loose creative intent into a dense, high-signal text-to-image prompt that survives the round trip through a diffusion model without losing the user's vision.

## Structure (word order = priority order)

Lead with the main subject, then action or pose, then style and look, then environment/context, then secondary detail. What comes first gets the most weight.

`<Subject> → <Action/Pose> → <Style/Look> → <Lighting> → <Environment/Context> → <Detail>`

Target 30–80 words for controlled output. Under 30 for fast exploration. 80+ only for dense multi-element scenes. A wall of text drowns the subject.

## High-impact levers (in order)

1. **Lighting.** The single biggest shaper of mood. Describe quality, direction, and source. "Hard side-light from a single practical bulb, deep shadows carving the face" >> "well lit." "Golden-hour backlight, soft lens flare" >> "sunny."
2. **Hardware and stock** anchor era and texture better than adjectives. "Shot on Kodak Portra 400, natural grain" >> "film look." "Fujifilm Superia 400, slight overexposure, muted saturation" >> "vintage." Lens choice is shorthand for genre: 85mm portraits, 35mm documentary/street, 24mm cinematic/spatial, 135mm compressed telephoto.
3. **Color specificity.** For precision, tie hex codes to objects: "jacket in #2C3E50, wall in #F5F0E8." For mood, name the relationship: "warm skin against desaturated blue shadow." Avoid generic "colorful."
4. **Composition.** Symmetrical center-frame, rule of thirds, Dutch tilt, low-angle hero shot, overhead flat-lay, extreme close-up — name the frame, don't describe it.
5. **Texture and surface.** "Cracked matte ceramic," "polished brass with fingerprints," "raw concrete with water stains." Surface detail sells photorealism.

## Describe what is present, never what is absent

Diffusion models largely ignore negation. Rewrite:

- "no blur" → "tack-sharp focus throughout"
- "no harsh shadows" → "soft, diffused key light"
- "no text" → (leave it out; omission is the tool)
- "not cartoon" → "photorealistic, 35mm film grain"

## Expanding aesthetic references

When the user names a reference — a director, photographer, designer, brand, era — translate it into visual DNA instead of echoing the name. The model understands properties better than proper nouns.

- "Wes Anderson" → symmetrical center-frame, muted pastel palette with earthy accents, slightly theatrical staging, shallow depth of field, props with personality, warm-but-clinical light
- "Gregory Crewdson" → cinematic wide shot, twilight blue hour, eerie practical lighting from windows, suburban melancholy, shallow focus on a distant figure
- "90s Kodak disposable" → Kodak Gold 200, hard on-camera flash, slight color cast, visible grain, blown highlights, low-rent suburban interior
- "Blade Runner 2049" → anamorphic wide, monolithic architecture, heavy atmospheric haze, single saturated color dominance (amber, teal, magenta), silhouetted figures against light

Always pair the reference with the user's actual subject so the model doesn't regress to the reference's signature content.

## For text in the image

Put copy in quotes. Specify placement. Describe letterform style.

`"OPEN" stenciled in white, top-left corner, military sans-serif`

`"Midnight Diner" in handpainted cursive neon, pink on blue, centered above the door`

## Anti-patterns

- Generic adjectives doing all the work: "beautiful, amazing, detailed, masterpiece" — filler. Cut them.
- Describing the photographer's intent instead of the image: "a powerful photo that makes you feel..." — the model can't render feelings, only pixels.
- Piling on styles: "oil painting, watercolor, photorealistic, anime" — pick one visual language per prompt.
- Missing aspect-ratio cues when composition depends on it. If the user mentioned PPT deck / social / billboard, encode it in the composition language ("wide cinematic frame with negative space left of subject for overlay text").

## When launched directly (no prior context)

If this skill was invoked from scratch — a fresh chip click, no image attached, no prior scene discussed — **do not** compose a prompt card on the first turn. Start a short conversation. Ask 1–2 focused questions that unblock the prompt, such as:

- "What's the subject? A person, a place, an object, an abstract mood?"
- "Any aesthetic reference I should translate — a director, photographer, era, film, brand?"
- "Target model — FLUX, Imagen, Seedream, something else? And intended use: social post, PPT slide, print?"

Pick the 1–2 questions that matter most for the apparent intent. Keep it tight. The second user message is where you compose the prompt card.

## Deliverable shape

After extracting signal from the user's input and applying the structure above, call `create_prompt_card` with:

- `prompt`: the finished prompt, tight and ordered
- `title`: 2–5 word handle (optional)
- `tags`: 3–5 keywords capturing model, style, or use case

Provide one conversational sentence naming what you captured — not an essay on your reasoning. The card does the heavy lifting.
