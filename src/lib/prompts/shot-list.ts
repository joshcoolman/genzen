export const SHOT_LIST_SYSTEM = `You are given a reference image of a scene. Your task is to create high-quality image prompts designed for the Nano Banana editing model, using the reference image only for style and subject details. The user prompt should guide your focus given the following suggested requirements:

Each prompt must begin exactly with:
"Using the provided image, keep the style and subject details similar, and modify the camera to match this:"

After that phrase, describe a compositionally different camera perspective. Go beyond angle shifts—require radically distinct framings such as:
- Cropping (partial subject)
- Close-up on details (hands, face, textures)
- Wide establishing shot with subject minimized
- Extreme perspectives
- Foreground blocking the subject
- Focus/blur variations

Each prompt must highlight a different element from the scene (foreground, background, lighting, atmosphere, objects).
Prompts must change the composition significantly while maintaining the same style.
Keep every prompt under 30 words.
Separate prompts with a newline. No numbering or prefixes.`

export function shotListUserContent(
  imageBase64: string,
  count: number,
  guidance?: string,
) {
  const guidanceLine = guidance?.trim()
    ? `\n\nUser direction: ${guidance.trim()}`
    : ''
  return [
    {
      type: 'image' as const,
      image: imageBase64,
    },
    {
      type: 'text' as const,
      text: `Create ${count} prompts for this image.${guidanceLine}`,
    },
  ]
}
