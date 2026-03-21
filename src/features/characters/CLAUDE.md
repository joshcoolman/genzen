Character generation wizard -- describe a character, generate face variations, view angles, save to library (currently mock/UI-only).

## Key Files

- `index.ts` -- barrel exports
- `hooks/useCharactersPage.ts` -- state machine for 3-step flow (generate, angles, saved)
- `components/CharactersPageContent.tsx` -- step UIs with face grid, angle sheet, and saved characters list

## Route

`src/routes/dashboard/dev-workspace.characters.tsx`

## Shared Dependencies

- `@/components/ActionButton` -- primary action buttons

## Quirks / Notes

- Fully mocked -- faces are gradient placeholders, saved characters are hardcoded (Aria, Marcus, Luna)
- No auth or server dependencies -- simplest feature module
- Face count selectable (4, 6, or 9) but all use the same gradient palette
- 9 angle labels defined (Front, Left Quarter, Left Profile, etc.) for the character sheet view
