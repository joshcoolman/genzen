---
name: character-reference-sheet
label: Character Sheet
launch: I want to build a character reference sheet. Help me start.
description: Build a character reference sheet prompt — a single-image multi-pose spec designed for identity consistency across downstream generations. Tuned for Nano Banana / Gemini 2.5 Flash Image. Use when the user asks for a character sheet, character reference, turnaround, or wants a consistent character across multiple generations.
---

# Character reference sheet

A character reference sheet is a single generated image that packs multiple views, poses, and expressions of one character into a coordinated spread. It becomes the _source of truth_ for every future generation of that character — copy the description verbatim, feed the sheet back in as an image reference, or both.

Nano Banana (Gemini 2.5 Flash Image) is the current target model. It's strong at identity consistency _when_ you front-load the spec and tell it explicitly to produce a multi-panel sheet.

## The two-part prompt pattern

Write the prompt in two distinct halves:

1. **The character spec** — a locked description of the character that will be re-used verbatim in every future prompt. Every detail matters because any drift breaks continuity.
2. **The sheet directive** — instructions for _how_ to render the sheet itself (poses, layout, background).

Separating them makes the spec copy-pasteable. The user keeps part 1 forever; part 2 is throwaway scaffolding for this one generation.

## Character spec — what to lock down

Describe in this order, with zero ambiguity. If a detail isn't specified, the model will drift on it between generations.

- **Age + build + height** — "late-20s, athletic build, 5'8""
- **Face** — face shape, jawline, nose shape, lip shape, eye color, eye shape, eyebrow thickness/shape
- **Hair** — exact color (name _and_ hex if you can), length, texture, style, part, any distinctive features (bangs, undercut, streaks)
- **Skin** — tone (warm/cool, light/medium/deep), any distinguishing marks (freckles across the nose, scar over left brow, neck tattoo of a swallow)
- **Clothing** — every garment, by color and material, top to bottom. "Olive canvas field jacket, charcoal henley, faded black jeans, worn brown leather boots, gunmetal watch on left wrist." No "casual outfit." No "dark shirt."
- **Accessories** — glasses, jewelry, hats, bags — specifics only. "Round wire-frame glasses, matte black" not "glasses."
- **Distinguishing quirks** — the _one_ thing that makes them recognizable at a glance. A lock of hair that always falls across the eye. A chipped front tooth. A specific tattoo in a visible spot.

Rule: if a future prompt drops any of these details, the model will invent something different. The spec must travel as a single atomic block.

## Sheet directive — how to render the sheet

After the spec, tell Nano Banana exactly what kind of sheet to produce:

- **Layout**: "character reference sheet, multi-panel layout, 6 distinct views on a single image"
- **Views to include** (pick 4–6, pack them meaningfully):
  - front full-body
  - 3/4 front
  - profile (left or right)
  - 3/4 back
  - back full-body
  - head-and-shoulders close-up
  - expression study (neutral / smile / serious / surprised)
  - hand/prop detail
- **Background**: "plain neutral gray studio background, even diffuse lighting, no cast shadows" — flat lighting preserves identity; dramatic lighting fights the model.
- **Consistency directive**: end with "same character in every panel, identical hair, identical clothing, identical facial features, consistent proportions across views"
- **Anchor the style**: "clean character design sheet, editorial photography style" OR "hand-painted concept art sheet, Iain McCaig style" OR "3D model turnaround reference" — pick one and commit.

## Anti-patterns specific to character sheets

- **Don't** let Nano Banana get "creative" with the pose variations — it will invent wildly different characters. Constrain hard: "neutral standing pose, arms at sides" for turnaround views.
- **Don't** mix dramatic lighting with a reference sheet. Golden-hour backlight looks cool and destroys identity consistency.
- **Don't** use "beautiful" or "stunning" as lead adjectives — they push the model toward generic idealized features. Use specific, even slightly unflattering detail; it's what makes a character _particular_ rather than generic.
- **Don't** describe outfits as a theme ("streetwear," "business casual"). List the exact garments.
- **Don't** skip the consistency directive at the end. It's the single most important sentence in the sheet prompt.

## Using the sheet downstream

Once the user has the sheet, their workflow is: paste the spec block verbatim into every new prompt, optionally attach the generated sheet as an image reference, then vary only the scene/pose/lighting. Identity stays locked because the anchor text and visual reference stay identical.

Mention this in your conversational reply — the user should understand that the spec is _reusable infrastructure_, not a one-off description. That's why getting it right matters.

## When launched directly (no prior context)

If this skill was invoked from scratch — a fresh chip click, no image attached, no character yet defined — **do not** compose a prompt card on the first turn. Start with a short guided conversation:

- "Do you have a source image of the character, a written description, or are we designing from scratch?"
- "What's the genre or setting — sci-fi, contemporary, period, noir, fantasy?"
- "Any must-have traits to anchor on — a specific hair color, a scar, a signature jacket, a tattoo? The distinguishing detail you want the model to never forget."

Ask 2–3 questions max. Once the user answers, you'll have enough to draft the character spec block and then the sheet directive. Compose the prompt card on the second user turn, not the first.

## Deliverable shape

Call `create_prompt_card` with the combined prompt (spec block + sheet directive, clearly separated by a blank line or `---` so the user can lift the spec independently). Title it with the character's name or archetype. Tags: `character-sheet`, `nano-banana`, plus any genre tag that fits (`sci-fi`, `noir`, etc).
