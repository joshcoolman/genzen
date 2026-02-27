# Video Generation Notes

Research from exploring Freepik's video generator UI alongside our FAL-based implementation.

## Model Stack (Freepik defaults)

- **Multiple** -- auto-generates with several models, user picks winner
- Kling 2.5 (default workhorse)
- Kling 2.5 Master (premium tier)
- Kling 2.0 Master
- Google Veo 2.1
- Hunyuan 1.3 Pro

## UX Patterns Worth Considering

### Multi-model generation

Fire same prompt to 2-3 models in parallel, show results side-by-side. Trigger.dev parallel tasks make this straightforward. Freepik leads with this as their top option.

### Aspect Ratio selector

Freepik exposes aspect ratio as a prominent control. Options likely include 16:9, 9:16, 1:1, 4:3. Important for social media targeting (9:16 for Reels/TikTok, 16:9 for YouTube, 1:1 for Instagram feed).

### Model tiering

Separate quality/cost tiers for the same model family (e.g. Kling 2.5 vs Kling 2.5 Master). Could expose as a quality slider or "standard/premium" toggle.

### Left panel layout

Model selector as a simple vertical list with generation settings below -- clean and scannable.

### Style Library

Freepik has a dedicated Styles page -- a visual grid of named style presets (Minimal, Majestic, RetroFuture, etc.) organized by category (Photo, Animation, Design). Each style is a thumbnail showing example output. User picks a style card and it gets applied to their generation automatically.

This is "style-as-a-parameter" -- abstracts away complex prompt engineering into a visual picker. Much more accessible than writing "cinematic, shallow DOF, warm tones..." in a prompt.

For genzen: two implementation approaches:

- **Simple (v1):** Style = name + thumbnail + prompt snippet appended to user text
- **Advanced (v2):** Style = reference image fed as style_reference param to the model (how Freepik actually does it). FAL/Kling support image references, so this is feasible.

Freepik's generation UI has 4 input tabs: Photo prompt / Video / Image reference / Style reference. The style reference is an actual image, not just text -- the model uses it for visual tone matching. This produces more consistent results than prompt text alone.

Also notable: Character references appear as face thumbnails in the left panel, separate from style. So the system is: prompt + style ref image + character ref image(s) = generation.

### Starter Style Presets (5 picks from Freepik's library)

Goal: small curated set, photographic-leaning, reproducible via prompt snippets. Based on Freepik's named categories.

1. **Photo Natural** -- realistic, well-lit, candid feel. The "no style" style with professional polish. Bread and butter for most video generation.
   - Prompt snippet: "natural lighting, photorealistic, candid composition, true-to-life colors, soft natural shadows"

2. **Art** -- painterly, expressive, more interpretive. Adds artistic flair without going full illustration.
   - Prompt snippet: "artistic style, painterly quality, expressive color palette, fine art aesthetic, creative composition"

3. **Product** -- clean, commercial, hero-shot energy. Designed for showcasing objects/items with polished lighting.
   - Prompt snippet: "product photography, clean studio lighting, sharp focus, professional commercial aesthetic, isolated subject"

4. **Cinematic** -- dramatic, moody, film-look. High contrast, shallow DOF, theatrical lighting.
   - Prompt snippet: "cinematic lighting, shallow depth of field, film grain, dramatic shadows, anamorphic lens, movie still"

5. **Cartoon Fun** -- playful, animated, stylized. Good contrast to the photo-realistic styles, appeals to a different use case entirely.
   - Prompt snippet: "cartoon style, playful and colorful, stylized characters, bold outlines, fun animated aesthetic, vibrant palette"

These 5 cover: realistic / artistic / commercial / dramatic / playful. Good range for v1.

### Character Library

Freepik has a dedicated Characters page with:

- Pre-built stock characters (diverse headshot portraits, named)
- "My Characters" tab for uploading your own face references
- Each character = a clean portrait photo used as face reference input
- Characters are separate from styles -- you combine: prompt + style ref + character ref(s)

For genzen: a character is just a saved face image. Freepik makes it look sophisticated but under the hood it's a reference headshot fed to the model.

**Simplified genzen approach:**

- Seed with a few pre-generated diverse headshots as starter characters
- Let users generate new faces on demand via image gen ("generate a 30-year-old woman with red hair")
- Save any generated face to personal character library (name + image)
- Select from library when generating video -- feeds as face_reference param to Kling/FAL
- No complex infrastructure needed -- it's just an image collection with a picker UI

**@ Mention UX for characters:**

- Typing `@` in any prompt field triggers a character picker dropdown
- `@Noah` resolves to that character's face reference image behind the scenes
- Works across image gen, video gen, first/last frame prompts -- same syntax everywhere
- Familiar pattern (Slack/GitHub mentions) applied to AI generation
- Multi-character: "@Noah arm wrestles with @Matt while @Jane watches"
- Tested on Freepik with 3 characters (Noah, Helena, Raphael):
  - Single character (Noah alone): good coherence across scenes
  - Multi-character: hit or miss. Noah drifted in later gens, Helena and Raphael held better
  - Lighting/style inconsistency across generations (without style ref locked in)
  - Conclusion: character refs are "good enough" for storyboarding, not pixel-perfect. The iterate-and-curate workflow compensates -- generate several, keep the best, discard the rest.

**Bookmark pattern from Freepik:** Stock characters can be bookmarked into "My Characters" -- no upload needed, just save from defaults. Two taps to build your cast. New character creation is just: upload reference image + name it. Dead simple.

Screenshots saved to `memory/freepik-research/`.

### @ Mention Characters in Prompts

Freepik lets you type `@CharacterName` inline in prompts to reference saved characters. Natural and intuitive -- feels like chat. No separate "select character" step. Could reference multiple characters in one prompt.

### Image Gen as Storyboard Tool

Key insight: the image generator + characters = a rapid storyboarding tool for video. Generate multiple images of the same character in different scenes, then use those as first/last frames for video generation. Workflow:

1. Pick character(s)
2. Generate "scene A" image (first frame)
3. Generate "scene B" image (last frame)
4. Feed both to video gen -> coherent clip with character consistency

This is a tighter loop than genzen's current workflow where first/last frame generation is separate from the video prompt.

### Generation Grouping

Freepik groups results by input parameters (prompt + character + style). Re-generating with same settings adds to the existing group rather than creating a new section. This keeps iterations together and reduces visual clutter. "Generate more" is just hitting the button again -- zero friction for variations.

For genzen: group generations by their input combo. All variations of a scene stay together. Supports the storyboarding mental model where you're iterating on specific scenes.

### Unified Scene Workspace (Big Idea)

The current genzen workflow has image gen and video gen as separate concerns. The Freepik exploration reveals a tighter loop:

**Cast -> Storyboard -> Animate**

1. Cast: pick/create characters (face references)
2. Storyboard: rapid image gen with those characters in different scenes
3. Animate: select first frame + last frame from storyboard, generate video

The workspace should be a **scene workspace** where images and videos coexist. Any generated image can become a first/last frame with one click. Characters persist across all generations. The prompt bar stays consistent whether generating an image or a video.

This reframes the product from "video generator" to "scene builder with animation."

## FAL Workflows (Model Chaining)

FAL workflows let you chain models into a single pipeline via `workflows/execute`. Define a JSON graph of nodes where outputs from one step feed into the next via `$node_id.field.path` syntax.

**Key use case**: Kontext (face consistency) -> Nano Banana Pro edit (overlays/effects). Kontext preserves identity, Nano Banana handles creative edits it's better at.

- Cost = sum of individual models (~$0.04 Kontext + ~$0.15 Nano Banana = ~$0.19/run)
- Streaming gives intermediate results per step (show Kontext output while Nano Banana processes)
- JS client: `fal.stream("workflows/execute", { input: { ... } })`
- No extra fee for workflow orchestration

## Structured / JSON Prompts

Two approaches on FAL:

**FIBO (Bria)** -- only model with true `structured_prompt` API field. Pass typed objects per scene element with `location`, `relationship`, `relative_size`. Has generate (`bria/fibo/generate/structured_prompt`) and edit (`bria/fibo-edit/edit/structured_instruction`) endpoints. Best for precise foreground/background/overlay control.

**Nano Banana Pro** -- no JSON API field, but accepts stringified JSON in the `prompt` string. Works because it's built on Gemini (LLM). Community-discovered technique. Better spatial composition than natural language. Schema includes subject, photography, background as structured keys.

**For overlay effects (HUD, etc.)**: FIBO's structured edit lets you specify foreground objects explicitly. Nano Banana's JSON-as-string gives decent composition control. FAL workflow chaining Kontext + either model is the best of both worlds.

## AI Video Prompt Structure

A well-structured video prompt has 7 components (color-coded in the source video):

1. **Camera** -- shot type + movement (e.g. "Medium tracking shot moving backward")
2. **Subject** -- who/what (e.g. "the woman")
3. **Action** -- what they're doing (e.g. "walks slowly toward camera, her steps hesitant, eyes fixed ahead, breath unsteady")
4. **Environment** -- where (e.g. "along the narrow dim corridor")
5. **Lighting** -- when/light quality (e.g. "at the middle of the night")
6. **Texture** -- overall visual tone/genre (e.g. "Suspenseful horror scene")
7. **Audio** -- sound direction (e.g. "Audio: horror riser")

**Example prompt (horror corridor scene):**
> "Medium tracking shot moving backward as the woman walks slowly toward camera, her steps hesitant, eyes fixed ahead, breath unsteady along the narrow dim corridor at the middle of the night. Suspenseful horror scene. Audio: horror riser"

**Key takeaways:**
- Lead with camera movement -- it's the most important for video (static image prompts often skip this)
- Action should include micro-details (hesitant steps, unsteady breath) not just macro action (walks)
- Audio cues can be included inline -- models may use this for ambiance/mood
- Genre label at the end ("Suspenseful horror scene") acts as a catch-all style setter
- The 7-part formula keeps prompts thorough without being verbose

**For genzen:** Could add a structured prompt helper UI -- expandable form with these 7 fields that collapses into a single prompt string. Lower barrier to entry for users who don't know how to prompt video models well.

## Kling 3.0 Multi-Shot

Announced February 2026. Core shift: single inference pass generates up to 6 discrete shots with cuts, maintaining character/lighting/atmosphere consistency across all of them. Not clip stitching -- the model outputs the full sequence holistically.

### Two model variants

- **Kling V3** -- prompt-first, text-to-video + image-to-video. Max 1080p.
- **Kling O3** -- reference-first, optimized for character refs / video-to-video editing. Max 4K. Also supports video clip inputs.

### How multi-shot image-to-video works

The input image is an **anchor frame** that locks visual identity (character, environment, lighting) for the entire generation. The `multi_prompt` list defines each shot. The model generates all shots in one pass -- this is why consistency across cuts is better than chaining separate generations.

**Important constraint:** `multi_prompt` is mutually exclusive with `end_image_url`. You cannot use both.

### FAL endpoints

```
fal-ai/kling-video/v3/standard/image-to-video   (720p)
fal-ai/kling-video/v3/pro/image-to-video        (1080p)
fal-ai/kling-video/v3/standard/text-to-video
fal-ai/kling-video/v3/pro/text-to-video
fal-ai/kling-video/o3/standard/image-to-video   (720p)
fal-ai/kling-video/o3/pro/image-to-video        (4K)
```

### Key API params

| Param | Notes |
|---|---|
| `start_image_url` | Anchor frame -- locks visual identity |
| `prompt` | Single-shot mode. Mutually exclusive with `multi_prompt` |
| `multi_prompt` | Array of `{prompt, duration}` objects -- enables multi-shot |
| `shot_type` | `"customize"` (default, you define each shot) or `"intelligent"` (model auto-cuts) |
| `duration` | Total video length, 3–15 seconds |
| `aspect_ratio` | `16:9`, `9:16`, `1:1` |
| `generate_audio` | Native audio synthesis, default `true` |
| `voice_ids` | Up to 2 voices, referenced in prompts as `<<<voice_1>>>` |
| `elements` | Character/object references -- referenced in prompt as `@Element1` |
| `cfg_scale` | Prompt adherence, default `0.5`. Lower = more creative, higher = more literal |

### Multi-shot payload example (FAL JS)

```js
const result = await fal.subscribe('fal-ai/kling-video/v3/pro/image-to-video', {
  input: {
    start_image_url: 'https://...',   // anchor reference image
    shot_type: 'customize',
    duration: '15',
    aspect_ratio: '16:9',
    generate_audio: true,
    multi_prompt: [
      { prompt: 'Wide establishing shot. Woman stands at end of hallway, camera static, dim corridor, late night.', duration: '5' },
      { prompt: 'Medium tracking shot moving backward as she walks slowly toward camera, steps hesitant, eyes fixed ahead.', duration: '5' },
      { prompt: 'Extreme close-up of her face, camera static, breath unsteady, fear in her eyes. Horror riser audio.', duration: '5' },
    ],
  },
})
```

**Rules:**
- When using `multi_prompt`, leave `prompt` empty
- Each element: `{ prompt: string, duration: "3" | "5" | "7" | "10" | "15" }`
- Total duration = sum of all shot durations (set `duration` to match)
- Max 6 shots per generation

### shot_type modes

- **`"customize"`** -- you define every shot explicitly via `multi_prompt`. More control, more cognitive overhead. Use when exact framing per shot matters.
- **`"intelligent"`** -- provide one narrative prompt, model auto-decides cuts, framing, and pacing. Less control but lower effort. Cut points are unpredictable.

### Shot duration guidance

| Use case | Duration |
|---|---|
| Quick action beat, reaction, cutaway | 3–4s |
| Standard narrative shot, dialogue line, reveal | **5s (sweet spot)** |
| Complex camera move, two-step action, establishing | 6–7s |
| Long dialogue, environment survey, slow reveal | 8–10s |
| Full sub-scene with progression | 10–15s |

- Standard 3-shot arc: 5s + 5s + 5s = 15s max
- 4–6 shots in 10–15s total; more than 6 shots in under 10s feels rushed
- Longer durations only pay off if the prompt explicitly describes action progression over time -- a 7s static prompt wastes budget

### Pricing on FAL (pay-per-second)

| Tier | Resolution | No Audio | Audio On | Voice On |
|---|---|---|---|---|
| V3 Standard | 720p | $0.168/s | $0.252/s | — |
| V3 Pro | 1080p | $0.224/s | $0.336/s | $0.392/s |
| O3 Standard | 720p | $0.168/s | $0.224/s | — |
| O3 Pro | 4K | $0.224/s | $0.280/s | — |

Multi-shot has no extra per-shot charge -- cost is purely duration-based. A 15s V3 Pro no-audio generation costs ~$3.36.

### Kling 3.0 vs 2.5

| Feature | 2.5 | 3.0 |
|---|---|---|
| Multi-shot | No | Up to 6 shots |
| Max duration | 10s | 15s |
| Max resolution | 1080p | 4K (O3) |
| Native audio | No | Yes |
| Video-to-video | No | O3 only |
| Character consistency | Drifts | Strong via elements |
| Voice/lip-sync | External | Native |

### Limitations

- Max 6 shots, 15s total
- Color grading can shift between cuts
- `end_image_url` incompatible with multi-shot
- Hands/fingers still produce artifacts (industry-wide)
- Close physical contact between characters can "melt"
- ~30–40% of complex generations may need retries
- Intelligent mode gives unpredictable cut points

### Current genzen video model

Currently using `fal-ai/kling-video/o1/image-to-video` (first/last frame mode) via `generate-flf-video.server.ts`. Upgrading to V3/O3 would unlock multi-shot and native audio.

---

## Multi-Shot Prompt Format

### Single-shot prompt formula

```
[Camera shot + movement] + [Subject + appearance] + [Action with micro-details] + [Environment] + [Lighting/time] + [Tone/genre] + [Audio cue]
```

**Example:**
> "Medium tracking shot moving backward as the woman walks slowly toward camera, her steps hesitant, eyes fixed ahead, breath unsteady along the narrow dim corridor at the middle of the night. Suspenseful horror scene. Audio: horror riser"

### Multi-shot prompt formula (per shot)

Recommended format using a dash separator:
```
[Shot size/framing] — [camera movement], [subject action], [atmosphere/light detail]
```

Each shot should be self-contained. Good examples:
```
"Wide establishing shot — slow dolly forward through amber-lit warehouse entrance, silhouette of figure at center, dust particles in shaft of light"
"Medium profile shot — tracking left as subject walks along brick wall, shallow depth of field, coat trailing behind"
"Close-up macro — camera holds on hands gripping compass, rack focus from brass detail to blurred face, warm golden hour"
"Over-the-shoulder shot — static camera behind subject gazing out floor-to-ceiling window, rain streaks on glass"
```

**3-shot storyboard template:**
```
Shot 1 (5s): Wide establishing shot — [environment + camera move + atmosphere]
Shot 2 (5s): Medium tracking shot — [subject action with micro-details + camera move]
Shot 3 (5s): Close-up / ECU — [reaction or detail + rack focus or static]. [Audio cue].
```

**What not to do:**
- Don't write paragraph narratives -- each shot is self-contained
- Don't use vague motion words: "moves", "goes", "shifts" -- use specific cinematic terms
- Don't omit camera instructions -- they are load-bearing in Kling 3.0

### Longer single-shot with time markers

For 10–15s clips in single-shot mode, break action into time segments:

> "0–5s: Wide establishing shot of the Mars greenhouse, dust storm raging outside. 5–10s: Camera dollies forward toward botanist crouching over green sprout. 10–15s: Macro close-up of gloved hands cradling the sprout, camera tilts up to reveal hopeful expression."

### Dialogue scenes

- Assign consistent descriptors ("the woman", "the barista") -- use same descriptor in every shot
- Specify emotional delivery: "voice hushed and urgent"
- Reference voices inline: `"She says <<<voice_1>>>: I didn't expect to see you here"`
- Shot-reverse-shot for conversation: OTS shot 1, OTS shot 2 (reverse), close-up reaction

### Key rules

- Camera instructions are mandatory in Kling 3.0 -- not optional
- One primary camera motion per shot. Don't combine whip pan + macro zoom
- Leave `prompt` empty when using `multi_prompt`
- Shorter shots (3–5s) need tighter, faster-paced descriptions
- For subject consistency across shots, use `elements` + `@Element1` syntax, not repeated physical description

---

## Camera Shot Reference

### Shot sizes (framing)

| Shot | Framing | When to use | AI prompt phrase |
|---|---|---|---|
| **Extreme Wide Shot (EWS)** | Entire environment, subject tiny or absent | Scene setting, scale, isolation | "Extreme wide shot of the city skyline at dusk" |
| **Wide Shot / Full Shot (WS)** | Subject head to toe with environment | Establish character in space | "Wide shot, woman standing at the edge of the cliff" |
| **Medium Long Shot (MLS)** | Knees up / "knee shot" | Character movement, group shots | "Medium long shot following her down the street" |
| **Cowboy Shot / American Shot** | Mid-thigh up | Action, westerns, holster/hands visible | "Cowboy shot, hand hovering near holster" |
| **Medium Shot (MS)** | Waist up | Dialogue, body language | "Medium shot, two people at a cafe table" |
| **Medium Close-Up (MCU)** | Chest/shoulders up | Conversation, emotion + body language | "Medium close-up, leaning forward with intensity" |
| **Close-Up (CU)** | Face fills frame | Emotion, reaction | "Close-up on her face as she reads the letter" |
| **Extreme Close-Up (ECU)** | Single feature (eyes, hands, object) | Detail, tension, symbolism | "Extreme close-up of trembling fingers on the doorknob" |
| **Two-Shot** | Two subjects together | Relationship, dialogue | "Two-shot, couple sitting on the bench" |
| **Over-the-Shoulder (OTS)** | Behind one subject, other visible | Conversation, perspective | "Over-the-shoulder shot looking at the interviewer" |

### Camera angles

| Angle | Effect | AI prompt phrase |
|---|---|---|
| **Eye Level** | Neutral, natural | "Eye-level shot" |
| **Low Angle** | Subject appears powerful, heroic, threatening | "Low angle shot looking up at him" |
| **High Angle** | Subject appears small, vulnerable, weak | "High angle shot looking down at her" |
| **Bird's Eye View** | Overhead, map-like, disorienting | "Bird's eye view of the intersection" |
| **Worm's Eye View** | Ground level looking up, subject looms massive | "Worm's eye view, skyscrapers towering overhead" |
| **Dutch Angle** | Tilted frame, unease, chaos, horror | "Dutch angle, tilted 20 degrees, tense confrontation" |

### Camera movements

| Movement | Description | AI prompt phrase |
|---|---|---|
| **Static / Locked-off** | No movement, pure subject motion | "Static shot, camera locked, steam rising from cup" |
| **Pan left/right** | Camera pivots horizontally from fixed point | "Pan right, smooth, following the motorcycle's path" |
| **Tilt up/down** | Camera pivots vertically from fixed point | "Tilt up, slow, revealing the mountain peak" |
| **Push-in / Dolly in** | Camera physically moves toward subject | "Slow push in, intensity increasing on her face" |
| **Pull-back / Dolly out** | Camera moves backward, reveals environment | "Pull back, revealing the vast crowd behind him" |
| **Truck left/right** | Camera moves parallel to subject (lateral) | "Truck left, keeping pace with the runner" |
| **Pedestal up/down** | Camera rises/lowers vertically (elevator move) | "Pedestal up, slow reveal of the rooftop garden" |
| **Tracking shot** | Camera follows moving subject | "Tracking shot, following her through the market" |
| **Orbit / Arc** | Camera circles subject | "Orbit clockwise, circling the car, neon reflections shifting" |
| **Crane / Boom / Jib** | Camera sweeps from high vantage | "Crane up, sweeping reveal of the crowd below" |
| **Rack focus** | Focus shifts between foreground and background | "Rack focus, shifting from flowers in foreground to house behind" |
| **Dolly zoom (Vertigo effect)** | Camera moves back while zooming in (or inverse) -- background warps | "Dolly zoom, vertigo effect, background expanding behind him" |
| **Whip pan** | Violent fast pan with motion blur | "Whip pan right, extreme motion blur, cuts to new scene" |
| **Crash zoom** | Rapid fast zoom into subject | "Crash zoom, snapping to her eyes, sudden motion blur" |
| **FPV (First Person View)** | Immersive, POV-style, high energy | "FPV drone shot weaving through the alley" |
| **Handheld** | Organic shake, documentary feel | "Handheld camera, slight shake, running through crowd" |
| **Steadicam** | Smooth fluid movement, floats through space | "Steadicam gliding down the hospital corridor" |

### Special / named shots

| Shot | Description | AI prompt phrase |
|---|---|---|
| **Establishing shot** | Opens a scene, shows where we are | "Establishing wide shot of the Tokyo street at night" |
| **POV shot** | We see exactly what the character sees | "POV shot walking through the dark hallway" |
| **Insert shot** | Close-up of object/detail within a scene | "Insert shot of the ticking clock on the wall" |
| **Cutaway** | Shot of something outside the main action | "Cutaway to the phone buzzing on the table" |
| **Reaction shot** | Character's emotional response, no stimulus shown | "Reaction shot close-up, expression shifting from shock to resolve" |
| **Two-shot** | Two subjects together in one frame | "Two-shot medium, couple at a restaurant table, candlelit" |
| **Three-shot** | Three subjects in one frame | "Three-shot medium wide, band performing on stage, warm lighting" |
| **Profile shot** | Subject filmed from directly to the side | "Profile shot medium close-up, man staring at city skyline, backlit by sunset" |
| **Aerial / Drone shot** | Camera from altitude, helicopter or drone | "Aerial drone shot forward over coastal cliff at sunrise, 4K cinematic" |
| **Master shot** | Wide/medium-wide covering entire scene, all actors | "Master shot wide, two characters in dimly lit bar, static camera, full conversation" |
| **Shot/reverse shot** | Alternating OTS between two subjects in dialogue | "Shot/reverse shot dialogue, medium close-up, warm interior, realistic eye contact" |
| **B-roll** | Contextual/supplemental footage, no primary subject | "B-roll wide establishing shot of a fishing village at dawn, no subjects" |

### Effective compound shots for AI prompts

These combinations are understood by Kling, Veo, and similar models. One primary motion + size/angle:

```
"Medium tracking shot following a man through a crowded subway platform"
"Low-angle dolly in, slow push toward a burning building entrance"
"High-angle pull back, revealing a vast crowd from above"
"Handheld close-up following a paramedic through an emergency room"
"Steadicam follow floating behind a dancer through ballroom doors"
"Overhead tracking shot, top-down view following a car on a mountain road"
"Close-up rack focus, foreground candle to woman's face in background"
"Dutch angle push in, canted 20 degrees, slow dolly toward lone figure"
"POV tracking shot, first-person walk through a dark warehouse"
"Medium arc shot, orbiting counterclockwise, woman in field of tall grass"
"Tilt-up reveal, starting at boots, slowly tilting to full figure against sky"
"OTS push in, over one character's shoulder, slow dolly tightening"
"Aerial dolly forward, drone pushing through morning mist above pine forest"
"Worm's eye wide shot, camera flat on ground, skyscrapers beyond"
```

**Rule of thumb:** One primary motion per shot. Conflicting motions (whip pan + macro zoom) produce blurry undefined results. Camera move + lens modifier is fine (dolly-in + shallow DOF).

### Quick-reference vocabulary (copy-paste building blocks)

**Shot sizes:** `extreme wide shot` · `wide shot` · `full shot` · `medium long shot` · `medium shot` · `medium close-up` · `close-up` · `extreme close-up` · `insert shot` · `cowboy shot`

**Camera movements:** `dolly in` · `dolly out` · `pull back` · `push in` · `track left` · `track right` · `truck left` · `pan right` · `tilt up` · `tilt down` · `pedestal up` · `orbit clockwise` · `arc around` · `crane up` · `crane down` · `whip pan` · `crash zoom` · `rack focus`

**Camera style:** `handheld` · `steadicam` · `locked-off` · `static` · `drone` · `aerial` · `shoulder-cam` · `FPV`

**Angles:** `eye level` · `low angle` · `high angle` · `bird's eye` · `overhead` · `worm's eye` · `dutch angle` · `canted frame` · `profile` · `over-the-shoulder`

**Pacing modifiers:** `slow and deliberate` · `smooth cinematic pace` · `urgent and fast` · `floating` · `drifting` · `snapping` · `sweeping` · `gradual reveal`

---

## ShotDeck — Professional Cinematography Reference

ShotDeck (shotdeck.com) is a searchable database of 2.25M+ HD cinematic stills from 8,200+ titles, created by DP Lawrence Sher ASC (Joker, Garden State). Used by DPs, directors, colorists, gaffers, and production designers to build visual lookbooks and communicate creative intent without words.

**Core insight:** A single strong reference frame communicates color, lighting, lens feel, composition, and mood simultaneously to every department. Words cannot do this. Professionals pull multiple references per scene, each targeting a different visual dimension (one for lighting, one for palette, one for lens compression).

### The 30+ metadata dimensions ShotDeck tracks per shot

These are the exact parameters professional cinematographers use to describe and search for shots:

**Composition / Framing**
- Shot size: ECU, CU, choker, MCU, MS, MLS, LS, ELS, full shot, cowboy shot
- Camera angle: eye-level, high, low, bird's eye, Dutch/canted
- Camera movement: static, pan, tilt, dolly, truck, pedestal, Steadicam, crane, handheld, zoom, rack focus
- Compositional technique: rule of thirds, leading lines, symmetry, deep/shallow focus, silhouette, foreground elements, over-the-shoulder, two-shot, POV

**Lens**
- Focal length range: ultra-wide (<18mm), wide (18–35mm), standard (35–55mm), medium tele (55–100mm), tele (100mm+)
- Specific primes used in real productions: 14, 16, 21, 25, 28, 32, 35, 40, 47, 50, 65, 85, 100, 135mm
- Spherical vs. anamorphic (anamorphic = oval bokeh, horizontal lens flares, wider feel)
- Depth of field: shallow / medium / deep

**Lighting**
- Quality: hard vs. soft
- Key style: high-key vs. low-key
- Direction: frontal, side, backlight/rim, kicker
- Source: natural/available light, practical (visible in frame), artificial
- Color temperature: warm (~3200K tungsten), neutral (~5600K daylight), cool/blue, mixed
- Contrast: flat, normal, high-contrast chiaroscuro
- Named styles: film noir, Rembrandt, three-point, naturalistic

**Color / Grade**
- Palette: warm, cool, neutral, monochromatic, complementary
- Named palettes: teal-and-orange (blockbuster default), bleach bypass (desaturated despair), golden/amber (nostalgia), blue-grey (cold/clinical)
- Saturation: fully saturated, muted, desaturated, high-chroma
- Contrast: flat/log-like, lifted blacks, crushed blacks

**Production Context**
- Interior vs. exterior
- Location type: urban, natural, confined, open landscape
- Time of day: day, golden hour, blue hour, night
- Genre: drama, thriller, horror, sci-fi, western, etc.
- Mood: melancholy, tense, intimate, epic, comedic
- Emotion visible on face: fearful, despairing, determined, neutral, joyful

**Camera / Technical**
- Camera body: ARRI Alexa (various), RED, Sony Venice, Panavision, film cameras
- Lens system: ARRI Signature Primes, Master Primes, Cooke S4, Leica Summilux-C, Hawk anamorphics
- Format: 35mm, 65mm, Super 35 digital, large format/full frame digital
- Aspect ratio: 1.33 (Academy), 1.66 (European), 1.85 (American flat), 2.39 (anamorphic), 2.76 (IMAX)

### Most-studied cinematographers (useful for style references in AI prompts)

| DP | Known for | Signature style |
|---|---|---|
| Roger Deakins | *Blade Runner 2049*, *1917*, *Sicario*, *No Country* | Natural motivated light, long primes, restrained palette |
| Emmanuel Lubezki | *Revenant*, *Gravity*, *Children of Men*, *Tree of Life* | All natural light, Steadicam long takes, wide lenses |
| Hoyte van Hoytema | *Oppenheimer*, *Dunkirk*, *Interstellar* | IMAX, large format, practical light sources |
| Gordon Willis | *The Godfather*, *Manhattan* | Underexposed faces, deep shadow, top-light only |
| Christopher Doyle | *In the Mood for Love*, *Chungking Express* | Saturated color, available light, handheld intimacy |
| Robert Richardson | *Hugo*, *Django Unchained*, *The Aviator* | Flared light sources, high contrast, period authenticity |

### Real-world technical specs from top productions (what DPs actually use)

**1917 (Deakins, ARRI Alexa Mini LF):**
- 99% of film shot on 40mm Signature Prime
- River scenes: 47mm (compression, lose background)
- Dark interiors: ISO 1600, T/2.4
- Day exterior: T/3.5–5.6, no supplemental light, cloud cover only
- Stabilization: ARRI Trinity (5-axis) for continuous-shot illusion

**Blade Runner 2049 (Deakins, ARRI Alexa XT + Alexa 65):**
- Character framing: 32mm Master Prime
- Wide cityscapes: 14–16mm
- Wallace office: 256 Fresnels in concentric rings simulating skylight
- Interactive neon: 40x30ft LED screen as key light — light changed with the advertisement
- Philosophy: achieve color effects in-camera, not in post

**The Revenant (Lubezki, ARRI Alexa 65):**
- Zero artificial light on the entire film
- Magic hour window only for firelit scenes
- Extreme ISOs to hold exposure at dusk

### What makes a shot "reference-worthy" (professional criteria)

1. **It replaces a paragraph.** Color, light, lens, mood — communicated in one frame
2. **Technically reproducible** — the setup can be reverse-engineered
3. **Serves character emotion** — every technical decision is motivated by story
4. **Clean subject/background separation** — via shallow DOF, rim light, or composition
5. **A specific, memorable palette** — not just "warm" but *which* warm and *why*
6. **Useful for defining what you don't want** — as much as what you do

### Applying ShotDeck thinking to AI video prompts

Instead of: `"nice lighting, cinematic"`

Use the professional vocabulary:
```
"Low-key side lighting, hard source from camera left, deep shadow on far cheek,
 warm practical key ~3200K, 85mm telephoto, shallow depth of field, teal-and-orange
 grade, high contrast, interior night"
```

Or reference a known DP style directly:
```
"Roger Deakins lighting style — motivated natural light, restrained warm palette,
 minimal supplemental fill, 40mm lens compression, naturalistic"

"Lubezki-style available light, magic hour, wide-angle handheld, golden rim light,
 no artificial sources, high dynamic range"
```

Kling 3.0 responds to DP name references as style shorthand. Test: `"cinematography by Roger Deakins"` appended to a prompt noticeably shifts the lighting and color treatment.

---

## Character Reference Image Prompt

For generating a character reference to use as a face reference in video generation. Produces a triptych (three angles) from one generation — efficient for building a character library.

**Template prompt:**
```
A clean studio-style triptych portrait of the same character, divided into three
vertical sections: left, center, and right, separated by thin, subtle lines.

The character is wearing [insert clothing details]

The framing is a medium close-up showing only the top half of his body (chest-up),
allowing for clear, realistic skin texture and facial detail.
```

**Why triptych:**
- Three angles (left profile, front, right profile) in one generation
- All three match — same character, same lighting, same clothing
- More useful as a face reference than a single-angle portrait
- Cost-efficient: one generation = three usable reference angles

**Usage:** Generate this with FLUX Kontext Pro or Kling Image O3. Save the result as a character in the library. Feed as `face_reference` or `elements` param when generating video.

---

## Video Stitching / Concatenation

### TL;DR recommendation

**Two-tier approach:**
1. **In-app playback only** → HTML5 sequential playback, zero server work
2. **Need a real merged file** → `fal-ai/ffmpeg-api/merge-videos` — already in the stack, accepts Supabase signed URLs directly, currently free

### Option 1: HTML5 sequential playback (no stitching)

Zero complexity. Use the `ended` event to swap `src` and play the next clip. No server involvement. Not a downloadable file — just sequential in-browser playback.

```tsx
export function VideoSequencePlayer({ urls }: { urls: string[] }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [currentIndex, setCurrentIndex] = useState(0)

  const handleEnded = () => {
    const next = currentIndex + 1
    if (next < urls.length) setCurrentIndex(next)
  }

  return (
    <video
      ref={videoRef}
      src={urls[currentIndex]}
      autoPlay
      controls
      onEnded={handleEnded}
      onLoadedData={() => videoRef.current?.play()}
    />
  )
}
```

### Option 2: FAL.ai merge-videos (best for real files)

FAL has a native `fal-ai/ffmpeg-api/merge-videos` endpoint. Accepts a list of video URLs, returns a merged video URL. Currently priced at $0/compute second. Takes Supabase signed URLs directly as input.

```typescript
// src/features/ai-video/server/merge-videos.server.ts
import { createServerFn } from '@tanstack/react-start'
import { fal } from '@fal-ai/client'

export const mergeVideos = createServerFn({ method: 'POST' })
  .inputValidator((data: { videoUrls: string[] }) => data)
  .handler(async ({ data }) => {
    const result = await fal.subscribe('fal-ai/ffmpeg-api/merge-videos', {
      input: { video_urls: data.videoUrls },
    })
    return { mergedUrl: result.data.video.url }
  })
```

### Option 3: Raw FFmpeg on Fly.io (self-hosted fallback)

Add to Dockerfile: `RUN apk add --no-cache ffmpeg` (~30MB on Alpine). Use concat demuxer with `-c copy` — no re-encoding, near-instant for same-codec clips. All FAL.ai clips from the same model share codec/resolution/framerate so `-c copy` always works.

```typescript
// src/lib/server/ffmpeg-concat.server.ts
import { spawn } from 'child_process'
import { writeFile, unlink } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { randomUUID } from 'crypto'

export async function concatVideos(inputUrls: string[]): Promise<string> {
  const id = randomUUID()
  const listPath = join(tmpdir(), `concat-${id}.txt`)
  const outPath = join(tmpdir(), `merged-${id}.mp4`)

  await writeFile(listPath, inputUrls.map(u => `file '${u}'`).join('\n'))

  await new Promise<void>((resolve, reject) => {
    const proc = spawn('ffmpeg', [
      '-f', 'concat', '-safe', '0',
      '-protocol_whitelist', 'file,http,https,tcp,tls,crypto',
      '-i', listPath,
      '-c', 'copy', '-y', outPath,
    ])
    let stderr = ''
    proc.stderr.on('data', c => (stderr += c))
    proc.on('close', code => code === 0 ? resolve() : reject(new Error(stderr)))
    proc.on('error', reject)
  })

  await unlink(listPath).catch(() => {})
  return outPath
}
```

### What to avoid

- **fluent-ffmpeg** — archived by its author May 2025, unmaintained. Skip.
- **ffmpeg.wasm** — WebAssembly, browser-only, no GPU, memory ceiling, needs COOP/COEP headers. Wrong tool for server use.
- **Mux / Cloudflare Stream** — neither offers a simple "join clips" REST endpoint. Cloudflare Stream is delivery-only. Mux requires complex Compositions product. Overkill.

### Summary

| Option | Complexity | Cost | Use when |
|---|---|---|---|
| HTML5 sequential | Trivial | Free | In-app viewing, no download needed |
| FAL merge-videos | Very low | Free (now) | Need a real merged file, stay in FAL stack |
| FFmpeg spawn | Low | Free (infra) | Self-hosted fallback if FAL pricing changes |

---

## Open Questions

- What aspect ratios does FAL support per model?
- How does Freepik handle generation progress/preview?
- What does their result gallery/comparison view look like?
