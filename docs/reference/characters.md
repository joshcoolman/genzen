# Character Reference Sheets

How to create consistent character reference sheets for AI image and video generation. A reference sheet locks down a character's identity (face, body, clothing, proportions) so you can reproduce them across multiple generations.

## What is a Character Reference Sheet

A single image showing a character from multiple angles with consistent lighting, proportions, and style. Think of it as a blueprint -- any model that sees this sheet has enough information to reproduce the character faithfully in new scenes and poses.

## Where They're Used

- **First frame for video generation** -- feed as `start_image_url` to anchor character identity across the clip
- **Multi-shot consistency** -- use as an element reference so the same character appears across multiple shots
- **Scene composition** -- reference when generating a scene with multiple characters, each from their own sheet
- **Image-to-image variations** -- use as input for edits, outpainting, or style transfers while preserving identity

## What Makes a Good Sheet

- **Neutral background** -- white or light gray, no environment distractions
- **Consistent lighting** -- flat, even studio lighting across all views. Same direction, intensity, and softness in every panel
- **Multiple angles** -- front, side profile, 3/4 view, and optionally back view
- **Relaxed A-pose** -- arms slightly away from the body so clothing and silhouette are visible
- **Consistent scale** -- same head height and proportions across all panels
- **Clear panel separation** -- thin lines or even spacing between views
- **Detail close-ups** -- portrait-level crops for face detail (front, left profile, right profile)

## Standard Layout

**Top row:** 4 full-body standing views -- front, left profile, right profile, back
**Bottom row:** 3 close-up portraits -- front, left profile, right profile

This gives you both the full silhouette and the facial detail a model needs to reproduce the character.

## Creating Sheets with Nano Banana 2

Nano Banana 2 (`fal-ai/nano-banana-2`) works well for character sheets because it's built on Gemini and handles structured, descriptive prompts effectively. Use the `/edit` endpoint when working from a reference image, or the base endpoint for text-only generation.

### From a Reference Image

Use `fal-ai/nano-banana-2/edit` with the reference image as input:

```
Create a professional character reference sheet based strictly on the
uploaded reference image. Use a clean, neutral plain background and
present the sheet as a technical model turnaround while matching the
exact visual style of the reference (same realism level, rendering
approach, texture, color treatment, and overall aesthetic).

Arrange the composition into two horizontal rows.

Top row: four full-body standing views placed side-by-side in this
order: front view, left profile view (facing left), right profile view
(facing right), back view.

Bottom row: three highly detailed close-up portraits aligned beneath
the full-body row in this order: front portrait, left profile portrait
(facing left), right profile portrait (facing right).

Maintain perfect identity consistency across every panel. Keep the
subject in a relaxed A-pose with consistent scale and alignment between
views, accurate anatomy, and clear silhouette. Ensure even spacing and
clean panel separation, with uniform framing and consistent head height
across the full-body lineup and consistent facial scale across the
portraits.

Lighting should be consistent across all panels (same direction,
intensity, and softness), with natural, controlled shadows that preserve
detail without dramatic mood shifts.

Output a crisp, print-ready reference sheet look, sharp details.
```

### From Text Description Only

Same layout prompt, but replace the first line:

```
Create a professional character reference sheet of [CHARACTER DESCRIPTION].
Use a clean, neutral plain background and present the sheet as a technical
model turnaround in a photographic style.

[...same layout and quality instructions as above...]
```

Replace `[CHARACTER DESCRIPTION]` with specific traits: age, gender, build, skin tone, hair color/style, clothing, and any distinguishing features.

### Prompting Tips

- **Be specific with traits** -- "short copper hair, freckles, dark green military jacket" not "a woman in a jacket." Vague descriptions cause drift between panels.
- **Lock trait language** -- if you say "emerald eyes" in one generation, use exactly "emerald eyes" again. Synonyms like "green eyes" cause subtle visual drift.
- **Specify the style explicitly** -- "photographic," "stylized 3D," "2D animation" -- otherwise the model picks its own interpretation.
- **Request "orthographic camera"** -- reduces perspective distortion across panels, keeping proportions consistent.

## Triptych (Quick Alternative)

When you don't need the full 7-panel sheet, a triptych gives you three angles in one generation:

```
A clean studio-style triptych portrait of the same character, divided
into three vertical sections: left, center, and right, separated by
thin, subtle lines.

The character is [CHARACTER DESCRIPTION].

The framing is a medium close-up showing only the top half of the body
(chest-up), allowing for clear, realistic skin texture and facial detail.
```

Three angles (left profile, front, right profile) in one shot. Cheaper and faster than the full sheet, useful when you just need face consistency for video frames.

## Workflow: Sheet to Scene to Video

1. **Generate character sheet** -- one per character, using the prompts above
2. **Generate scene** -- reference the sheet(s) as image input so the model picks up identity, clothing, and style
3. **Use scene as first frame** -- the composed scene becomes `start_image_url` for video generation

This gives you character consistency across shots because identity is locked in via the reference sheet rather than re-described from scratch each time.
