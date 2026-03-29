# Characters

## Character Library

Freepik has a dedicated Characters page with:

- Pre-built stock characters (diverse headshot portraits, named)
- "My Characters" tab for uploading your own face references
- Each character = a clean portrait photo used as face reference input
- Characters are separate from styles -- you combine: prompt + style ref + character ref(s)

For genzen: a character is just a saved face image. Freepik makes it look sophisticated but under the hood it's a reference headshot fed to the model.

### Simplified genzen approach

- Seed with a few pre-generated diverse headshots as starter characters
- Let users generate new faces on demand via image gen ("generate a 30-year-old woman with red hair")
- Save any generated face to personal character library (name + image)
- Select from library when generating video -- feeds as face_reference param to Kling/FAL
- No complex infrastructure needed -- it's just an image collection with a picker UI

### Bookmark pattern

Stock characters can be bookmarked into "My Characters" -- no upload needed, just save from defaults. Two taps to build your cast. New character creation is just: upload reference image + name it. Dead simple.

## @ Mention UX

Freepik lets you type `@CharacterName` inline in prompts to reference saved characters. Natural and intuitive -- feels like chat. No separate "select character" step. Could reference multiple characters in one prompt.

- Typing `@` in any prompt field triggers a character picker dropdown
- `@Noah` resolves to that character's face reference image behind the scenes
- Works across image gen, video gen, first/last frame prompts -- same syntax everywhere
- Familiar pattern (Slack/GitHub mentions) applied to AI generation
- Multi-character: "@Noah arm wrestles with @Matt while @Jane watches"

### Multi-character testing results

Tested on Freepik with 3 characters (Noah, Helena, Raphael):

- Single character (Noah alone): good coherence across scenes
- Multi-character: hit or miss. Noah drifted in later gens, Helena and Raphael held better
- Lighting/style inconsistency across generations (without style ref locked in)
- Conclusion: character refs are "good enough" for storyboarding, not pixel-perfect. The iterate-and-curate workflow compensates -- generate several, keep the best, discard the rest.

## Character Reference Image Prompt (Triptych)

For generating a character reference to use as a face reference in video generation. Produces a triptych (three angles) from one generation.

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
- All three match -- same character, same lighting, same clothing
- More useful as a face reference than a single-angle portrait
- Cost-efficient: one generation = three usable reference angles

**Usage:** Generate this with FLUX Kontext Pro or Kling Image O3. Save the result as a character in the library. Feed as `face_reference` or `elements` param when generating video.

## Nano Banana Pro Character Reference Sheets

Works well with Nano Banana Pro's /edit endpoint for creating consistent multi-angle character sheets.

**With reference image:**
Create a professional character reference sheet based strictly on the uploaded reference image. Use a clean, neutral plain background and present the sheet as a technical model turnaround while matching the exact visual style of the reference (same realism level, rendering approach, texture, color treatment, and overall aesthetic). Arrange the composition into two horizontal rows. Top row: four full-body standing views placed side-by-side in this order: front view, left profile view (facing left), right profile view (facing right), back view. Bottom row: three highly detailed close-up portraits aligned beneath the full-body row in this order: front portrait, left profile portrait (facing left), right profile portrait (facing right). Maintain perfect identity consistency across every panel. Keep the subject in a relaxed A-pose and with consistent scale and alignment between views, accurate anatomy, and clear silhouette; ensure even spacing and clean panel separation, with uniform framing and consistent head height across the full-body lineup and consistent facial scale across the portraits. Lighting should be consistent across all panels (same direction, intensity, and softness), with natural, controlled shadows that preserve detail without dramatic mood shifts. Output a crisp, print-ready reference sheet look, sharp details.

**Without reference image:**
Create a professional character reference sheet of [CHARACTER DESCRIPTION]. Use a clean, neutral plain background and present the sheet as a technical model turnaround in a photographic style. (Same layout/composition instructions as above.)

### Workflow: Character Sheets -> Scene -> Video

The pipeline for consistent AI video with multiple characters:

1. Generate character reference sheets (one per character) using the prompts above
2. Use those sheets as image references when generating a scene -- the model picks up identity, clothing, and style from the sheets
3. The composed scene becomes the first frame for video generation

This gives you character consistency across shots because each character's identity is locked in via the reference sheet. The scene image references the sheets as "ingredients" rather than trying to describe characters from scratch each time.
