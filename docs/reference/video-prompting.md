# Video prompting

Prompt craft for the video lineup — LTX-2.5 Fast, MiniMax H3, Flux 3, MiniMax
H3 Max. Video is genzen's newest surface and the one with the least prose
behind it: `src/features/video/models.ts` documents every *endpoint* in
exhaustive detail, but nothing yet documents how to write the *prompt* that
goes to those endpoints, or how the three modes (text-to-video, image-to-video,
first-and-last-frame) each want to be addressed.

The vocabulary here is generalised from LTX's official prompting guide and the
common motion-craft that holds across diffusion video models. It is not a
restatement of the still-image guides — a video prompt has two axes a still
prompt does not: **motion** and **time**.

## A video prompt is a still prompt plus motion and time

Everything that makes a good still prompt still applies — subject first, place
it, describe the light, specific detail over filler, text in quotes, no
negation. On top of that, a video prompt has to say:

- **What moves, and how.** The subject's action, and separately the camera's
  move. These are two different motions and the model treats them as such.
- **In what order.** A clip has a beginning and an end; describe the action as
  a sequence that flows, not a frozen tableau.

A useful shape, adapted from LTX's six-element structure:

    1. Shot        — the framing and lens (wide establishing, close-up, tracking)
    2. Scene       — light, colour, atmosphere, texture
    3. Action      — what happens, in order, start to finish
    4. Subject     — physical cues (age, hair, clothes), not abstract labels
    5. Camera move — one named move, and what it reveals
    6. Audio       — ambient / voice / music, where the model generates sound

## Camera moves are a controlled vocabulary — use the right word

Video models distinguish moves that still-image prompting never has to. The
families are not interchangeable:

- **Translation** (the rig physically moves): `dolly` in/out, `truck` left/right,
  `pedestal` up/down.
- **Rotation** (the rig pivots in place): `pan`, `tilt`.
- **Lens only** (nothing moves, focal length or focus changes): `zoom`,
  `rack focus`.

`dolly` is not `zoom`; `pan` is not `truck`. Picking the wrong family is a
common reason a clip "moves wrong." Name **one** move per clip and describe what
it *reveals*, not the mechanics of the move itself:

    Weak:   Camera pans left
    Strong: Camera pans left to reveal a bustling market square

Describing the post-move result is what most models track most accurately.

### The static rule

If a clip is meant to hold still, say "static camera" — and then include **no**
other motion verb, no focus change, no zoom. Models that honour "static" honour
it literally; a later motion word contradicts it and produces either nothing or
a glitch. One choice per clip: static, or a single named move.

## Describe the visible, not the internal

"Sad," "confused," "nervous" are not renderable. Their visible symptoms are:
tears, a slumped posture, a furrowed brow, hands worrying at a sleeve. This
matters more in video than in stills because an emotion in motion is a
*behaviour* — write the behaviour.

## Keep it inside the model's coherence budget

Video degrades faster than stills as the prompt overloads. Practical guards
that hold across the lineup:

- **One scene, few actors.** Many characters or many simultaneous actions drops
  coherence sharply.
- **Simple physics.** Explosions, splashing, shattering — the hard-to-simulate
  events are where artifacts cluster. Simple, continuous motion is safe.
- **One lighting setup.** Conflicting light descriptions confuse the frame; pick
  one and commit.
- **Budget the length of the prompt.** LTX explicitly degrades past ~80 words —
  pick the most important five or six elements rather than piling on. Longer is
  not the universal rule it sometimes is for stills (z-image being the lineup's
  long-prompt exception on the *image* side).
- **Expect to re-roll.** A meaningful fraction of video outputs carry artifacts;
  a different seed is the fix, not a longer prompt.

## The three modes want different prompts

genzen's `endpointFor` routes to one of three endpoints depending on which
frames are staged. Each wants the prompt written differently:

- **Text-to-video** — the model invents the whole shot. The prompt carries
  *everything*: subject, scene, action, camera, audio. This is where the full
  six-element structure earns its keep.
- **Image-to-video** (a first frame is staged) — the frame already establishes
  subject, composition and lighting. **Do not re-describe them** — the prompt's
  job is now *motion*: what the subject does, where the camera goes, how the
  scene evolves from that opening frame. A prompt that re-specifies the picture
  fights the frame.
- **First-and-last-frame** (Flux 3's separate endpoint) — both ends are pinned.
  The prompt describes the *transition* between them: the path the motion takes
  from the start frame to the end frame. Not the two frames (they're supplied) —
  the journey.

## Audio, where the model makes it

LTX and Flux 3 generate synchronised audio (`generate_audio`); MiniMax H3 and
H3 Max do not. Where audio is on, describe it specifically — it's a real part of
the prompt, not an afterthought:

- **Ambient:** "wind and rain," "coffeeshop murmur," "forest birdsong"
- **Voice:** style ("energetic announcer," "warm and resonant") and volume
  ("whisper," "shout")
- **Music:** "soft acoustic guitar," "electronic beat building"
- **Dialogue** goes in quotes with a speaker: `The narrator says: "Welcome."`,
  and you can specify accent/language.

## Per-model notes (the four genzen carries)

- **LTX-2.5 Fast** — cheap, generates native synced audio, likes the
  six-element structure and the post-move description. Honours "static"
  literally. Cannot render readable text — keep signs and titles out. Degrades
  past ~80 words.
- **MiniMax H3** — cheapest per second, *follows the first frame* closely
  (its image endpoint even drops `aspect_ratio` because the output tracks the
  image). No audio. Its strength is image-to-video continuity, so lean on a
  staged first frame and write motion, not scene.
- **Flux 3** — widest aspect range, generates audio, and the only model with a
  dedicated first-and-last-frame endpoint. Reach for it when the shot is a
  defined transition between two frames.
- **MiniMax H3 Max** — text-to-video only, post-trained for **prompt
  adherence**. This is the model to point a shot-by-shot script at: a long,
  ordered, multi-beat prompt is honoured in order. It is the reason the
  `multi-shot/` prompt writer exists.

## How this maps to genzen / opportunities

- **The video path may have no enhancer at all.** The image side has
  [`enhance-prompt.md`](../../src/lib/prompts/enhance-prompt.md) and per-model
  `guide-*.md` files; the video side has
  [`multi-shot/`](../../src/lib/prompts/multi-shot/) and
  [`steering-frame.md`](../../src/lib/prompts/steering-frame.md) but no general
  "turn a rough idea into a video prompt" instruction. The six-element structure
  above is the spec for one, if it's wanted — and it should branch on mode
  (text-to-video wants the whole scene; image-to-video wants only motion).
- **Mode-aware prompting is a real gap.** `endpointFor` in
  [`models.ts`](../../src/features/video/models.ts) already knows which of the
  three modes a submit is in. The prompt that goes with it does not change
  shape. An image-to-video prompt that re-describes the staged frame is working
  against the frame — the enhancer (or a hint in the form) could stop
  re-describing what the frame already shows.
- **`multi-shot/minimax-h3.md` is pointed at the right model.**
  [`multi-shot/minimax-h3.md`](../../src/lib/prompts/multi-shot/minimax-h3.md)
  targets the adherence-tuned H3 Max, which is correct — that variant honours an
  ordered script. Worth confirming the writer leans into ordered, numbered
  beats, since order-following is the entire reason to use that model.
- **"Static camera" and the one-move rule are worth encoding.** If genzen ever
  offers camera-move controls or presets, the translation/rotation/lens families
  and the static rule above are the taxonomy — and "one named move per clip" is
  a constraint the UI could enforce rather than leaving to prose.
- **Audio prompting only applies to two models.** `supportsAudio` in
  [`models.ts`](../../src/features/video/models.ts) already gates the toggle;
  the prompt guidance for *what to write* in the audio channel (ambient / voice /
  music / quoted dialogue) is the missing half, relevant only when that toggle
  is on.
- **Text-render limits are model facts, not user error.** LTX cannot render
  readable text; a user asking for a title card on LTX will be disappointed and
  won't know why. This is the kind of per-model limit the picker's `description`
  field could carry a hint for.
</content>
