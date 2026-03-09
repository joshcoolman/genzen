Multi-step wizard for training custom image styles from reference images (currently mock/UI-only).

## Key Files

- `index.ts` -- barrel exports
- `hooks/useStyleTrainerPage.ts` -- state machine driving 5-step wizard (collect, configure, training, test, library)
- `components/StyleTrainerPageContent.tsx` -- all step UIs rendered conditionally; includes StyleMeter quality indicator

## Route

`src/routes/dashboard/style-trainer.tsx`

## Shared Dependencies

- `@/components/ActionButton` -- primary action buttons
- `@/components/ImageSourceButtons` -- upload + library picker combo
- `@/components/LibraryPickerButton` -- SelectedImage type
- `@/lib/auth` -- useAuth for user context
- `@/features/describe/hooks/useExistingImages` -- fetches user's existing image library

## Quirks / Notes

- Training is fully mocked -- progress is hardcoded to 100%, test results reuse reference images
- Reference images capped at 20, minimum 5 required to proceed
- Supports both file upload and library image selection (single + multi)
- No server-side code -- entirely client-state driven
