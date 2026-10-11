// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
// The npm package root must ship every component, under the port name and the
// upstream React name, and importing it must be safe outside the browser.
import { describe, expect, it } from 'vitest';
import * as root from './index';

const COMPONENTS: Record<string, string[]> = {
	'bounding-box-citations': [
		'BoundingBoxCitations',
		'HumanReviewBlock',
		'HumanReviewPanel',
		'HumanReviewHighlight',
		'JsonDiffView',
		'JsonCodeView'
	],
	'color-picker': ['ColorPicker', 'ColorPickerPanel'],
	'csv-tsv-viewer': ['CsvTsvViewer', 'CsvViewer'],
	'document-splits': ['DocumentSplits'],
	'document-viewer-sidebar': ['DocumentViewerThumbnailSidebar', 'DocumentViewerSidebarSkeleton'],
	'docx-editor': ['DocxEditor', 'DocxEditorPreview'],
	'docx-viewer': ['DocxViewer', 'DocxViewerPreview'],
	'e-signature': ['ESignature', 'ESignatureBlock'],
	'file-system': ['FileSystem'],
	'file-thumbnail': ['FileThumbnail'],
	'file-upload': ['FileUpload'],
	group: ['Group', 'GroupText', 'GroupSeparator', 'ButtonGroup'],
	'layout-blocks': ['LayoutBlocks', 'OcrBlocksPanel'],
	'pdf-editor': ['PdfEditor', 'PDFEditor'],
	'pdf-viewer': ['PdfViewer', 'PDFViewer'],
	'pptx-viewer': ['PptxViewer', 'PptxViewerPreview'],
	'schema-builder': ['SchemaBuilder', 'SchemaBuilderPanel'],
	toggle: ['Toggle', 'ToggleGroup', 'ToggleGroupItem'],
	'xlsx-editor': ['XlsxEditor', 'XlsxEditorPreview'],
	'xlsx-viewer': ['XlsxViewer', 'XlsxViewerPreview']
};

describe('package root', () => {
	for (const [component, names] of Object.entries(COMPONENTS)) {
		it(`exports ${component} as ${names.join(', ')}`, () => {
			for (const name of names) {
				expect(typeof (root as Record<string, unknown>)[name], name).toBe('function');
			}
		});
	}

	it('exports the sidebar width helpers', () => {
		expect(typeof root.useElementWidth).toBe('function');
		expect(typeof root.useInlineThumbnailSidebar).toBe('function');
	});
});
