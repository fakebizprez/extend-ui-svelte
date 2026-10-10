// Shared component catalogue for the docs site skeleton.
// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).

export interface PreviewComponent {
	slug: string;
	title: string;
}

export const PREVIEW_COMPONENTS: PreviewComponent[] = [
	{ slug: 'file-upload', title: 'File Upload' },
	{ slug: 'csv-tsv-viewer', title: 'CSV/TSV Viewer' },
	{ slug: 'document-viewer-sidebar', title: 'Document Viewer Sidebar' },
	{ slug: 'file-thumbnail', title: 'File Thumbnail' },
	{ slug: 'pdf-viewer', title: 'PDF Viewer' },
	{ slug: 'docx-viewer', title: 'DOCX Viewer' },
	{ slug: 'xlsx-viewer', title: 'XLSX Viewer' },
	{ slug: 'pptx-viewer', title: 'PPTX Viewer' },
	{ slug: 'pdf-editor', title: 'PDF Editor' },
	{ slug: 'docx-editor', title: 'DOCX Editor' },
	{ slug: 'xlsx-editor', title: 'XLSX Editor' },
	{ slug: 'file-system', title: 'File System' },
	{ slug: 'document-splits', title: 'Document Splits' },
	{ slug: 'schema-builder', title: 'Schema Builder' },
	{ slug: 'layout-blocks', title: 'Layout Blocks' },
	{ slug: 'bounding-box-citations', title: 'Bounding Box Citations' },
	{ slug: 'e-signature', title: 'E-Signature' },
	{ slug: 'group', title: 'Group' },
	{ slug: 'color-picker', title: 'Color Picker' },
	{ slug: 'toggle', title: 'Toggle' }
];
