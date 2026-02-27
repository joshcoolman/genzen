# Color Grading

LUT prompts as a composable layer in the generation pipeline. See `prompt-system.md` for how this fits into the full compilation stack.

## The 10-Field LUT Prompt Format

Fixed structure, always in this order. 1-3 expressive words per field, ~25-35 words total. No numeric values, no brand references, no film titles.

```
color grade: [GradeName] -- shadows [x], midtones [x], highlights [x],
  skin tones [x], saturation [x], contrast [x], atmosphere [x],
  lighting [x], texture [x], tone curve [x]
```

## Examples

```
color grade: Desert Chrome -- shadows deep cyan, midtones vivid amber,
  highlights golden white, skin tones sun-baked and warm, saturation bold,
  contrast high and crunchy, atmosphere blistering desert heat,
  lighting backlit golden hour, texture dusty matte, tone curve punchy S-curve

color grade: Iron City -- shadows cool steel, midtones neutral grey,
  highlights icy white, skin tones muted natural, contrast high and precise,
  atmosphere tense and industrial, lighting cold overhead fluorescent,
  texture clean metallic, saturation desaturated, tone curve linear with crushed blacks

color grade: Verde Bloom -- shadows soft green, midtones peach,
  highlights white, skin tones glowing and healthy, contrast low,
  atmosphere calm and romantic, lighting diffused natural window,
  texture soft grain, saturation gentle vibrance, tone curve lifted and airy
```

## Two Modes in Genzen

**1. Pre-built library** -- ship 10-15 named grades as a visual picker grid. Each grade is just a text snippet injected during prompt compilation. User picks "Desert Chrome" the same way they pick a style preset or camera move. Zero skill required.

**2. Extract from reference image** -- user uploads a screenshot from a film they love. Claude analyzes it and generates a LUT prompt on the fly. User names it and saves to their library. "Show, don't tell" -- most users can't articulate color grading vocabulary but they can screenshot a frame they like.

## Full Scene Decomposition

The same extract-from-reference pattern works beyond color. Screenshot a frame, Claude decomposes it across all cinematographic dimensions:

```
Frame analysis: [scene description]

camera: Wide shot, eye level, 35mm lens, deep focus
movement: Slow dolly forward
color grade: Dust Haze -- shadows warm brown, midtones desaturated
  amber, highlights blown cream, skin tones weathered and muted,
  saturation low, contrast flat and hazy, atmosphere oppressive dry
  heat, lighting harsh overhead noon, texture grainy matte,
  tone curve flat with lifted blacks
lighting: Hard overhead, minimal fill, practical sun only
composition: Subject centered, leading lines from road edges
mood: Dread, inevitability
```

This produces a **scene recipe** -- reusable and remixable. Change the color grade but keep the camera. Keep the mood but swap the environment. Each dimension is independently tweakable because they're structured as separate fields.

## System Prompt for LUT Extraction

For the extract-from-reference feature, the Claude system prompt:

```
You are a professional cinematic color grade expert.
Analyze the provided image and output a LUT-style natural language color grade prompt.
Express how the image feels through color, light, and texture -- in concise cinematic language.

Output format:
color grade: [GradeName] -- [description]

Every color grade must include these 10 fields in order:
shadows, midtones, highlights, skin tones, saturation, contrast,
atmosphere, lighting, texture, tone curve

Rules:
- 1-3 expressive words per field (~25-35 words total)
- No numeric values (no Kelvin, no percentages)
- No brand references (no LUT names, no ACES terms)
- No film titles
```
