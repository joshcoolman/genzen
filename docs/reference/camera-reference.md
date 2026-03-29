# Camera Reference

Vocabulary and example prompts for framing, angles, movements, and cinematographic style. Used both in manual prompting and as the knowledge base for camera preset/move layers in the prompt compilation system (see `prompt-system.md`).

## Shot Sizes (Framing)

| Shot                            | Framing                                    | When to use                             | AI prompt phrase                                        |
| ------------------------------- | ------------------------------------------ | --------------------------------------- | ------------------------------------------------------- |
| **Extreme Wide Shot (EWS)**     | Entire environment, subject tiny or absent | Scene setting, scale, isolation         | "Extreme wide shot of the city skyline at dusk"         |
| **Wide Shot / Full Shot (WS)**  | Subject head to toe with environment       | Establish character in space            | "Wide shot, woman standing at the edge of the cliff"    |
| **Medium Long Shot (MLS)**      | Knees up / "knee shot"                     | Character movement, group shots         | "Medium long shot following her down the street"        |
| **Cowboy Shot / American Shot** | Mid-thigh up                               | Action, westerns, holster/hands visible | "Cowboy shot, hand hovering near holster"               |
| **Medium Shot (MS)**            | Waist up                                   | Dialogue, body language                 | "Medium shot, two people at a cafe table"               |
| **Medium Close-Up (MCU)**       | Chest/shoulders up                         | Conversation, emotion + body language   | "Medium close-up, leaning forward with intensity"       |
| **Close-Up (CU)**               | Face fills frame                           | Emotion, reaction                       | "Close-up on her face as she reads the letter"          |
| **Extreme Close-Up (ECU)**      | Single feature (eyes, hands, object)       | Detail, tension, symbolism              | "Extreme close-up of trembling fingers on the doorknob" |
| **Two-Shot**                    | Two subjects together                      | Relationship, dialogue                  | "Two-shot, couple sitting on the bench"                 |
| **Over-the-Shoulder (OTS)**     | Behind one subject, other visible          | Conversation, perspective               | "Over-the-shoulder shot looking at the interviewer"     |

## Camera Angles

| Angle               | Effect                                         | AI prompt phrase                                      |
| ------------------- | ---------------------------------------------- | ----------------------------------------------------- |
| **Eye Level**       | Neutral, natural                               | "Eye-level shot"                                      |
| **Low Angle**       | Subject appears powerful, heroic, threatening  | "Low angle shot looking up at him"                    |
| **High Angle**      | Subject appears small, vulnerable, weak        | "High angle shot looking down at her"                 |
| **Bird's Eye View** | Overhead, map-like, disorienting               | "Bird's eye view of the intersection"                 |
| **Worm's Eye View** | Ground level looking up, subject looms massive | "Worm's eye view, skyscrapers towering overhead"      |
| **Dutch Angle**     | Tilted frame, unease, chaos, horror            | "Dutch angle, tilted 20 degrees, tense confrontation" |

## Camera Movements

| Movement                        | Description                                                         | AI prompt phrase                                                  |
| ------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------- |
| **Static / Locked-off**         | No movement, pure subject motion                                    | "Static shot, camera locked, steam rising from cup"               |
| **Pan left/right**              | Camera pivots horizontally from fixed point                         | "Pan right, smooth, following the motorcycle's path"              |
| **Tilt up/down**                | Camera pivots vertically from fixed point                           | "Tilt up, slow, revealing the mountain peak"                      |
| **Push-in / Dolly in**          | Camera physically moves toward subject                              | "Slow push in, intensity increasing on her face"                  |
| **Pull-back / Dolly out**       | Camera moves backward, reveals environment                          | "Pull back, revealing the vast crowd behind him"                  |
| **Truck left/right**            | Camera moves parallel to subject (lateral)                          | "Truck left, keeping pace with the runner"                        |
| **Pedestal up/down**            | Camera rises/lowers vertically (elevator move)                      | "Pedestal up, slow reveal of the rooftop garden"                  |
| **Tracking shot**               | Camera follows moving subject                                       | "Tracking shot, following her through the market"                 |
| **Orbit / Arc**                 | Camera circles subject                                              | "Orbit clockwise, circling the car, neon reflections shifting"    |
| **Crane / Boom / Jib**          | Camera sweeps from high vantage                                     | "Crane up, sweeping reveal of the crowd below"                    |
| **Rack focus**                  | Focus shifts between foreground and background                      | "Rack focus, shifting from flowers in foreground to house behind" |
| **Dolly zoom (Vertigo effect)** | Camera moves back while zooming in (or inverse) -- background warps | "Dolly zoom, vertigo effect, background expanding behind him"     |
| **Whip pan**                    | Violent fast pan with motion blur                                   | "Whip pan right, extreme motion blur, cuts to new scene"          |
| **Crash zoom**                  | Rapid fast zoom into subject                                        | "Crash zoom, snapping to her eyes, sudden motion blur"            |
| **FPV (First Person View)**     | Immersive, POV-style, high energy                                   | "FPV drone shot weaving through the alley"                        |
| **Handheld**                    | Organic shake, documentary feel                                     | "Handheld camera, slight shake, running through crowd"            |
| **Steadicam**                   | Smooth fluid movement, floats through space                         | "Steadicam gliding down the hospital corridor"                    |

## Camera Moves with Example Prompts

Source: https://higgsfield.ai/camera-controls (trimmed to reliably promptable moves)

### Zoom (lens changes, camera stays put)

- **Zoom In/Out** -- Gentle magnification toward/away from subject. Draws attention or reveals context.

  > "Slow zoom in on the detective's face as realization dawns, office blurred behind him"

- **Rapid Zoom In/Out** -- Fast version. Surprise, sudden focus, comedic emphasis.

  > "Rapid zoom in on the ringing phone on the desk, snapping to sharp focus"

- **Crash Zoom In/Out** -- Aggressive, jarring snap. Horror/thriller dramatic punch.
  > "Crash zoom into her wide eyes as the door slams shut, motion blur on edges"

### Dolly (camera physically moves -- parallax shifts)

- **Dolly In/Out** -- Camera glides forward/backward. Intimacy (in) or loneliness/departure (out).

  > "Slow dolly in through the empty hallway toward a single lit doorway at the end"

- **Dolly Left/Right** -- Sideways slide. Tracking alongside someone, revealing what's beside them.

  > "Dolly right alongside the woman as she walks through the open-air market, stalls passing in foreground"

- **Dolly Zoom In/Out** -- Camera moves forward while lens zooms out (Vertigo effect). Background warps. Dread, world-shifting realization.
  > "Dolly zoom on the man standing at the cliff edge, background stretching away unnaturally, vertigo effect"

### Pan & Tilt (camera rotates on a fixed point)

- **Pan Left/Right** -- Horizontal sweep. Following action, scanning a room.

  > "Slow pan right across the cluttered detective's desk, stopping on a blood-stained photograph"

- **Tilt Up/Down** -- Vertical rotation. Revealing height/power (up) or vulnerability (down).

  > "Tilt up from muddy boots, past rain-soaked coat, to the soldier's weary face against grey sky"

- **Whip Pan** -- Lightning-fast horizontal sweep with motion blur. Jump-cuts, frantic energy.
  > "Whip pan left with extreme motion blur, snapping to a new scene in a crowded subway car"

### Crane (vertical movement)

- **Crane Up/Down** -- Smooth vertical rise/lower. Endings/transcendence (up), arrival/grounding (down).
  > "Crane up from the couple embracing on the rooftop, rising to reveal the city skyline at golden hour"

### Orbital

- **Arc Left/Right** -- Partial circle around subject. Dynamic portraits.

  > "Arc right around the boxer in the ring, sweat glistening under overhead lights, crowd blurred behind"

- **360 Orbit** -- Full circle around subject. Hero moments, emphasis.
  > "360 orbit around the astronaut standing on the surface, Earth rising in the background, slow and reverent"

### Specialty & POV

- **Static** -- Locked frame, no movement. Dialogue, letting the scene breathe.

  > "Static wide shot, locked camera, two silhouettes sitting on a park bench at dusk, leaves drifting"

- **Handheld** -- Subtle shake. Realism, urgency, documentary feel.

  > "Handheld medium shot following the paramedic through a chaotic ER, slight camera shake, fluorescent light"

- **FPV Drone** -- First-person flying. Sweeping landscapes, chase sequences.

  > "FPV drone shot weaving through a narrow canyon at speed, red rock walls rushing past on both sides"

- **Overhead** -- Straight down, bird's eye. Patterns, scale, detachment.

  > "Overhead shot looking straight down at a lone figure walking across a white salt flat, long shadow stretching"

- **Dutch Angle** -- Tilted horizon. Unease, villainy, something is "off."

  > "Dutch angle medium shot, tilted 15 degrees, figure standing in a flickering fluorescent hallway, uneasy mood"

- **Fisheye** -- Wide barrel distortion. Peepholes, skateboards, surreal/comedic.
  > "Fisheye lens close-up of a face peering through a door peephole, barrel distortion warping the hallway behind"

### Time-based

- **Timelapse** -- Time sped up. Transformation, passing of time.

  > "Timelapse of storm clouds rolling over a mountain valley, shadows racing across the landscape, golden to blue light"

- **Hyperlapse** -- Timelapse but camera also moves through space.
  > "Hyperlapse walking forward through a busy Tokyo street at night, neon signs streaking, crowds blurring past"

### Product

- **Lazy Susan** -- Subject rotates on turntable. Product shots, fashion, food.
  > "Lazy Susan turntable rotation of a ceramic vase on a white pedestal, even studio lighting, smooth 360 spin"

## Special / Named Shots

| Shot                    | Description                                         | AI prompt phrase                                                                      |
| ----------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **Establishing shot**   | Opens a scene, shows where we are                   | "Establishing wide shot of the Tokyo street at night"                                 |
| **POV shot**            | We see exactly what the character sees              | "POV shot walking through the dark hallway"                                           |
| **Insert shot**         | Close-up of object/detail within a scene            | "Insert shot of the ticking clock on the wall"                                        |
| **Cutaway**             | Shot of something outside the main action           | "Cutaway to the phone buzzing on the table"                                           |
| **Reaction shot**       | Character's emotional response, no stimulus shown   | "Reaction shot close-up, expression shifting from shock to resolve"                   |
| **Profile shot**        | Subject filmed from directly to the side            | "Profile shot medium close-up, man staring at city skyline, backlit by sunset"        |
| **Aerial / Drone shot** | Camera from altitude                                | "Aerial drone shot forward over coastal cliff at sunrise, 4K cinematic"               |
| **Master shot**         | Wide/medium-wide covering entire scene              | "Master shot wide, two characters in dimly lit bar, static camera, full conversation" |
| **Shot/reverse shot**   | Alternating OTS between two subjects in dialogue    | "Shot/reverse shot dialogue, medium close-up, warm interior, realistic eye contact"   |
| **B-roll**              | Contextual/supplemental footage, no primary subject | "B-roll wide establishing shot of a fishing village at dawn, no subjects"             |

## Effective Compound Shots

One primary motion + size/angle. These are understood by Kling, Veo, and similar models:

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

## Quick-Reference Vocabulary (copy-paste building blocks)

**Shot sizes:** `extreme wide shot` . `wide shot` . `full shot` . `medium long shot` . `medium shot` . `medium close-up` . `close-up` . `extreme close-up` . `insert shot` . `cowboy shot`

**Camera movements:** `dolly in` . `dolly out` . `pull back` . `push in` . `track left` . `track right` . `truck left` . `pan right` . `tilt up` . `tilt down` . `pedestal up` . `orbit clockwise` . `arc around` . `crane up` . `crane down` . `whip pan` . `crash zoom` . `rack focus`

**Camera style:** `handheld` . `steadicam` . `locked-off` . `static` . `drone` . `aerial` . `shoulder-cam` . `FPV`

**Angles:** `eye level` . `low angle` . `high angle` . `bird's eye` . `overhead` . `worm's eye` . `dutch angle` . `canted frame` . `profile` . `over-the-shoulder`

**Pacing modifiers:** `slow and deliberate` . `smooth cinematic pace` . `urgent and fast` . `floating` . `drifting` . `snapping` . `sweeping` . `gradual reveal`

## ShotDeck -- Professional Cinematography Reference

ShotDeck (shotdeck.com) is a searchable database of 2.25M+ HD cinematic stills from 8,200+ titles, created by DP Lawrence Sher ASC (Joker, Garden State). Used by DPs, directors, colorists, gaffers, and production designers to build visual lookbooks.

**Core insight:** A single strong reference frame communicates color, lighting, lens feel, composition, and mood simultaneously. Words cannot do this. Professionals pull multiple references per scene, each targeting a different visual dimension.

### The 30+ metadata dimensions ShotDeck tracks per shot

**Composition / Framing**

- Shot size: ECU, CU, choker, MCU, MS, MLS, LS, ELS, full shot, cowboy shot
- Camera angle: eye-level, high, low, bird's eye, Dutch/canted
- Camera movement: static, pan, tilt, dolly, truck, pedestal, Steadicam, crane, handheld, zoom, rack focus
- Compositional technique: rule of thirds, leading lines, symmetry, deep/shallow focus, silhouette, foreground elements, over-the-shoulder, two-shot, POV

**Lens**

- Focal length range: ultra-wide (<18mm), wide (18-35mm), standard (35-55mm), medium tele (55-100mm), tele (100mm+)
- Specific primes: 14, 16, 21, 25, 28, 32, 35, 40, 47, 50, 65, 85, 100, 135mm
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

### Most-studied cinematographers

| DP                | Known for                                                | Signature style                                          |
| ----------------- | -------------------------------------------------------- | -------------------------------------------------------- |
| Roger Deakins     | _Blade Runner 2049_, _1917_, _Sicario_, _No Country_     | Natural motivated light, long primes, restrained palette |
| Emmanuel Lubezki  | _Revenant_, _Gravity_, _Children of Men_, _Tree of Life_ | All natural light, Steadicam long takes, wide lenses     |
| Hoyte van Hoytema | _Oppenheimer_, _Dunkirk_, _Interstellar_                 | IMAX, large format, practical light sources              |
| Gordon Willis     | _The Godfather_, _Manhattan_                             | Underexposed faces, deep shadow, top-light only          |
| Christopher Doyle | _In the Mood for Love_, _Chungking Express_              | Saturated color, available light, handheld intimacy      |
| Robert Richardson | _Hugo_, _Django Unchained_, _The Aviator_                | Flared light sources, high contrast, period authenticity |

### Real-world technical specs from top productions

**1917 (Deakins, ARRI Alexa Mini LF):**

- 99% of film shot on 40mm Signature Prime
- River scenes: 47mm (compression, lose background)
- Dark interiors: ISO 1600, T/2.4
- Day exterior: T/3.5-5.6, no supplemental light, cloud cover only
- Stabilization: ARRI Trinity (5-axis) for continuous-shot illusion

**Blade Runner 2049 (Deakins, ARRI Alexa XT + Alexa 65):**

- Character framing: 32mm Master Prime
- Wide cityscapes: 14-16mm
- Wallace office: 256 Fresnels in concentric rings simulating skylight
- Interactive neon: 40x30ft LED screen as key light
- Philosophy: achieve color effects in-camera, not in post

**The Revenant (Lubezki, ARRI Alexa 65):**

- Zero artificial light on the entire film
- Magic hour window only for firelit scenes
- Extreme ISOs to hold exposure at dusk

### Applying ShotDeck thinking to AI prompts

Instead of: `"nice lighting, cinematic"`

Use the professional vocabulary:

```
"Low-key side lighting, hard source from camera left, deep shadow on far cheek,
 warm practical key ~3200K, 85mm telephoto, shallow depth of field, teal-and-orange
 grade, high contrast, interior night"
```

Or reference a known DP style directly:

```
"Roger Deakins lighting style -- motivated natural light, restrained warm palette,
 minimal supplemental fill, 40mm lens compression, naturalistic"

"Lubezki-style available light, magic hour, wide-angle handheld, golden rim light,
 no artificial sources, high dynamic range"
```

Kling 3.0 responds to DP name references as style shorthand. `"cinematography by Roger Deakins"` appended to a prompt noticeably shifts the lighting and color treatment.

### What makes a shot "reference-worthy"

1. **It replaces a paragraph.** Color, light, lens, mood -- communicated in one frame
2. **Technically reproducible** -- the setup can be reverse-engineered
3. **Serves character emotion** -- every technical decision is motivated by story
4. **Clean subject/background separation** -- via shallow DOF, rim light, or composition
5. **A specific, memorable palette** -- not just "warm" but _which_ warm and _why_
6. **Useful for defining what you don't want** -- as much as what you do
