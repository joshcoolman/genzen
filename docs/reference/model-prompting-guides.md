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
- **Negative prompts.** FLUX has none, and BFL says negation makes output worse —
  describe the positive alternative instead. Seedream supports them and its guide
  recommends 15–25 terms. Any single rule is wrong for part of the lineup.
- **Shape of the text.** FLUX and Seedream want one flowing description
  (Seedream: 30–100 words). GPT Image wants labelled segments, line breaks, and a
  preservation list — "change only X, keep everything else the same" — or it
  drifts on faces, logos and text.
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
