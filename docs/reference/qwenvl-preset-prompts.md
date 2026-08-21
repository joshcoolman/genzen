# How a ComfyUI node pack steers a vision model

A widely-used ComfyUI custom node, `QwenVL (GGUF)`, gives its users a dropdown of
named instructions -- Tags, Simple / Detailed / Ultra Detailed Description,
Cinematic Description, Detailed Analysis, Short Story, Prompt Refine & Expand --
instead of one fixed way to describe an image. genzen's Describe has two modes
and they are a radio. The dropdown is the interesting part, and the prompts
behind it are legible, so they are quoted here in full to be studied.

## Where this came from and what it is not

Source: [`1038lab/ComfyUI-QwenVL`](https://github.com/1038lab/ComfyUI-QwenVL),
file `AILab_System_Prompts.json`, licensed **GPL-3.0**. The prompt text below is
quoted verbatim from that file and remains the work of its authors under that
license. It is reproduced here for study and commentary only -- nothing in this
document is shipped, imported, or executed by genzen, and no text from it has
been copied into `src/lib/prompts/`. If any of it ever were, the licensing
question becomes real and has to be settled first.

**This is not an industry standard**, and it should not be read as one. It is one
node pack's opinion, hand-written by its author, popular but unratified. It earns
a place in `reference/` because it is a _worked example_ of something genzen does
not have -- a considered library of named instructions -- not because it is
authoritative. Where actual convention exists it is upstream of this: booru-style
tags from the CLIP era, the long-caption format of CogVLM/LLaVA training sets,
JoyCaption, Florence-2's task tokens.

The vendor half of this question is
[`model-prompting-guides.md`](./model-prompting-guides.md): what each image model
says it wants to _read_. This file is the other half: how the model doing the
_writing_ gets steered. Neither is complete alone.

## The image presets

### 🖼️ Tags

> Your task is to generate a clean list of comma-separated tags for a text-to-image AI, based _only_ on the visual information in the image. Limit the output to a maximum of 50 unique tags. Strictly describe visual elements like subject, clothing, environment, colors, lighting, and composition. Do not include abstract concepts, interpretations, marketing terms, or technical jargon (e.g., no 'SEO', 'brand-aligned', 'viral potential'). The goal is a concise list of visual descriptors. Avoid repeating tags.

### 🖼️ Simple Description

> Analyze the image and write a single concise sentence that describes the main subject and setting. Keep it grounded in visible details only.

### 🖼️ Detailed Description

> Write ONE detailed paragraph (6–10 sentences). Describe only what is visible: subject(s) and actions; people details if present (approx age group, gender expression if clear, hair, facial expression, pose, clothing, accessories); environment (location type, background elements, time cues); lighting (source, direction, softness/hardness, color temperature, shadows); camera viewpoint (eye-level/low/high, distance) and composition (framing, focal emphasis). No preface, no reasoning, no <think>.

### 🖼️ Ultra Detailed Description

> Write ONE ultra-detailed paragraph (10–16 sentences, ~180–320 words). Stay grounded in visible details. Include: subject micro-details (materials, textures, patterns, wear, reflections); people details if present (hair, skin tones, makeup, jewelry, fabric types, fit); environment depth (foreground/midground/background, signage/props, surface materials); lighting analysis (key/fill/back light, direction, softness, highlights, shadow shape); camera perspective (angle, lens feel, depth of field) and composition (leading lines, negative space, symmetry/asymmetry, visual hierarchy). No preface, no reasoning, no <think>.

### 🎬 Cinematic Description

> Write ONE cinematic paragraph (8–12 sentences). Describe the scene like a film still: subject(s) and action; environment and atmosphere; lighting design (practical lights vs ambient, direction, contrast); camera language (shot type, angle, lens feel, depth of field, motion implied); composition and mood. Keep it vivid but factual (no made-up story). No preface, no reasoning, no <think>.

### 🖼️ Detailed Analysis

> Output ONLY these sections with short labels (no bullets): Subject; People (if any); Environment; Lighting; Camera/Composition; Color/Texture. In each section, write 2–4 sentences of concrete visible details. If something is not visible, write 'not visible'. No preface, no reasoning, no <think>.

### 📹 Video Summary

> Summarize the key events and narrative points in this video.

### 📖 Short Story

> Write a short, imaginative story inspired by this image or video.

### 🪄 Prompt Refine & Expand

> Refine and enhance the following user prompt for creative text-to-image generation. Keep the meaning and keywords, make it more expressive and visually rich. Output ONLY the improved prompt text (no preface, no bullets, no JSON, no <think>, no commentary).

## The text-only presets

A second section of the same file, for text in / text out — no image. This is
genzen's Enhance, and it is more considered than the image presets above.

### translation_prompt

> You are a professional prompt translator. Return a single English paragraph (150-300 words). No prefixes, bullets, JSON, or <think>. Preserve all visual and stylistic details.

### 📝 Enhance

> You are a professional photography prompt writer. Respond in the same language as the user input.
>
> Write ONE final cinematic photography prompt paragraph (150–300 words) based on the user text.
>
> Strict output rules:
>
> - Output ONLY the prompt paragraph. Start immediately with the scene.
> - Do NOT output any reasoning, planning, or meta text (no "Okay", no "First/Next/Then", no "I/we").
> - Do NOT use <think>, quotes, markdown, code fences, JSON, headings, or bullet points.
>
> Include naturally: subject + action/pose, environment, lighting, camera/lens/DoF, composition, color/texture, mood/style.
>
> If input is short/ambiguous, infer minimal sensible details and keep it coherent.

### 📝 Refine

> You are a photography prompt refiner. Respond in the same language as the user input.
>
> Write ONE clear, concise photography prompt paragraph (120–200 words) that preserves the user’s intent.
>
> Strict output rules:
>
> - Output ONLY the prompt paragraph. Start immediately with the scene.
> - No reasoning, no planning, no meta text (no "Okay", no "First/Next/Then", no "I/we").
> - No <think>, no quotes, no markdown, no code fences, no JSON, no headings, no bullet points.
>
> Include: subject cues, environment context, lighting, camera parameters, composition focus, color/texture hints, and style tone. Remove redundancy.

### 📝 Creative Rewrite

> You are a creative photography prompt writer. Respond in the same language as the user input.
>
> Rewrite the user’s scene into ONE fresh, imaginative photography prompt paragraph (150–250 words).
>
> Strict output rules:
>
> - Output ONLY the prompt paragraph. Start immediately with the scene.
> - No reasoning, no planning, no meta text (no "Okay", no "First/Next/Then", no "I/we").
> - No <think>, no quotes, no markdown, no code fences, no JSON, no headings, no bullet points.
>
> Preserve the core intent while adding vivid imagery and cohesive narrative flair. Integrate subject, environment, lighting, camera hints, composition, color/texture, and style.

### 📝 Detailed Visual

> You specialize in detailed visual photography prompts. Respond in the same language as the user input.
>
> Write ONE flowing, highly visual photography prompt paragraph (180–260 words).
>
> Strict output rules:
>
> - Output ONLY the prompt paragraph. Start immediately with the scene.
> - No reasoning, no planning, no meta text (no "Okay", no "First/Next/Then", no "I/we").
> - No <think>, no quotes, no markdown, no code fences, no JSON, no headings, no bullet points.
>
> Include concrete cues: subject traits and pose, foreground/midground/background, materials and textures, lighting direction/intensity/color temperature, colors and contrast, scale, atmosphere, and composition focus.

### 📝 Artistic Style

> You craft artistic photography prompts. Respond in the same language as the user input.
>
> Write ONE artistic photography prompt paragraph (180–260 words).
>
> Strict output rules:
>
> - Output ONLY the prompt paragraph. Start immediately with the scene.
> - No reasoning, no planning, no meta text (no "Okay", no "First/Next/Then", no "I/we").
> - No <think>, no quotes, no markdown, no code fences, no JSON, no headings, no bullet points.
>
> Weave in subject, scene, and lighting with explicit style references (e.g., cinematic, fashion, fine art), mood, composition cues, and aesthetic adjectives. Keep it cohesive and visually rich.

### 📝 Technical Specs

> You convert scenes into technical photography directives. Respond in the same language as the user input.
>
> Write ONE clear, actionable photography prompt paragraph (130–210 words).
>
> Strict output rules:
>
> - Output ONLY the prompt paragraph. Start immediately with the scene.
> - No reasoning, no planning, no meta text (no "Okay", no "First/Next/Then", no "I/we").
> - No <think>, no quotes, no markdown, no code fences, no JSON, no headings, no bullet points.
>
> Cover: subject and scene plus focal length, aperture, depth of field, shooting angle, lighting type/direction, color temperature, focus target, and composition priorities as sentences.

## What is worth taking

Four techniques, none of which genzen's two describe prompts currently use.

- **Real ranges, not caps.** Every preset states a sentence count, and Ultra
  Detailed states a word range. `describe-reconstruct.md` says "under 400
  characters" -- a truncation threshold tells the model when to stop, not what to
  build.
- **A fixed axis list, held constant across the ladder.** Subject, people,
  environment, lighting, camera viewpoint, composition -- the same axes at
  increasing resolution. That is what makes Simple -> Detailed -> Ultra a ladder
  rather than three unrelated prompts. genzen's two modes share no axes at all.
- **An anti-invention clause in every one.** "Grounded in visible details only";
  "if something is not visible, write 'not visible'". `describe-anchor.md` has a
  version of this. `describe-reconstruct.md` has none, and it is the one whose
  output reaches a paid generation.
- **Blocklists that are scar tissue.** Tags forbids abstract and marketing terms
  and names the offenders. The text presets forbid "Okay", "First/Next/Then" and
  "I/we". Nobody writes those lines speculatively -- they are records of a model
  misbehaving, which is what makes them worth more than the polished sentences
  around them.

Cinematic vs. Ultra Detailed answers a question worth having settled: they are
not the same instruction at two lengths. Cinematic is **shorter** and swaps
forensic detail (materials, wear, reflections, skin tones, fabric) for film-crew
vocabulary (practical vs. ambient light, shot type, lens feel, implied motion) --
plus a guard the other does not need, "no made-up story", because that vocabulary
invites narrative drift. A different professional dialect pointed at one image,
not more of the same.

## What is not worth taking

- **Video Summary and Short Story are one-line throwaways.** The file is not
  uniformly considered; the image presets got the attention. Do not treat the
  whole thing as designed.
- **"No preface, no reasoning, no `<think>`" is local-model hygiene.** It fights
  a GGUF model's tendency to preamble and leak thinking tags. Against Claude,
  "no preface" earns its place and the rest is cargo cult.
- **The prompts themselves.** The transferable thing is the four techniques and
  the shared axis vocabulary, not this wording. Copying the wording would also be
  the one move that turns the license note above from a formality into a problem.
