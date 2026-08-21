# What each model's own prompting guide says

Every model in the lineup publishes a prompting guide, and they contradict each
other on the specifics genzen currently hard-codes one way. Collected in #302,
kept here because it is knowledge rather than a task — the work itself happens
in the lab (#424), where a change to an instruction can actually be judged.

## The guides

| Model                               | Guide                                                                                                                                                                       |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FLUX.2                              | [black-forest-labs/skills](https://github.com/black-forest-labs/skills) — `flux-image-best-practices/rules/*.md`; also [docs.bfl.ml/llms.txt](https://docs.bfl.ml/llms.txt) |
| Nano Banana 2                       | [Google Cloud: Ultimate prompting guide for Nano Banana](https://cloud.google.com/blog/products/ai-machine-learning/ultimate-prompting-guide-for-nano-banana)               |
| Seedream v4 / v4.5                  | [fal: Seedream v4.5 prompt guide](https://fal.ai/learn/devs/seedream-v4-5-prompt-guide)                                                                                     |
| GPT Image (retired from the lineup) | [OpenAI cookbook: GPT Image models prompting guide](https://developers.openai.com/cookbook/examples/multimodal/image-gen-models-prompting-guide)                            |

## Where they disagree

These are the conflicts that make a single instruction impossible, not stylistic
preferences.

- **Word order is reversed between vendors.** FLUX and Seedream want the subject
  first, and Seedream explicitly weights earlier tokens. GPT Image wants
  background/scene, then subject, then details, then constraints.
- **Negative prompts.** BFL is explicit: "Most FLUX models do not support
  negative prompts", and negation backfires because the model fixates on the
  thing named. Both FLUX.2 and Nano Banana tell you to write the positive
  replacement instead. **Re-checked 2026-08-21:** the Seedream v4.5 guide does
  not mention negative prompts at all — an earlier version of this file said it
  recommended 15–25 terms, which its current guide does not support.
- **Shape of the text.** **Re-checked 2026-08-21 and this was wrong about
  FLUX.** FLUX.2's guide publishes a slot order — `[SUBJECT], [LOCATION],
[STYLE], [CAMERA], [LIGHTING], [COLORS], [EFFECT], [EXTRAS]` — and a length
  ladder (10–30 short, 30–80 normal, 80–300+ for multi-subject), with "Start
  short. Add only what changes the image." Nano Banana wants the opposite:
  "A simple list of keywords won't cut it; you need to describe the scene
  narratively." Seedream wants 30–100 words and weights earlier tokens. GPT
  Image wants labelled segments, line breaks, and a preservation list — "change
  only X, keep everything else the same" — or it drifts on faces, logos and
  text.
- **Reference images want to be named in the prompt.** Nano Banana (up to 14) and
  GPT Image both expect them referenced by index — "apply Image 2's style to
  Image 1's subject". genzen sends an ordered set and says nothing about it.
- **Editing and generating are different prompt languages** for every one of
  these. FLUX edits want terse instructions ("Change the car colour to red"),
  not scene descriptions.

## What genzen does today

`src/lib/prompts/enhance-prompt.md` prescribes one dense paragraph, 40–120 words,
subject-first, "describe what is present, never what is absent". That is close to
optimal for FLUX and Seedream, mediocre for Nano Banana, and wrong for the
segment-and-constraint models.

**Enhance does not know which model it is for.** `enhance-prompt.action.ts` takes
`{ prompt }` and nothing else. The signal is available — the panel knows the
model and `endpointFor()` already resolves generate-vs-edit — it is simply not
threaded through. That is the smallest real change if per-model enhancement is
ever wanted.

## The other half

This file collects what each model says it wants to **read**.
[`qwenvl-preset-prompts.md`](./qwenvl-preset-prompts.md) is the writing side —
how a vision model gets steered into producing a prompt at all, quoted from a
ComfyUI node pack that gives its users a dropdown of named instructions where
genzen's Describe has two hardcoded modes.

Sibling: [`qwenvl-preset-prompts.md`](./qwenvl-preset-prompts.md) — a captured
preset library from a ComfyUI node pack, the writing side of the same question.
