# Camera angles

Sixteen camera positions for producing a variation set from a single reference
image. Nothing here describes a subject — the subject arrives from the reference.
Only the camera moves.

Usage: paste the sixteen into **Paste Prompts**, attach the reference image, and
set the constant block as the prompt prefix so every shot carries it.

Blank lines separate the prompts — that is what `splitPrompts` in
`paste-prompts-dialog.tsx` splits on when no `*` is present. Single newlines
would arrive as one prompt.

## The constant block

Prepend to every shot. The inventory is what gives the freeze something to grip —
"keep it consistent" alone does not bind.

```
Inventory everything visible in the reference image: subject form and proportions, materials, colors, surface texture and condition, any markings or detailing, the environment and its geometry, light direction, light quality, and shadow behavior. All of it must remain 100% unchanged. Do not add, remove, restyle, or reinterpret anything. The environment, lighting, and color grade are locked. This frame is a resting point after a camera move — describe only the final camera position and the subject at rest, never the motion and never motion blur. This is the same subject in the same scene from a different camera placement, not a different scene. Depth of field follows focal length: deep for distant shots, shallow for close and detail shots. Output one photoreal image matching the reference image's aspect ratio.
```

## The sixteen

```
Neutral Three-Quarter, Eye Level - Camera at the subject's own mid-height, medium distance, subject turned roughly forty-five degrees toward the lens. Standard focal length, level horizon, even framing. No distortion and no drama.

Worm's-Eye Hero - Camera at ground level directly beneath the subject's leading edge, tilted steeply upward, close enough that the base of the subject fills the lower frame. Wide lens. Extreme foreshortening makes the near mass monumental while the top recedes small and distant.

Low Oblique Full View - Camera low but not on the ground, angled obliquely across the subject rather than square to it. The full form stays in frame while the perspective stretches it upward. Converging verticals, dominant near-ground.

Side-On Compression - Camera far to one side, long lens. Clean profile or near-profile with space flattened, so foreground, subject and background stack into bands rather than receding. The silhouette reads as a single graphic shape.

High-Angle Three-Quarter - Camera well above the subject and off-center, looking down along a diagonal. Top surfaces become visible and the form reads as an abstract shape against the ground plane. The ground, not the sky, is the backdrop.

True Overhead - Camera directly above, lens pointed straight down, subject centered. Perspective collapses to a plan view: outline and top-surface layout only, depth cues gone except for cast shadow.

Rear Three-Quarter - Camera behind the subject and offset to one side, medium distance, slightly above mid-height. Shows the back and one flank together, with the direction the subject faces leading out of frame.

Direct Rear, Wide - Camera squarely behind at mid-height, wider framing so the environment ahead of the subject occupies the upper half. The subject becomes a silhouette against its own destination.

Forced-Perspective Foreground Thrust - Camera very low and very close, with the subject's nearest projecting element extended toward the lens so it reads massively out of proportion in the foreground. The rest of the form tapers back and away. Widest lens in the set.

Extreme Detail, Non-Intuitive Direction - Camera extremely close to a single feature such as a seam, joint, edge, opening or change of material, approached from an unusual direction such as from beneath or from behind an overhanging part. Macro depth of field. Abstract and textural.

Ground-Level Base Detail - Camera on the ground with the subject's lowest element dominating the immediate foreground in sharp detail, the rest of the form tapering upward to a small far end. Severe foreshortening along the vertical axis.

Wide Establishing, Subject Small - Camera far back and slightly elevated, subject occupying a small fraction of frame. Atmospheric depth, environment dominant. The place contains the subject rather than the subject dominating the place.

Dutch Angle, Mid-Distance - Camera at mid-height and medium distance, rolled fifteen to twenty degrees off level. Horizon tilts and verticals lean. Nothing about the subject changes; the instability is entirely optical.

Close Offset Portrait - Camera very close to the subject's most characteristic upper feature, positioned slightly above or below its center line at an offset angle rather than square on. Shallow depth of field, the near surface rendered in full texture.

Over-and-Behind - Camera set back and above one shoulder or upper edge, the subject occupying the near third of frame and facing away into the scene. The subject becomes foreground mass and the environment beyond becomes the content.

Frontal Symmetrical, Long Lens - Camera square to the front at mid-height, longer focal length, subject centered and symmetrical. Deliberately flat and deadpan, with no oblique angle and no foreshortening. Reads as a catalogue or specimen frame.
```

## Limits worth knowing

**The constant block is doing less work than expected.** First real run — 16
prompts, one mech reference, FLUX Kontext Pro — produced usable, on-angle,
identity-stable output. The shot descriptions carry the result largely on their
own; the constant block is insurance, not the mechanism. Do not grow it.

**Two of sixteen came back as a solid black frame.** Rear Three-Quarter and Wide
Establishing. Byte-identical PNGs, 1024x768 — not even the requested 3:4 — so it
is a canned refusal from the provider's safety filter, not a failed render. Both
prompts are innocuous, so treat it as a false positive to re-run, not a prompt to
fix.

**Sixteen is near the honest ceiling for one reference image.** Every frame here
is a reprojection of what the reference actually shows. Push further and the
remaining positions are the ones the source never captured, so the model invents
geometry rather than deriving it — plausible, and no longer the same subject.

**Rear Three-Quarter, Direct Rear and Over-and-Behind are already partly
invented** unless the reference shows the subject's back. They drift first. Drop
them when the source is a straight-on view.

**Detail shots are the only ones that scale with the subject.** A form with many
distinct features supports several variants of the two detail frames; a smooth
simple form supports one. Adjust the count there rather than adding camera
positions.

**A second reference from another side roughly doubles the honest range**, because
the far geometry stops being guesswork. That is the real lever, not better
prompting.
