# Shared Terms

- **Focused Edit View** -- `/dashboard/edit/$imageId`, image editing workspace with source image, prompt textarea, toolbar, and results grid
- **Variations** -- AI-generated alternative images from existing image, uses Claude Sonnet for prompt generation + FAL Kontext Pro for image gen
- **Variation Prompts Dialog** -- modal in focused edit view for reviewing/editing AI-generated variation prompts before running
- **Source Image** -- the image being edited or varied from in focused edit view
- **Root Image** -- original ancestor image in a variation chain (used for vision to prevent quality drift)
- **Edit Chain** -- sequence of edits/variations traced back to root image
- **Promote** -- make a result image the new source for further editing
- **Reference Images** -- additional images provided as style/content guidance for variations
- **Brainstorm** -- batch prompt generation mode on main AI Images page
- **Generation Results Grid** -- grid of previous edit/variation outputs below the editor
