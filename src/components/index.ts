// Staging folder -- see primitives/README.md. These move up into src/components/
// before #185 closes; the import path for consumers never changes.
export { Stack, type StackProps } from './primitives/stack/stack'
export {
  PageHeader,
  type PageHeaderProps,
} from './primitives/page-header/page-header'
export {
  Pagination,
  type PaginationProps,
} from './primitives/pagination/pagination'
export {
  SingleSelect,
  type SingleSelectProps,
  type SingleSelectOption,
} from './primitives/single-select/single-select'
export {
  MultiSelect,
  type MultiSelectProps,
  type MultiSelectOption,
} from './primitives/multi-select/multi-select'

export { ActionButton } from './action-button/action-button'
export { AspectRatioSelect } from './aspect-ratio-select/aspect-ratio-select'
export {
  LANDSCAPE_RATIOS,
  PORTRAIT_RATIOS,
  FLIP_MAP,
  getRatioOptions,
  flipOrientation,
} from './aspect-ratio-select/aspect-ratio-constants'
export { ClipboardPasteButton } from './clipboard-paste-button/clipboard-paste-button'
export { useClipboardPaste } from './clipboard-paste-button/use-clipboard-paste'
export { CopyButton } from './copy-button/copy-button'
export { ExpandableIconButton } from './expandable-icon-button/expandable-icon-button'
export { ExpandableText } from './expandable-text/expandable-text'
export { FileUploadButton } from './file-upload-button/file-upload-button'
export { ImageGrid, ImageGridSkeleton } from './image-grid/image-grid'
export { ImageSourceButtons } from './image-source-buttons/image-source-buttons'
export {
  ImageSourceDialog,
  type ImageSourceResult,
} from './image-source-dialog/image-source-dialog'
export {
  LibraryPickerButton,
  type SelectedImage,
} from './library-picker-button/library-picker-button'
export { LibraryPickerDialog } from './library-picker-button/library-picker-dialog'
export { Lightbox, type LightboxImage } from './lightbox/lightbox'
export {
  MissingKeyProvider,
  useReportError,
} from './missing-key-dialog/missing-key-dialog'
export { MobileDialogHeader } from './mobile-dialog-header/mobile-dialog-header'
export { NumberStepper } from './number-stepper/number-stepper'
export { RefImageStrip } from './ref-image-strip/ref-image-strip'
export { SelectionDrawer } from './selection-drawer/selection-drawer'
export { SourceImagePreview } from './source-image-preview/source-image-preview'
export { Thumbnail, type ThumbnailProps } from './thumbnail/thumbnail'

// shadcn primitives (#185 replaces these with Base UI, one component at a time)
export * from './ui/alert-dialog/alert-dialog'
export * from './ui/badge/badge'
export * from './ui/button/button'
export * from './ui/checkbox/checkbox'
export * from './ui/command/command'
export * from './ui/dialog/dialog'
export * from './ui/dropdown-menu/dropdown-menu'
export * from './ui/input/input'
export * from './ui/popover/popover'
export * from './ui/select/select'
export * from './ui/sheet/sheet'
export * from './ui/skeleton/skeleton'
export * from './ui/textarea/textarea'
export * from './ui/toast/toast'
export * from './ui/tooltip/tooltip'
