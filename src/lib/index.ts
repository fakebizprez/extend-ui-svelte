// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).

// Reexport your entry components here
export { default as Placeholder } from './Placeholder.svelte';
export {
	CsvTsvViewer,
	CsvViewer,
	default as CsvTsvViewerDefault,
	parseDelimitedText,
	type CsvTsvViewerProps,
	type ParsedTable
} from './components/csv-tsv-viewer/index.js';
export { DEFAULT_IS_DARK, resolveIsDark, toggleIsDark } from './dark-mode';
export type { DarkModeProps } from './dark-mode';
export { VirtualList } from './virtual-list/index';
export { computeWindow, DEFAULT_OVERSCAN } from './virtual-list/index';
export {
	ButtonGroup,
	ButtonGroupSeparator,
	ButtonGroupText,
	Group,
	GroupSeparator,
	GroupText,
	groupVariants,
	type GroupOrientation,
	type GroupProps,
	type GroupSeparatorOrientation,
	type GroupSeparatorProps,
	type GroupTextProps
} from './components/group/index.js';
export {
	ColorPicker,
	ColorPickerPanel,
	type ColorFormat,
	type ColorPickerPanelProps,
	type ColorPickerProps,
	type ColorPickerVariant
} from './components/color-picker/index.js';
export {
	Toggle,
	ToggleGroup,
	ToggleGroupItem,
	toggleGroupVariants,
	toggleVariants,
	type ToggleGroupItemProps,
	type ToggleGroupOrientation,
	type ToggleGroupProps,
	type ToggleGroupSpacing,
	type ToggleProps,
	type ToggleSize,
	type ToggleVariant
} from './components/toggle/index.js';

// Document components. Each folder's index.ts also exports its helpers.
export {
	BoundingBoxCitations,
	HumanReviewBlock,
	HumanReviewHighlight,
	HumanReviewPanel,
	JsonCodeView,
	JsonDiffView,
	type BoundingBoxCitationsProps,
	type HumanReviewPanelProps
} from './components/bounding-box-citations/index.js';
export { DocumentSplits } from './components/document-splits/index.js';
export {
	DocumentViewerSidebarSkeleton,
	DocumentViewerThumbnailSidebar,
	useElementWidth,
	useInlineThumbnailSidebar
} from './components/document-viewer-sidebar/index.js';
export { DocxEditor, DocxEditorPreview } from './components/docx-editor/index.js';
export { DocxViewer, DocxViewerPreview } from './components/docx-viewer/index.js';
export { ESignature, ESignatureBlock, type ESignatureProps } from './components/e-signature/index.js';
export { FileSystem } from './components/file-system/index.js';
export { FileThumbnail } from './components/file-thumbnail/index.js';
export { FileUpload } from './components/file-upload/index.js';
export { LayoutBlocks, OcrBlocksPanel } from './components/layout-blocks/index.js';
export {
	PDFEditor,
	PdfEditor,
	type PDFEditorProps,
	type PdfEditorProps
} from './components/pdf-editor/index.js';
export {
	PDFViewer,
	PdfViewer,
	type PDFViewerProps,
	type PdfViewerProps
} from './components/pdf-viewer/index.js';
export { PptxViewer, PptxViewerPreview } from './components/pptx-viewer/index.js';
export { SchemaBuilder, SchemaBuilderPanel } from './components/schema-builder/index.js';
export { XlsxEditor, XlsxEditorPreview } from './components/xlsx-editor/index.js';
export { XlsxViewer, XlsxViewerPreview } from './components/xlsx-viewer/index.js';
