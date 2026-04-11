---
name: video-scene-composition
label: Video Scene
launch: I want to write a video prompt for a short-form clip. Help me start.
description: Compose a short-form video scene or multi-shot sequence — camera language, beats, pacing, and motion cues for a 5–10 second clip (Kling, Runway, Veo, Minimax). Use when the user asks to write a video prompt, describe a scene for video generation, build a multi-shot beat, or enhance an existing video clip description.
---

# Video scene composition

Text-to-video and image-to-video models have a radically smaller time budget than image models. 5 seconds. 8 seconds. Maybe 10. The prompt has to do three things at once: establish the frame, describe the _change_ over time, and stay tight enough that the model doesn't try to cram a short film into the clip.

## The core rule: _one idea per clip_

Every additional idea the prompt tries to squeeze into 5 seconds reduces the probability that any of them land. Pick one beat. One subject. One motion. One atmospheric shift. Let the clip _be_ that thing.

Bad: "A detective walks into a rainy alley, sees a figure, pulls out his gun, and the camera pans to reveal a body on the ground."
Good: "Slow dolly push toward a detective standing alone in a rain-soaked alley, neon reflections pooling at his feet. Steam rises from a grate behind him. He does not move."

The second version is what 5 seconds can actually deliver.

## Structure for a video prompt

`<Shot type + camera move> | <Subject + micro-action> | <Environment + atmosphere> | <Lighting> | <Style/lens>`

- **Shot type**: wide, medium wide, medium, medium close-up, close-up, extreme close-up, over-the-shoulder, POV, bird's-eye, low-angle, Dutch tilt.
- **Camera move**: static, slow dolly in, slow dolly out, tracking left/right, crane up, crane down, pan left/right, tilt up/down, orbit, handheld sway, whip pan. Or explicitly "locked-off static shot" — stillness is a legitimate choice that video models often botch unless you ask for it.
- **Subject micro-action**: what the subject is _doing_ within the clip's runtime. "She tucks a strand of hair behind her ear." "The dog tilts its head." "Smoke curls upward from the cigarette." Small, observable, 2-second-scale actions.
- **Environment + atmosphere**: rain, dust motes in a sunbeam, drifting snow, rippling water, crackling embers, wind through grass, neon signs flickering. Atmosphere adds life without adding story.
- **Lighting**: same rules as stills but emphasize _quality_ over variation — a scene that changes its own light mid-clip confuses the model. Lock the lighting.
- **Style/lens**: "anamorphic wide, 2.39:1, filmic color grade" / "shot on ARRI Alexa, natural skin tones" / "35mm film grain, handheld documentary feel" / "clean digital cinematography, Roger Deakins style."

## Motion cues that actually work

Video models respond to motion language more than still-image models respond to mood language. Be specific:

- "slow dolly push" over "camera moves closer"
- "subtle handheld drift" over "shaky camera"
- "whip pan right" over "fast turn"
- "rack focus from foreground to background" over "focus change"
- "orbiting 180° around the subject" over "camera goes around"

Combine one camera move with one subject micro-action. Two of each starts to fight.

## Multi-shot sequences

For multi-shot work (Multi-Shot feature, storyboards, multi-clip sequences), treat each shot as its own fully-specified prompt. Do not rely on the model to "continue" anything between shots. Each clip is independent.

To maintain continuity across shots:

- **Character description must repeat verbatim** across every shot. Same wardrobe, same hair, same distinguishing features — word for word. Any variation breaks identity.
- **Lighting description should stay identical** unless you're explicitly doing a time jump.
- **Color palette should stay identical** — name the dominant 2–3 colors once and repeat them.
- **Shot variety creates the sequence.** Don't repeat the same framing — go wide → medium → close-up, or establish → reaction → detail. The pacing lives in the cuts, not in camera moves within clips.

## Aspect ratio and intended platform

If the user named a platform — TikTok, Reels, Shorts, landscape, square — encode it in the composition:

- **9:16 vertical**: frame the subject dead-center with headroom, leave space top and bottom for captions/UI, avoid horizontal pans (they look nauseating cropped vertical)
- **1:1 square**: tight, symmetrical, centered composition, minimize camera movement
- **16:9 wide**: can afford horizontal camera moves, wider environmental framing, subject can live off-center

## Anti-patterns

- **Over-choreographing**: "he walks in, sits down, picks up the coffee, takes a sip, looks up" → the model can render maybe one of those.
- **Contradictory motion**: "slow peaceful dolly" + "rapid action" → pick one energy.
- **Narrative language**: "the emotional moment when she realizes" → models render images, not realizations.
- **Model-specific feature names leaking in**: the prompt should describe the scene; the model handles duration and frame rate.
- **Forgetting that stillness is a choice**: "locked-off static shot, no camera movement" is often the cleanest-looking result.

## When launched directly (no prior context)

If this skill was invoked from scratch — a fresh chip click, no image or scene discussed yet — **do not** compose a prompt card on the first turn. Start by asking 2–3 focused questions to nail down the _one idea_:

- "What's the subject and the single beat you want in the clip? One subject, one moment — what's happening?"
- "Do you have a starting image (image-to-video) or are we generating from text only? If image, what's in it?"
- "Target model and aspect ratio — Kling/Veo/Runway? Vertical for social, wide cinematic, or square?"

Keep it tight. The goal is to extract the one idea and the platform constraints, not to run a creative interview. Compose the prompt card on the second user turn.

## Deliverable shape

Call `create_prompt_card` with the finished video prompt. Title it with the shot description ("Rain Alley Push", "Neutral Studio Orbit"). Tags: the camera move, the shot type, and the target model if known (`kling`, `veo`, `runway`).
