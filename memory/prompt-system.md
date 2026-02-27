# Prompt System

Meta-prompting, model-specific prompt compilation, structured prompts, and the layered generation config.

## Model-Specific Prompt Compiler (Meta-Prompting)

### The pattern

Common workflow in the AI video community: take a model maker's prompting docs, load them into a custom GPT (or similar), then ask it to rewrite your plain-language scene idea into a structured prompt optimized for that specific model. This is **meta-prompting** -- using an LLM to compile human intent into model-native prompt language.

### How genzen does this natively

Instead of external GPTs + PDFs, build it into the prompt enhancement pipeline:

```
User intent (plain language idea)
  -> Prompt compiler (Claude + model-specific profile injected as context)
    -> Structured output (camera, subject, action, environment, lighting, texture, audio)
      -> Final prompt string formatted for the target model
```

The existing `generate-prompt-enhanced.server.ts` already does generic enhancement via Claude. The upgrade: inject a **model prompt profile** into the system prompt based on which model the user is targeting. Different models respond to different prompt structures, tokens, and ordering.

## Layered Generation Config

Features map to composable layers. User picks from each (or uses defaults), writes their idea in plain language, system compiles everything together:

| Layer                    | What it controls                                   | Examples                                                         |
| ------------------------ | -------------------------------------------------- | ---------------------------------------------------------------- |
| **Camera preset**        | Shot size + angle + lens feel                      | "Documentary handheld," "Commercial hero shot," "Noir low-angle" |
| **Camera move preset**   | Movement during the clip                           | "Slow dolly in," "Orbit clockwise," "Static locked"              |
| **Color grade**          | LUT prompt (see `color-grading.md`)                | "Desert Chrome," "Iron City," custom extracted grades            |
| **Style preset**         | Visual tone (see `ux-research.md`)                 | Cinematic, Photo Natural, Cartoon Fun                            |
| **Model prompt profile** | How to translate intent into that model's language | Kling V3 guide, Veo guide, Hunyuan guide                         |

Each layer is a text snippet that gets composed into the final Claude enhancement system prompt. Mix-and-match.

### Why this beats the GPT-with-PDFs approach

| GPT approach                | Genzen approach                                                 |
| --------------------------- | --------------------------------------------------------------- |
| Manual, one model at a time | Multi-model aware -- switch target, prompt auto-rewrites        |
| User must know to do this   | Invisible -- happens automatically during enhancement           |
| Static PDF context          | Updatable profiles -- learn new tricks, all future gens benefit |
| Single-purpose              | Composable -- camera + move + style + model profile all layer   |

## Model Prompt Profiles

Distilled from each model's official docs. Not the full PDF -- just the actionable prompting knowledge. Profiles live in `src/lib/prompts/` as plain text files, loaded at enhancement time based on selected model.

### Example: Kling V3 Profile

```
# Kling V3 Prompt Profile

## Prompt structure (order matters)
Lead with camera movement. Follow with subject + action. End with atmosphere/genre.

## Tokens this model responds well to
- "cinematic lighting" (strong response)
- "shallow depth of field" (strong response)
- DP name references work: "cinematography by Roger Deakins"
- Audio cues inline: "Audio: [description]"

## What to avoid
- Don't combine conflicting camera moves in one shot
- Don't use negative prompts (not supported)
- Avoid vague motion words: "moves", "goes", "shifts"

## Multi-shot specific
- Each shot self-contained with its own camera instruction
- Camera instruction is mandatory per shot
- Use @Element1 syntax for character consistency, not repeated description
```

### v1 implementation path

Simplest version: add a `modelProfile` parameter to the existing prompt enhancement server function. When called, inject the matching profile text into Claude's system prompt alongside the user's intent. The camera vocabulary, shot reference, and style presets already documented become the knowledge base for the camera/move/style layers.

## Structured / JSON Prompts (FAL)

Two approaches on FAL:

**FIBO (Bria)** -- only model with true `structured_prompt` API field. Pass typed objects per scene element with `location`, `relationship`, `relative_size`. Has generate (`bria/fibo/generate/structured_prompt`) and edit (`bria/fibo-edit/edit/structured_instruction`) endpoints. Best for precise foreground/background/overlay control.

**Nano Banana Pro** -- no JSON API field, but accepts stringified JSON in the `prompt` string. Works because it's built on Gemini (LLM). Community-discovered technique. Better spatial composition than natural language. Schema includes subject, photography, background as structured keys.

**For overlay effects (HUD, etc.)**: FIBO's structured edit lets you specify foreground objects explicitly. Nano Banana's JSON-as-string gives decent composition control. FAL workflow chaining Kontext + either model is the best of both worlds.

## FAL Workflows (Model Chaining)

FAL workflows let you chain models into a single pipeline via `workflows/execute`. Define a JSON graph of nodes where outputs from one step feed into the next via `$node_id.field.path` syntax.

**Key use case**: Kontext (face consistency) -> Nano Banana Pro edit (overlays/effects). Kontext preserves identity, Nano Banana handles creative edits it's better at.

- Cost = sum of individual models (~$0.04 Kontext + ~$0.15 Nano Banana = ~$0.19/run)
- Streaming gives intermediate results per step (show Kontext output while Nano Banana processes)
- JS client: `fal.stream("workflows/execute", { input: { ... } })`
- No extra fee for workflow orchestration
