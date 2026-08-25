# What each model's own prompting guide says

Every model in the lineup publishes a prompting guide, and they contradict each
other on the specifics genzen currently hard-codes one way. Collected in #302,
kept here because it is knowledge rather than a task — the work itself happens
in the lab (#424), where a change to an instruction can actually be judged.

## The guides

| Model              | Guide                                                                                                                                                                       |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FLUX.2             | [black-forest-labs/skills](https://github.com/black-forest-labs/skills) — `flux-image-best-practices/rules/*.md`; also [docs.bfl.ml/llms.txt](https://docs.bfl.ml/llms.txt) |
| Nano Banana 2      | [Google Cloud: Ultimate prompting guide for Nano Banana](https://cloud.google.com/blog/products/ai-machine-learning/ultimate-prompting-guide-for-nano-banana)               |
| Seedream v4 / v4.5 | [fal: Seedream v4.5 prompt guide](https://fal.ai/learn/devs/seedream-v4-5-prompt-guide)                                                                                     |
| Z-Image Turbo      | [Tongyi-MAI/Z-Image-Turbo prompting guide](https://huggingface.co/Tongyi-MAI/Z-Image-Turbo/discussions/8) (HF discussion, from the authors)                                 |
| GPT Image 2        | [OpenAI cookbook: GPT Image models prompting guide](https://developers.openai.com/cookbook/examples/multimodal/image-gen-models-prompting-guide)                            |

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
- **Length is not a dial, it is a disagreement.** FLUX.2 says "Start short. Add
  only what changes the image" and lands at 30-80 words. Seedream wants 30-100.
  Z-Image Turbo wants the opposite: Tongyi-MAI say it performs best on detailed,
  extended prompts, its demo caps at 512 tokens and local use raises
  `max_sequence_length` to 1024 for longer ones. **Verified 2026-08-21 against
  FAL's OpenAPI**: `fal-ai/z-image/turbo` has no `negative_prompt` and no
  `guidance_scale` field at all — it is a few-step distilled model that does not
  run classifier-free guidance, so there is nowhere for a negation to go. It
  does carry `enable_prompt_expansion`, FAL's own prompt expander, at +0.0025
  credits per request; genzen does not use it, because an expander we cannot
  read or edit is the opposite of the point.
  **The 80-200 word range in genzen's guide is ours, not the vendor's** — the
  authors say "long and detailed" without a number, and the specific ranges
  circulating (80-250) are community-derived. Treat it as a starting point to
  tune in the lab, which is what #463's own warning about numbers not
  transferring was about.
- **Reference images want to be named in the prompt.** Nano Banana (up to 14) and
  GPT Image both expect them referenced by index — "apply Image 2's style to
  Image 1's subject". genzen sends an ordered set and says nothing about it.
- **Editing and generating are different prompt languages** for every one of
  these. FLUX edits want terse instructions ("Change the car colour to red"),
  not scene descriptions.

## What genzen does today

**Both paragraphs that used to sit here were overtaken by #463 and #465, on
2026-08-21.** Enhance now takes the model it is for, and a model that declares a
`promptGuide` in `models.ts` is enhanced by that file instead of the shared one.
The comparison happens on `/lab/enhance`, which runs one idea through several
models at once and prints the file behind each card.

The shared `enhance-prompt.md` is no longer the ten-step cinematographer's
pipeline described above. It was written in April 2026 as a _skill_ for the AD
assistant's registry and never reviewed as an enhancer instruction; run in the
lab it produced 1072 characters from eight words, because all ten of its steps
were mandatory and each demanded a named value — film stock, colour harmony,
focal length — whether or not the idea implied one. It is now FLUX.2's
discipline with the vendor stripped out: a slot order to drop from rather than
fill in, a length ladder, a deletion test, and one rule neither predecessor had
— invent as little as possible.

**Two models carry their own guide**, and the ratio is the point: the fallback
is the product, a guide is the exception, and a guide earns its place only by
diverging from the baseline in a way rewording cannot express.

| model         | why it has one                                                                                                                          |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Nano Banana 2 | wants narrative sentences where the baseline asks for a comma-separated list — a different output structure, not a different vocabulary |
| Z-Image Turbo | wants a long prompt where the baseline says start short — the two instructions contradict each other outright                           |

FLUX.2 Pro had one and lost it. Once the baseline became FLUX's own discipline
genericized, the guide and the baseline said the same thing in the same shape —
218 characters against 183 on the same prompt — so it was carrying nothing, and
a per-model file that merely agrees with the default is one that will drift out
of sync with it and be believed anyway.

Still true, and still the reason this file exists: **editing and generating are
different prompt languages** for every vendor here, and nothing has been written
for the editing side.

## The other half

This file collects what each model says it wants to **read**.
[`qwenvl-preset-prompts.md`](./qwenvl-preset-prompts.md) is the writing side —
how a vision model gets steered into producing a prompt at all, quoted from a
ComfyUI node pack that gives its users a dropdown of named instructions where
genzen's Describe has two hardcoded modes.

Sibling: [`qwenvl-preset-prompts.md`](./qwenvl-preset-prompts.md) — a captured
preset library from a ComfyUI node pack, the writing side of the same question.
