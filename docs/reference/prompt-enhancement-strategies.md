# Prompt enhancement strategies

Reference, not a plan. Ideas for how a prompt might be rewritten before it reaches
an image model — the "why" layer above `src/lib/prompts/` and the enhancer that
`/lab/enhance` exercises.

Nothing here is on genzen's board. **Written in bootsy in July 2026 and moved here
when that repo was retired**, so it argues from an app with a per-model "mediator"
seam that genzen does not have. The reasoning survives the move; that plumbing did
not, and every reference to it has been rewritten. Captured from a discussion
2026-07-22.

Treat the model facts as a **2026-07 snapshot** — the section at the bottom has
certainly rotted by now. The durable claim is the rule above it: style follows the
text encoder.

## Where it came from

DSPy (Stanford) and, loosely, NestJS. We are **not** adopting either. What's worth
stealing is a single stance both share: **declarative over imperative — declare
intent, let a machine generate the artifact.** NestJS declares `@Controller()` and
the framework writes the wiring. DSPy declares a _signature_ (`context, question ->
answer`) and a _module_ (`ChainOfThought`, `ReAct`, …) compiles it into the actual
prompt string. "Let the model write the prompt" is the analogue of "let the
framework write the wiring." Same allergy to hand-authoring a fiddly artifact.

The catch worth remembering: NestJS gets real determinism because the framework's
behavior is fixed. DSPy borrows the _feeling_ of that structure but the thing
underneath is still stochastic. So this is **declared structure around fuzzy
execution.** Steal the declarative shape; don't believe the determinism.

## The core idea: strategy is data, not code

DSPy's insight in one line: swap the module, get a different strategy, without
rewriting the prompt. The reason that matters _here_ is that the winning strategy
for image models is a **moving target** — tag soup in 2023, prose in 2025, terse in
some 2026 models. A strategy baked into code decays. A strategy held as data
(an enum, a per-model attribute) adapts by swapping, not rewriting. **The
volatility of the domain is what justifies the abstraction.**

## The pipeline: classify → route → treat

The rewriter is not one transform. It is:

1. **Classify** the incoming prompt. Rough classes: _detailed /
   unambiguous_, _vague / under-specified_, _not an image request at all_.
2. **Route** on the class — plain control flow, DSPy's `forward()`.
3. **Treat** — each class maps to a strategy module.

The elegant part: **"detailed → do nothing" is a first-class strategy**, a null
transform sitting in the same switch as "vague → enhance." An expert's precise
prompt is passed through _untouched, deliberately_ — the passthrough is chosen, not
the absence of a choice. That answers "what do we do with each class?"
structurally: each class is a module, one of which is identity.

## Two axes of strategy

A treatment has two independent dimensions, both **read off the model**:

- **Dialect** — _how to phrase_. `prose | tags | short`. Which one is not a guess:
  it follows the model's **text encoder** (see snapshot below). This is the closest
  thing to determinism available — the _selection_ of strategy is derivable even
  though the _execution_ isn't.
- **Enrichment** — _what to inject_. Not rewording but adding real-world grounding
  the user didn't supply (geography, era detail, a style reference), because a
  given model reasons well over it. This exploits a model's _capability_, not just
  its phrasing preference. **Caveat from research:** the "nano banana understands
  map coordinates" story is real but conflated. What's documented is _Search
  grounding_ (Gemini fetches real facts before rendering). Coordinate → place
  reconstruction is a real _emergent_ behavior, not a GPS feature; the elaborate
  "geospatial + astronomical" mechanism circulating on blogs is unsourced. Design
  implication: for reliable grounding, **we inject the facts** (LLM/search adds them
  to the prompt) rather than trusting the image model to do it. That keeps
  enrichment a strategy we control, not magic we hope for.

So: **strategy = dialect + enrichments, both a function of the model, gated by the
classifier.** That composition is the DSPy `forward()` — a per-model pipeline of
small modules — which needs a per-model prompt seam to land on. genzen has one
guide per model in `src/lib/prompts/` (`guide-nano-banana-2.md`,
`guide-z-image-turbo.md`); that is where a dialect would go.

## The template is a rubric, not a format

The classic image-prompt scaffold — _subject · action · environment · composition ·
camera · lighting · color · style · mood_ — still holds, and both Black Forest Labs
(FLUX) and Google (Gemini) ship almost exactly it. But two corrections:

- It is a **checklist the agent covers, not a string it emits.** Modern models want
  coherent prose that _hits_ those beats, not the comma-separated slots themselves.
  Drop irrelevant slots rather than max them out.
- **Front-load** the high-priority slots — several models parse sequentially.

The enhance module's shape is therefore `vague_prompt -> {filled slots}` then a
compose step that renders them into one paragraph — filling blanks, then flattening.

## The load-bearing tension: filling blanks is inventing

Rewording a vague prompt is a small liberty. Injecting invented lighting, a camera
angle, or fetched coordinates is the agent writing _most_ of the prompt. That is
exactly the gift the vague prompt wants and exactly the violation an expert's prompt
must never suffer. **The more powerful the transform, the more it lives or dies on
the classifier upstream.** Enrichment especially: misread a deliberately-minimal
expert prompt as "vague" and you bulldoze it with research they never asked for.
This is the argument for keeping the passthrough branch, and for making the
classifier's precision a real concern — not a nicety.

This is not a hunch — it is measured. A UC Berkeley study (1,891 participants)
found DALL-E 3's silent, always-on prompt rewrite **erased ~58% of its quality
advantage** over DALL-E 2: the rewrite helped novices and clobbered
already-good prompts. **"Always rewrite" is empirically wrong.** The classifier's
single most valuable job may be _deciding not to touch it._

## Prior art (survey 2026-07, will date)

The pattern is not novel — which is reassuring, and there are lessons in how others
did it:

- **The industry converged on a three-state toggle: Off / On / Auto.** "Auto" _is_
  classify-then-branch. Ideogram's Magic Prompt "Auto" decides per-image whether to
  enhance — using **prompt length** as a crude classifier (short → enhance,
  detailed → leave alone). Leonardo ships Off/On/V3; Vertex AI (Imagen) exposes a
  rewrite toggle as an explicit API parameter. So the Off/On/Auto shape is the
  mainstream default. genzen has no such toggle in the generator panel at all —
  enhancement is a lab page you go to deliberately, which is Off/On collapsed
  into "did you visit it".
- **DALL-E 3 fuses two jobs into one invisible step: quality-enhance _and_ covert
  moderation.** OpenAI officially frames the rewrite as "a safety and moderation
  feature." Lesson: **keep safety-classify and quality-enhance as separate
  branches** — different decisions, different failure modes. Don't inherit the
  fusion.
- **The router→rewriter→composer architecture is published (APE / MAPE, arXiv
  2606.00204, 2026)** and post-trains _small_ models for the enhancement step so you
  don't pay a frontier-LLM call per generation — the direct answer to the cost
  objection classify-then-rewrite otherwise raises. SuperPrompt (77M-param T5) makes the same point: the enhancer doesn't need
  to be big.
- **Promptist (Microsoft, NeurIPS 2023)** is the canonical rewriter, and its clever
  core is the reward: an RL-tuned model where **the reward is the generated image's
  aesthetic + alignment score**, not "nicer-looking prompt text." Optimize the
  rewriter against the _image output_, not against the prose. That reframes what a
  good rewrite even is.
- **Elicit rather than rewrite** is a live alternative (Adaptive Prompt Elicitation,
  arXiv 2602.04713): when a prompt is underspecified, _ask the user_ for the missing
  detail instead of silently guessing. A different answer to the vague branch — no
  invention, no clobber risk, at the cost of a round-trip.
- **Eval-set trick: "prompt vaguenization."** Take known-good prompts and use an LLM
  to _degrade_ them into vague ones — instant paired `(vague → good)` data to test a
  classifier and a rewriter against, without hand-labelling.

## Model snapshot (2026-07, will date)

Style follows the encoder — this is the one durable rule; the specifics rot.

- **CLIP-only** (SD 1.5) → tag soup. The origin of the keyword habit.
- **CLIP + T5 / LLM-grade** (FLUX, SD 3.5, Gemini "nano banana", Ideogram, Recraft)
  → natural-language prose; tag stacking actively _degrades_ output.
- **Length is model-specific and contradictory, correctly so:** FLUX wants ≥50
  words of scene direction; Midjourney V7 punishes >~60; Ideogram caps ~150. Any
  single universal length number is wrong. A shared prompt string fanned across
  every model is therefore architecturally at odds with the field.
- **"Short and sweet" is real but conditional:** newer models forgive _terse_ input
  and punish _padding_ — but do **not** forgive _vague_. What died is padding, not
  detail. So the model won't rescue a vague prompt for you; the classify/enrich
  decision stays ours.

## Open questions (deliberately unresolved)

- **Separate classify call vs. folded into one call.** DSPy keeps modules separate
  so each is independently tunable; cost wants a single Claude call that both
  judges and rewrites. Clean vs. cheap — unsettled.
- **Is "detailed vs vague" a clean 3-class problem or a spectrum** that resists a
  hard label? A confidence score may be truer than an enum.
- **Enrichment cost.** Every enrichment is a speculative extra web/LLM pass —
  latency and spend on a guess. Worth it only when the upside (surprise-the-user)
  clears the risk of a misread.

## Where this meets genzen

Two of the three things this doc argues for already exist here, which is most of
why it was worth carrying over.

- **The per-model dialect seam is built.** `src/lib/prompts/guide-*.md` is one
  instruction per model, mapped by `src/lib/server/prompt-guides.server.ts`, with
  `enhance-prompt.md` as the fallback — seven of eight models take the fallback
  today, and that is the intended resting state. "Dialect follows the text
  encoder" is exactly the reason a guide would ever diverge, and `models.ts`
  already says a guide earns its place only by diverging and loses it when it
  stops.
- **The bench for judging a rewrite is built.** `/lab/enhance` runs one idea
  through several models side by side. The doc's "prompt vaguenization" trick —
  degrade known-good prompts with an LLM to get paired (vague → good) data — is a
  way to give that page a golden set instead of ad-hoc typing.
- **The classifier is the part that does not exist**, and it is the part the
  Berkeley finding says matters most. There is no Off/On/Auto anywhere:
  enhancement is a place you visit, not a switch on the generate path. If it ever
  becomes a switch, the argument above is that the third state has to be allowed
  to do nothing.

None of this is on the board. It is here so the argument is available the day it
is, rather than re-derived.
