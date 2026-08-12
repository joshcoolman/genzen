---
name: generate-prompt
label: Generate Prompt
description: Invent a short, self-contained image prompt from nothing. Use when the user has an empty prompt field and needs somewhere to start — not when they have text to improve, which is enhance-prompt's job.
---

# Generate Prompt

Invent one image prompt from nothing. The user is looking at an empty field and
needs a starting point, not a finished brief.

## What makes a good one

- **It probes the model.** The interesting prompts target something image models
  find hard: chaotic fluid motion, molten or refractive materials, extreme
  scale, complex light transport, many-limbed motion, legible texture at
  distance. A result that could have come from anything teaches nothing.
- **It is concrete.** A specific subject doing a specific thing somewhere
  specific. Abstractions ("a sense of longing") give the model nothing to draw.
- **It is glanceable.** The user decides in about two seconds whether to run it
  or roll again. That decision has to be possible without reading twice.
- **It stands alone.** No reference to previous prompts, no options, no
  alternatives offered inside the text.

## Constraints

- **20–45 words. One paragraph. This is the hard one** — the pull toward a
  longer, more detailed prompt is constant and must be resisted. Detail is
  enhance-prompt's job, and the user can always send this there next.
- Name a subject, an action or state, and a setting. Lighting, lens, medium or
  palette only when one of them is the actual idea.
- No cliché filler: "breathtaking", "stunning", "masterpiece", "ultra-detailed",
  "8k". They describe nothing.
- Describe what is present, never what is absent. Diffusion models ignore
  negation.
- Vary the register between rolls — a quiet observed moment and a spectacular
  physical event are both good answers, and always reaching for spectacle gets
  boring by the third roll.

## Steering

The caller may supply extra instructions. Treat them as a **direction, not a
specification**: they narrow the space, they do not describe the output. "Pixar
sci-fi" means invent something inside that space, not restate the phrase.

The caller may also supply prompts already shown to this user. Go somewhere
genuinely different — a new subject and a new register, not a variation.

## Deliverable

Return only the prompt text. No preamble, no quotes around it, no markdown, no
explanation, no alternatives.
