# Video Prompts

Prompt structure, formulas, and templates for AI video generation. For camera vocabulary see `camera-reference.md`. For model-specific optimization see `prompt-system.md`.

## 7-Part Prompt Formula

A well-structured video prompt has 7 components:

1. **Camera** -- shot type + movement (e.g. "Medium tracking shot moving backward")
2. **Subject** -- who/what (e.g. "the woman")
3. **Action** -- what they're doing (e.g. "walks slowly toward camera, her steps hesitant, eyes fixed ahead, breath unsteady")
4. **Environment** -- where (e.g. "along the narrow dim corridor")
5. **Lighting** -- when/light quality (e.g. "at the middle of the night")
6. **Texture** -- overall visual tone/genre (e.g. "Suspenseful horror scene")
7. **Audio** -- sound direction (e.g. "Audio: horror riser")

**Example:**

> "Medium tracking shot moving backward as the woman walks slowly toward camera, her steps hesitant, eyes fixed ahead, breath unsteady along the narrow dim corridor at the middle of the night. Suspenseful horror scene. Audio: horror riser"

**Key takeaways:**

- Lead with camera movement -- it's the most important for video (static image prompts often skip this)
- Action should include micro-details (hesitant steps, unsteady breath) not just macro action (walks)
- Audio cues can be included inline -- models may use this for ambiance/mood
- Genre label at the end ("Suspenseful horror scene") acts as a catch-all style setter
- The 7-part formula keeps prompts thorough without being verbose

**For genzen:** Could add a structured prompt helper UI -- expandable form with these 7 fields that collapses into a single prompt string. Lower barrier to entry for users who don't know how to prompt video models well.

## Multi-Shot Prompt Format

### Per-shot formula

Recommended format using a dash separator:

```
[Shot size/framing] -- [camera movement], [subject action], [atmosphere/light detail]
```

Each shot should be self-contained. Good examples:

```
"Wide establishing shot -- slow dolly forward through amber-lit warehouse entrance, silhouette of figure at center, dust particles in shaft of light"
"Medium profile shot -- tracking left as subject walks along brick wall, shallow depth of field, coat trailing behind"
"Close-up macro -- camera holds on hands gripping compass, rack focus from brass detail to blurred face, warm golden hour"
"Over-the-shoulder shot -- static camera behind subject gazing out floor-to-ceiling window, rain streaks on glass"
```

### 3-shot storyboard template

```
Shot 1 (5s): Wide establishing shot -- [environment + camera move + atmosphere]
Shot 2 (5s): Medium tracking shot -- [subject action with micro-details + camera move]
Shot 3 (5s): Close-up / ECU -- [reaction or detail + rack focus or static]. [Audio cue].
```

### What not to do

- Don't write paragraph narratives -- each shot is self-contained
- Don't use vague motion words: "moves", "goes", "shifts" -- use specific cinematic terms
- Don't omit camera instructions -- they are load-bearing in Kling 3.0

## Longer Single-Shot with Time Markers

For 10-15s clips in single-shot mode, break action into time segments:

> "0-5s: Wide establishing shot of the Mars greenhouse, dust storm raging outside. 5-10s: Camera dollies forward toward botanist crouching over green sprout. 10-15s: Macro close-up of gloved hands cradling the sprout, camera tilts up to reveal hopeful expression."

## Dialogue Scenes

- Assign consistent descriptors ("the woman", "the barista") -- use same descriptor in every shot
- Specify emotional delivery: "voice hushed and urgent"
- Reference voices inline: `"She says <<<voice_1>>>: I didn't expect to see you here"`
- Shot-reverse-shot for conversation: OTS shot 1, OTS shot 2 (reverse), close-up reaction

## Key Rules

- Camera instructions are mandatory in Kling 3.0 -- not optional
- One primary camera motion per shot. Don't combine whip pan + macro zoom
- Leave `prompt` empty when using `multi_prompt`
- Shorter shots (3-5s) need tighter, faster-paced descriptions
- For subject consistency across shots, use `elements` + `@Element1` syntax, not repeated physical description
