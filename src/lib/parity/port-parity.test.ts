// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
// Port-parity suite: checks every component against the upstream React contract.
// Each "known gap" ledger below must match reality exactly, so closing a gap (or
// opening a new one) fails the suite until the ledger is updated.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { chai, describe, expect, it } from 'vitest';
import registry from '../../../registry.json';

const COMPONENTS_DIR = 'src/lib/components';

// Print full gap lists on failure so the ledgers are easy to update.
chai.config.truncateThreshold = 0;

// Public props of each upstream React component, read from extend-hq/ui @ 54adccfb
// (apps/v4/components/extend/*.tsx, components/ui/*.tsx, registry blocks).
// Keys are port component paths relative to src/lib/components.

const UPSTREAM_REF = 'extend-hq/ui@54adccfb';

const UPSTREAM_PROPS: Record<string, { upstream: string; props: string[] }> = {
	'pdf-viewer/PdfViewer.svelte': {
		upstream: 'PDFViewer',
		props: [
			'className', 'defaultZoom', 'fileName', 'resolveScrollAreaViewport', 'showDownload',
			'showToolbar', 'showRotateControls', 'showUpload', 'src', 'toolbarActions', 'pageClassName',
			'renderPageOverlay', 'onActivePageChange', 'onDocumentLoadSuccess', 'onPdfUpload',
			'onPagePointerDown', 'onPagePointerMove', 'onPagePointerUp', 'onPagePointerCancel'
		]
	},
	'pdf-editor/PdfEditor.svelte': {
		upstream: 'PDFEditor',
		props: [
			'className', 'src', 'fileName', 'defaultZoom', 'defaultMode', 'annotationAuthor',
			'colorPresets', 'features', 'showToolbar', 'showUpload', 'showDownload', 'toolbarActions',
			'selectionActions', 'persistSignatures', 'stampManifests', 'signatureFontsStylesheetUrl',
			'resolveScrollAreaViewport', 'renderPageOverlay', 'onDocumentLoadSuccess',
			'onDocumentLoadError', 'onActivePageChange', 'onModeChange', 'onAnnotationEvent',
			'onAnnotationsChange', 'onFormValuesChange', 'onRedactionsApplied', 'onSave', 'onCapture',
			'onPdfUpload', 'onToast', 'onSelectionAction'
		]
	},
	'docx-viewer/DocxViewer.svelte': {
		upstream: 'DocxViewerPreview',
		props: [
			'className', 'defaultZoom', 'fileName', 'isDark', 'onIsDarkChange', 'showDownload',
			'showToolbar', 'showUpload', 'src', 'toolbarActions'
		]
	},
	'docx-editor/DocxEditor.svelte': {
		upstream: 'DocxEditorPreview',
		props: ['className', 'defaultZoomScale', 'fileName', 'isDark', 'onIsDarkChange', 'src']
	},
	'xlsx-viewer/XlsxViewer.svelte': {
		upstream: 'XlsxViewerPreview',
		props: [
			'className', 'fileName', 'isDark', 'onIsDarkChange', 'showDownload', 'showToolbar',
			'showUpload', 'src', 'toolbarActions'
		]
	},
	'xlsx-editor/XlsxEditor.svelte': {
		upstream: 'XlsxEditorPreview',
		props: ['className', 'fileName', 'isDark', 'onIsDarkChange', 'src']
	},
	'pptx-viewer/PptxViewer.svelte': {
		upstream: 'PptxViewerPreview',
		props: [
			'className', 'defaultThumbnailSidebarOpen', 'defaultZoom', 'fileName', 'initialSlide',
			'showDownload', 'showToolbar', 'showUpload', 'src', 'toolbarActions'
		]
	},
	'csv-tsv-viewer/CsvTsvViewer.svelte': {
		upstream: 'CsvViewer',
		props: ['className', 'data', 'search']
	},
	'file-upload/FileUpload.svelte': {
		upstream: 'FileUpload',
		props: [
			'accept', 'acceptedFileTypes', 'borderBeamTheme', 'browseLabel', 'className', 'description',
			'draggingLabel', 'multiple', 'showBorderBeam', 'showFileList', 'title', 'onFilesAccepted',
			'onFilesChange'
		]
	},
	'file-thumbnail/FileThumbnail.svelte': {
		upstream: 'FileThumbnail',
		props: [
			'file', 'className', 'previewAspectRatio', 'previewClassName', 'previewContent',
			'previewImageUrl', 'isLoading', 'hasError'
		]
	},
	'file-system/FileSystem.svelte': {
		upstream: 'FileSystem',
		props: [
			'items', 'className', 'title', 'defaultView', 'view', 'onViewChange', 'defaultPath',
			'onSelectionChange', 'onFileOpen', 'getFileUrl', 'loadChildren', 'renderFilePreview',
			'loadPreviewImageUrl'
		]
	},
	'document-splits/DocumentSplits.svelte': {
		upstream: 'DocumentSplits',
		props: ['className', 'splits', 'thumbnailImages', 'withFrameDivider', 'onSelectPage', 'onSplitsChange']
	},
	'layout-blocks/LayoutBlocks.svelte': {
		upstream: 'OcrBlocksPanel',
		props: ['activeBlockId', 'blocks', 'className', 'onBlockFocus']
	},
	'bounding-box-citations/BoundingBoxCitations.svelte': {
		upstream: 'HumanReviewPanel',
		props: [
			'fields', 'activeFieldKey', 'className', 'onFieldFocus', 'onLocationHover',
			'resolveArrayItemMetadataPath', 'resolveLocation', 'showExpected', 'theme'
		]
	},
	'schema-builder/SchemaBuilder.svelte': {
		upstream: 'SchemaBuilderPanel',
		props: ['className', 'defaultSchema', 'schema', 'onSchemaChange', 'theme']
	},
	'e-signature/ESignature.svelte': {
		upstream: 'ESignatureBlock',
		props: ['file']
	},
	'document-viewer-sidebar/DocumentViewerSidebar.svelte': {
		upstream: 'DocumentViewerThumbnailSidebar',
		props: ['children', 'className', 'closedInlineClassName', 'inline', 'open', 'widthClassName']
	},
	'color-picker/ColorPicker.svelte': {
		upstream: 'ColorPicker',
		props: [
			'value', 'color', 'onChange', 'label', 'disabled', 'showAlpha', 'defaultFormat', 'variant',
			'className', 'icon', 'rainbowTrigger', 'onTriggerMouseDown', 'onTriggerPointerDown'
		]
	},
	'color-picker/ColorPickerPanel.svelte': {
		upstream: 'ColorPickerPanel',
		props: ['className', 'color', 'label', 'onChange', 'showAlpha']
	},
	'group/Group.svelte': { upstream: 'Group', props: ['className', 'orientation', 'children'] },
	'group/GroupText.svelte': { upstream: 'GroupText', props: ['className', 'render'] },
	'group/GroupSeparator.svelte': { upstream: 'GroupSeparator', props: ['className', 'orientation'] },
	// Toggle primitives wrap Base UI; the list adds the Base UI props the docs use.
	'toggle/Toggle.svelte': {
		upstream: 'Toggle',
		props: ['className', 'variant', 'size', 'pressed', 'defaultPressed', 'onPressedChange', 'disabled', 'value']
	},
	'toggle/ToggleGroup.svelte': {
		upstream: 'ToggleGroup',
		props: ['className', 'orientation', 'spacing', 'value', 'defaultValue', 'onValueChange', 'disabled']
	},
	'toggle/ToggleGroupItem.svelte': {
		upstream: 'ToggleGroupItem',
		props: ['className', 'variant', 'size', 'value']
	}
};

/** Top-level keys of the `let { ... } = $props()` destructure (`class: className` yields `class`). */
function portProps(source: string): string[] {
	const end = source.indexOf('$props()');
	if (end < 0) return [];
	const close = source.lastIndexOf('}', end);
	let depth = 0;
	let open = close;
	for (; open >= 0; open--) {
		const c = source[open];
		if (c === '}' || c === ')' || c === ']') depth++;
		else if (c === '{' || c === '(' || c === '[') depth--;
		if (depth === 0) break;
	}
	const body = source.slice(open + 1, close);
	const keys: string[] = [];
	let current = '';
	depth = 0;
	for (let i = 0; i < body.length; i++) {
		const c = body[i];
		// The `>` of an arrow (`=>`) is not a closing delimiter.
		if (c === '>' && body[i - 1] === '=') {
			current += c;
			continue;
		}
		if ('{([<'.includes(c)) depth++;
		else if ('})]>'.includes(c)) depth--;
		if (c === ',' && depth === 0) {
			keys.push(current);
			current = '';
		} else current += c;
	}
	keys.push(current);
	return keys
		.map((entry) => entry.replace(/\/\/.*$/gm, '').trim())
		.filter((entry) => entry && !entry.startsWith('...'))
		.map((entry) => entry.match(/^[A-Za-z_$][\w$]*/)?.[0] ?? '')
		.filter(Boolean);
}

/** The leading `<!-- ... -->` comment, where deliberate API changes are recorded. */
function header(source: string): string {
	return source.match(/^\s*<!--([\s\S]*?)-->/)?.[1] ?? '';
}

const read = (path: string) => readFileSync(join(COMPONENTS_DIR, path), 'utf8');

// Upstream props the port neither implements nor records as a deliberate change.
const KNOWN_UNRECORDED_PROPS: Record<string, string[]> = {
	'pdf-viewer/PdfViewer.svelte': [
		'resolveScrollAreaViewport',
		'onPagePointerDown',
		'onPagePointerMove',
		'onPagePointerUp',
		'onPagePointerCancel'
	],
	'pdf-editor/PdfEditor.svelte': [
		'defaultMode',
		'annotationAuthor',
		'colorPresets',
		'features',
		'toolbarActions',
		'selectionActions',
		'persistSignatures',
		'stampManifests',
		'signatureFontsStylesheetUrl',
		'resolveScrollAreaViewport',
		'renderPageOverlay',
		'onModeChange',
		'onAnnotationEvent',
		'onAnnotationsChange',
		'onFormValuesChange',
		'onRedactionsApplied',
		'onCapture',
		'onToast',
		'onSelectionAction'
	],
	'docx-viewer/DocxViewer.svelte': ['className'],
	'docx-editor/DocxEditor.svelte': ['className', 'defaultZoomScale'],
	'xlsx-viewer/XlsxViewer.svelte': ['className', 'toolbarActions'],
	'xlsx-editor/XlsxEditor.svelte': ['className'],
	'file-system/FileSystem.svelte': [
		'defaultView',
		'view',
		'onViewChange',
		'onFileOpen',
		'getFileUrl',
		'loadChildren',
		'renderFilePreview',
		'loadPreviewImageUrl'
	],
	'bounding-box-citations/BoundingBoxCitations.svelte': ['resolveArrayItemMetadataPath'],
	'schema-builder/SchemaBuilder.svelte': ['className', 'theme'],
	'e-signature/ESignature.svelte': ['file'],
	// The port is a section/nav sidebar, not upstream's thumbnail sidebar shell.
	'document-viewer-sidebar/DocumentViewerSidebar.svelte': [
		'className',
		'closedInlineClassName',
		'inline',
		'open',
		'widthClassName'
	],
	'toggle/ToggleGroupItem.svelte': ['className', 'variant', 'size']
};

describe('port parity: props', () => {
	it('covers every registry component', () => {
		const covered = new Set(Object.keys(UPSTREAM_PROPS).map((path) => path.split('/')[0]));
		const components = (registry.items as { name: string; type: string }[])
			.filter((item) => existsSync(join(COMPONENTS_DIR, item.name)))
			.map((item) => item.name);
		expect(components.length).toBe(20);
		expect(components.filter((name) => !covered.has(name))).toEqual([]);
	});

	it('extracts props from a destructure', () => {
		expect(portProps('let { a = 1, b = { c: [1, 2] }, class: cls, ...rest }: P = $props();')).toEqual([
			'a',
			'b',
			'class'
		]);
		expect(portProps('let { onSave = () => {}, src }: P = $props();')).toEqual(['onSave', 'src']);
	});

	for (const [path, { upstream, props }] of Object.entries(UPSTREAM_PROPS)) {
		it(`${path} keeps or records every ${upstream} prop (${UPSTREAM_REF})`, () => {
			const source = read(path);
			const ported = new Set(portProps(source));
			expect(ported.size).toBeGreaterThan(0);
			const notes = header(source);
			const unrecorded = props.filter((prop) => !ported.has(prop) && !new RegExp(`\\b${prop}\\b`).test(notes));
			expect(unrecorded).toEqual(KNOWN_UNRECORDED_PROPS[path] ?? []);
		});
	}
});

// Components that change `isDark` themselves instead of leaving it to the parent.
const KNOWN_SELF_THEMING = [
	'document-viewer-sidebar/DocumentViewerSidebar.svelte',
	'schema-builder/SchemaBuilder.svelte'
];

describe('port parity: dark mode is owned by the parent', () => {
	for (const path of Object.keys(UPSTREAM_PROPS)) {
		const source = read(path);
		it(`${path} never assigns isDark itself`, () => {
			// `$bindable` lets the child write it back; an `isDark = ...;` statement flips it locally.
			// Destructure defaults and prop passing (`isDark={dark}`) have no trailing semicolon.
			const selfTheming =
				/isDark\s*=\s*\$bindable/.test(source) || /^\s*isDark\s*=[^=].*;\s*$/m.test(source);
			expect(selfTheming).toBe(KNOWN_SELF_THEMING.includes(path));
		});
	}
});

// Registry components whose main export is missing from the package entry point.
const KNOWN_MISSING_EXPORTS = [
	'PdfViewer',
	'PdfEditor',
	'DocxViewer',
	'DocxEditor',
	'XlsxViewer',
	'XlsxEditor',
	'PptxViewer',
	'FileUpload',
	'FileThumbnail',
	'FileSystem',
	'DocumentSplits',
	'LayoutBlocks',
	'BoundingBoxCitations',
	'SchemaBuilder',
	'ESignature',
	'DocumentViewerSidebar'
];

describe('port parity: package entry exports every component', () => {
	const barrel = readFileSync('src/lib/index.ts', 'utf8');
	for (const [path, { upstream }] of Object.entries(UPSTREAM_PROPS)) {
		const name = path.split('/')[1].replace('.svelte', '');
		it(`exports ${name} (upstream ${upstream})`, () => {
			const exported = new RegExp(`\\b${name}\\b`).test(barrel);
			expect(exported).toBe(!KNOWN_MISSING_EXPORTS.includes(name));
		});
	}
});

// Docs pages that are still placeholders instead of rendering the component.
const KNOWN_PLACEHOLDER_PAGES = ['group', 'color-picker', 'toggle'];

describe('port parity: docs site renders each component', () => {
	const slugs = [...new Set(Object.keys(UPSTREAM_PROPS).map((path) => path.split('/')[0]))];
	for (const slug of slugs) {
		it(`/${slug} imports and renders the ported component`, () => {
			const page = readFileSync(`src/routes/${slug}/+page.svelte`, 'utf8');
			const real = page.includes(`components/${slug}/`) && !/Coming soon/i.test(page);
			expect(real).toBe(!KNOWN_PLACEHOLDER_PAGES.includes(slug));
		});
	}
});

describe('port parity: MIT attribution', () => {
	function files(dir: string): string[] {
		return readdirSync(dir).flatMap((entry) => {
			const full = join(dir, entry);
			if (statSync(full).isDirectory()) return files(full);
			return /\.(svelte|ts)$/.test(full) && !/\.(test|spec)\.ts$/.test(full) ? [full] : [];
		});
	}
	it('every library source file credits extend-hq/ui under MIT', () => {
		const missing = files('src/lib').filter((file) => {
			const head = readFileSync(file, 'utf8').slice(0, 600);
			return !(head.includes('MIT') && head.includes('extend-hq/ui'));
		});
		expect(missing).toEqual([]);
	});
});
