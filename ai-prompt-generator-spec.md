# AI Image Prompt Generator — Agent Specification

Use this document to build a randomized prompt generator for AI image models (Midjourney, Flux, DALL-E 3, Stable Diffusion). Every "Randomize" click should produce a prompt that feels intentional, not like word salad.

---

## Core Principle: Front-to-Back Importance

Modern diffusion models weight the beginning of a prompt more heavily than the end. The generator must always place the **subject and medium first**, then layer in atmosphere and technical details. Never bury the subject behind modifiers.

---

## Prompt Architecture

Build each prompt from five ordered buckets. For every generation, pull one item from each bucket and chain them together.

| Order | Bucket             | Purpose                                                                                               | Required?   |
| ----- | ------------------ | ----------------------------------------------------------------------------------------------------- | ----------- |
| 1     | **Subject**        | The primary focus — "what are we looking at?"                                                         | Always      |
| 2     | **Action / State** | Movement, emotion, or condition — gives the subject a reason to exist                                 | Always      |
| 3     | **Medium / Style** | Defines the visual language — photography, painting, 3D, etc.                                         | Always      |
| 4     | **Atmosphere**     | Lighting, mood, color temperature                                                                     | Always      |
| 5     | **Technical**      | Camera specs, film stock, or art-medium details (selected conditionally — see Commitment Logic below) | Conditional |

### Construction Formula

```
{subject} {action/state}, {medium}, {atmosphere}, {technical} {aspect_ratio}
```

### Example Output

> A nomadic merchant wandering through a crystal desert, vintage Kodachrome film photography, harsh midday sun with long shadows, 35mm wide-angle lens, Kodak Portra 400 --ar 3:2

---

## Commitment Logic

This is the most important rule. It prevents "mushy" prompts that mix incompatible aesthetics.

**When the Medium bucket returns a photography-based result:**

- Append a value from `camera.lenses`, `camera.framing`, and `camera.film_stocks`
- Do NOT append art-medium details like "impasto" or "brushstrokes"

**When the Medium bucket returns an art/illustration-based result:**

- Append a value from `art_techniques` (see keyword bank below)
- Do NOT append camera lenses or film stocks
- You may still use `camera.framing` values — terms like "Bird's-Eye View" and "Close-Up" work across both modes

**When the Medium bucket returns a 3D/digital result:**

- Append a value from `render_engines` and optionally `camera.framing`
- Skip film stocks and art techniques

---

## Surprise Mechanisms

These prevent the generator from feeling formulaic.

### 1. Adjective–Subject Multiplier

Do not store subjects as bare nouns. Store them as `{modifier} + {noun}` pairs, and randomize both independently. This produces unexpected but coherent combinations.

**Modifier Pool:**
Ethereal, Decaying, Mechanical, Overgrown, Translucent, Fossilized, Miniature, Colossal, Inverted, Crystalline, Gilded, Weathered, Volcanic, Submerged, Origami, Mosaic, Skeletal, Bioluminescent, Rusted, Holographic

**Noun Pool:**
Cathedral, Street vendor, Lighthouse, Frog, Library, Samurai, Greenhouse, Submarine, Marketplace, Treehouse, Observatory, Apothecary, Windmill, Beehive, Clock tower, Marionette, Space station, Fishing village, Terrarium, Colosseum

The generator should combine these independently, so "Mechanical Butterfly" and "Fossilized Marketplace" are both valid outputs.

### 2. Wildcard Injection

On approximately 15% of generations, append one abstract concept to the end of the prompt (before the aspect ratio). These push the model into more creative territory.

**Wildcard Pool:**
Liminal space, Double exposure, Intricate filigree, Tilt-shift, Miniature faking, Anamorphic lens flare, Negative space, Visual palindrome, Hyper-maximalist, Deliberately minimalist, Forced perspective, Chiaroscuro, Solarization, Glitch artifact, Parallax depth

### 3. Contrast Pairing (Chaos Mode)

On approximately 10% of generations, deliberately cross time periods or contexts: pair a modern/futuristic subject with an ancient or anachronistic medium, or vice versa.

Examples:

- A cybertruck + ancient Egyptian fresco
- A Roman centurion + vaporwave 3D render
- A smartphone + Flemish oil painting

---

## Keyword Bank

### Subjects

#### People & Characters

- A nomadic merchant
- A deep-sea welder
- An elderly botanist
- A child astronaut
- Twin street musicians
- A masked festival dancer
- A solitary beekeeper
- A cyberpunk courier
- A Renaissance alchemist
- A tired overnight nurse

#### Places & Structures

- An overgrown lighthouse
- A floating night market
- A cliffside monastery
- An underground mushroom farm
- A decommissioned space station
- A rain-soaked neon alley
- A frozen waterfall cavern
- A rooftop garden at dawn
- A sunken cathedral
- A desert gas station

#### Creatures & Objects

- A glass frog
- A moth with galaxy-patterned wings
- A mechanical songbird
- An ancient pocket watch
- A barnacle-covered diving helmet
- A fox wearing reading glasses
- A cactus in full bloom
- A school of jellyfish
- A crumbling stone golem
- An iridescent beetle

### Actions / States

- Knitting a galaxy
- Dissolving into particles
- Glowing with bioluminescence
- Floating in zero gravity
- Emerging from morning fog
- Catching rain in cupped hands
- Repairing something delicate
- Standing perfectly still in a crowd
- Unraveling at the edges
- Reflected in a puddle
- Reading by candlelight
- Balancing on a wire
- Growing through cracked concrete
- Exhaling visible breath
- Turning to look over one shoulder
- Casting a long shadow
- Overgrown with wildflowers
- Humming with electricity
- Slowly rusting
- Vibrating with barely contained energy

### Mediums / Styles

#### Photography

- National Geographic documentary photo
- 35mm street photography
- Large-format landscape photography
- Vintage Kodachrome film photography
- High-fashion editorial photography
- Forensic evidence photography
- Candid photojournalism
- Infrared photography
- Astrophotography long exposure
- Underwater photography

#### Art & Illustration

- Oil painting on canvas
- Risograph print
- Gouache illustration
- Ukiyo-e woodblock print
- Charcoal sketch on toned paper
- Watercolor with ink linework
- 1970s dark fantasy illustration
- Soviet propaganda poster
- Art Nouveau poster
- Botanical scientific illustration
- Linocut print
- Stained glass window design
- Fresco on wet plaster
- Pixel art (16-bit era)
- Cross-hatched pen and ink

#### 3D & Digital

- Claymation / stop-motion
- Unreal Engine 5 cinematic render
- Isometric voxel art
- Octane render, volumetric lighting
- Low-poly geometric render
- Photogrammetry scan aesthetic
- Retro PS1-era 3D

### Atmosphere

#### Natural Light

- Golden hour, warm amber tones
- Blue hour, cool twilight
- Overcast morning, soft diffused light
- Dappled sunlight through leaves
- Harsh midday sun with long shadows
- Moonlit, silver highlights
- Storm light, dramatic clouds breaking
- Backlit silhouette at sunset
- First light at dawn, pink and lavender
- Deep forest shade, green-filtered light

#### Studio & Controlled Light

- Rembrandt lighting, single source with nose shadow
- Rim lighting, glowing edges against dark background
- High-key, bright and nearly shadowless
- Low-key, dark and moody with selective highlights
- Split lighting, half the face in shadow
- Butterfly lighting, glamorous overhead source
- Practical lighting only (lamps, screens, candles in frame)

#### Atmospheric & Stylized

- Neon synthwave glow, magenta and cyan
- Cyberpunk flickering lights, wet reflective surfaces
- Candlelit warmth, deep oranges
- Foggy and desaturated, muted palette
- Dusty, sun-bleached, faded tones
- Bioluminescent glow in darkness
- Volcanic, ember-lit haze
- Stark fluorescent, institutional
- Northern lights, aurora overhead
- Underwater caustics, rippling light patterns

### Camera Specifications

#### Lenses

| Lens            | Best For                              | Character                                           |
| --------------- | ------------------------------------- | --------------------------------------------------- |
| 85mm f/1.8      | Portraits                             | Sharp subject, creamy bokeh, flattering compression |
| 50mm f/1.4      | General/street                        | Natural perspective, closest to human eye           |
| 35mm f/1.4      | Environmental portraits, street       | Wider context, slight edge distortion               |
| 24mm wide-angle | Architecture, landscapes              | Dramatic depth, converging lines                    |
| 100mm macro     | Extreme detail, insects, textures     | Razor-thin depth of field, abstract at close range  |
| 135mm f/2       | Portraiture, compressed backgrounds   | Extreme background separation                       |
| 14mm ultra-wide | Interiors, vast landscapes            | Heavy barrel distortion, immersive                  |
| 200mm telephoto | Wildlife, sports, voyeuristic framing | Flattened perspective, stacked planes               |
| Fisheye (8mm)   | Extreme 180° field of view            | Warped, spherical distortion                        |
| Tilt-shift      | Miniature faking, architecture        | Selective focus plane, corrected verticals          |

#### Shot Framing

| Term                    | Description                                             |
| ----------------------- | ------------------------------------------------------- |
| Extreme Close-Up (ECU)  | Eyes only, or a single small detail                     |
| Close-Up (CU)           | Face fills the frame                                    |
| Medium Close-Up (MCU)   | Head and shoulders                                      |
| Medium Shot (MS)        | Waist up                                                |
| Cowboy Shot             | Thigh up (named for Western holster framing)            |
| Full Body Shot          | Head to toe, some environment                           |
| Medium Wide Shot (MWS)  | Full body with generous environment                     |
| Extreme Wide Shot (EWS) | Subject is small in a vast environment                  |
| Over-the-Shoulder (OTS) | Camera behind one person, looking at another            |
| Point of View (POV)     | Camera IS the character's eyes                          |
| Dutch Angle             | Tilted horizon line — tension, unease, or stylized cool |
| Low Angle (Hero Shot)   | Camera looks up — subject appears powerful              |
| High Angle              | Camera looks down — subject appears small or vulnerable |
| Bird's-Eye View         | Directly overhead, map-like                             |
| Worm's-Eye View         | Ground level looking straight up                        |
| Eye-Level Angle         | Most natural, most "human" perspective                  |
| Environmental Portrait  | Subject and setting given equal visual weight           |

#### Film Stocks

| Stock                  | Character                                                             |
| ---------------------- | --------------------------------------------------------------------- |
| Kodak Portra 400       | Warm skin tones, soft contrast, fashion/portrait standard             |
| Kodak Portra 800       | Grainier Portra, works in low light                                   |
| Kodak Ektar 100        | Fine grain, vivid saturated color, landscapes                         |
| Fujifilm Velvia 50     | Extremely saturated, punchy greens and blues, nature                  |
| Fujifilm Superia 400   | Cool-toned, slightly green cast, everyday snapshots                   |
| Fujifilm Pro 400H      | Pastel tones, overexposure-friendly, weddings                         |
| Ilford HP5 Plus 400    | Classic black and white, beautiful grain, flexible                    |
| Kodak Tri-X 400        | Iconic black and white, punchy contrast, photojournalism              |
| CineStill 800T         | Tungsten-balanced, halation glow around highlights, night photography |
| Lomography Color 400   | Heavy grain, unpredictable color shifts, lo-fi                        |
| Vintage 1970s Polaroid | Faded, warm, soft focus, instant-film border                          |
| Kodachrome 64          | Legendary saturated reds and blues, discontinued — nostalgic look     |

### Art Techniques

Use these instead of camera specs when the Medium is art/illustration-based:

- Thick impasto, visible palette knife strokes
- Delicate cross-hatching, fine pen lines
- Wet-on-wet watercolor bleeding
- Flat color with bold outlines
- Stippled pointillism
- Loose gestural brushwork
- Gold leaf accents on dark ground
- Screen-printed halftone dots
- Scratchy drypoint etching marks
- Soft pastel on textured paper
- Sgraffito (scratched through layers)
- Splatter and drip technique

### Render Engines

Use these when the Medium is 3D/digital:

- Unreal Engine 5, Lumen global illumination
- Octane Render, subsurface scattering
- Blender Cycles, volumetric fog
- Cinema 4D, clean studio render
- V-Ray, architectural visualization
- Houdini, particle simulation

---

## Aspect Ratios

Select based on subject matter, or randomize with weighted preference toward 16:9 and 3:2.

| Ratio       | Use Case                                           |
| ----------- | -------------------------------------------------- |
| `--ar 16:9` | Landscapes, cinematic scenes, environments         |
| `--ar 3:2`  | Classic photography ratio, general purpose         |
| `--ar 4:5`  | Portraits, Instagram-friendly, vertical subjects   |
| `--ar 1:1`  | Album covers, icons, symmetrical compositions      |
| `--ar 9:16` | Vertical/mobile, tall structures, standing figures |
| `--ar 21:9` | Ultra-wide cinematic, panoramic                    |

---

## Platform-Specific Parameters

### Midjourney

```
--style raw       // Less "Midjourney-ified," more literal interpretation
--stylize 250     // Moderate artistic interpretation (0–1000 range)
--chaos 10        // Slight variation between outputs (0–100 range)
--no [term]       // Negative prompt — exclude specific elements
--v 7             // Model version (update as needed)
```

### Flux / Stable Diffusion

These models respond well to natural-language prompts without special flags. Emphasize descriptive clarity over parameter flags. Negative prompts go in a separate field, not inline.

### DALL-E 3

Tends to rewrite prompts internally. Be extremely literal and specific. Avoid ambiguous metaphors — this model takes instructions at face value more than Midjourney does.

---

## Example Outputs

**Photorealistic path:**

> A deep-sea welder repairing something delicate, 35mm street photography, Rembrandt lighting with single source and nose shadow, 85mm f/1.8, CineStill 800T --ar 3:2

**Artistic path:**

> A crystalline beehive glowing with bioluminescence, Ukiyo-e woodblock print, moonlit silver highlights, flat color with bold outlines --ar 4:5

**3D/Digital path:**

> A colossal clock tower dissolving into particles, Unreal Engine 5 cinematic render, storm light with dramatic clouds breaking, Octane Render subsurface scattering, low angle hero shot --ar 16:9

**Chaos mode (contrast pairing):**

> A holographic smartphone emerging from morning fog, Fresco on wet plaster, candlelit warmth with deep oranges, gold leaf accents on dark ground --ar 1:1

**Wildcard injection:**

> An elderly botanist reading by candlelight, large-format landscape photography, deep forest shade with green-filtered light, 100mm macro, Kodak Portra 400, tilt-shift --ar 3:2
