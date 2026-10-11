<!-- MIT License — Svelte 5 port of Extend UI pdf-editor. Upstream: extend-hq/ui (MIT). -->
<script lang="ts">
	import { docsTheme } from '../_shell/theme.svelte.js';
	import { PdfEditor } from '#lib/components/pdf-editor/index.js';
	import type { EditedPdfPage, PdfEditorDocumentInfo } from '#lib/components/pdf-editor/index.js';

	let isDark = $derived(docsTheme.isDark);
	let pages: EditedPdfPage[] = $state([]);
	let savedFile = $state('');
	let loadedInfo: PdfEditorDocumentInfo | null = $state(null);
</script>

<h1>PDF Editor</h1>
<p>
	Svelte 5 port of the Extend UI pdf-editor (document-level edits: rotate, delete, reorder,
	download). Rendering runs on the client with PDF.js; downloads run on pdf-lib.
</p>

<h2>Fixture document</h2>
<p>
	Dark mode is controlled by the parent through <code>isDark</code> and
	<code>onIsDarkChange</code>; this switch lives on the page, outside the editor.
</p>
<button type="button" role="switch" aria-checked={isDark} onclick={() => (isDark = !isDark)}>
	Dark mode
</button>
<PdfEditor
	src="/fixtures/sample.pdf"
	fileName="sample"
	isDark={isDark}
	onIsDarkChange={(value) => (isDark = value)}
	onDocumentLoadSuccess={(info) => (loadedInfo = info)}
	onPagesChange={(next) => (pages = next)}
	onSave={(result) => (savedFile = result.fileName)}
/>

<p data-testid="pdf-editor-docs-state">
	{#if loadedInfo}
		<span data-testid="pdf-editor-docs-loaded"
			>Loaded {loadedInfo.fileName}, {loadedInfo.numPages} pages, id {loadedInfo.documentId}</span
		><br />
	{/if}
	Edited pages: {pages.length === 0 ? 'none yet' : pages.map((page) => `#${page.sourcePage}@${page.rotation}°`).join(', ')}
	{#if savedFile}
		<span data-testid="pdf-editor-docs-saved">Last download: {savedFile}</span>
	{/if}
</p>

<h2>Differences from upstream</h2>
<ul>
	<li>Document-level edits only (rotate, delete, reorder, reset, download). Not ported yet: annotate, sign, forms, redact, search, print, password prompts, undo/redo, and the imperative handle.</li>
	<li>Keyboard shortcuts while the editor has focus: <kbd>⌘/Ctrl S</kbd> download, <kbd>⌘/Ctrl =</kbd> and <kbd>⌘/Ctrl -</kbd> zoom, <kbd>⌘/Ctrl 0</kbd> fit page. Upstream's undo/redo, print, search, and Escape/Delete annotation shortcuts are not ported.</li>
	<li>A page list beside a single-page preview replaces the upstream scrolling workspace and side panels. The list follows upstream's thumbnail listbox (focus the list, then ArrowUp/ArrowDown/Home/End); page actions (rotate, move, delete) sit in a toolbar above it, like upstream's pages panel.</li>
	<li>Page actions apply to the one selected page. Not ported yet from upstream's pages panel: multi-page selection (Shift/⌘-click), insert blank page, append PDF, and extract pages.</li>
	<li>Delete asks for confirmation in the editor and never removes the last page, like upstream; the notice shows inline instead of as a toast.</li>
	<li>Renders with PDF.js through the shared engine and downloads with pdf-lib instead of EmbedPDF; zoom modes use EmbedPDF's formulas.</li>
	<li>Dark mode is parent-controlled with <code>isDark</code> and <code>onIsDarkChange</code>; the editor renders no dark toggle.</li>
	<li><code>class</code> and <code>className</code> are both accepted.</li>
	<li>Extra props: <code>onPagesChange</code>, <code>height</code>, <code>pageWidth</code>/<code>pageHeight</code> (fallback page size).</li>
	<li>Not accepted yet: <code>defaultMode</code>, <code>annotationAuthor</code>, <code>colorPresets</code>, <code>features</code>, <code>toolbarActions</code>, <code>selectionActions</code>, <code>persistSignatures</code>, <code>stampManifests</code>, <code>signatureFontsStylesheetUrl</code>, <code>resolveScrollAreaViewport</code>, <code>renderPageOverlay</code>, and the mode, annotation, form, redaction, capture, toast, and selection callbacks.</li>
	<li>Port-only exports: <code>PdfEditor</code> (the same component as <code>PDFEditor</code>) and the page-model helpers <code>createEditState</code>, <code>deleteEditPage</code>, <code>exportEditedPdf</code>, <code>getPdfFileName</code>, <code>moveEditPage</code>, <code>resetEditState</code>, <code>rotateEditPage</code>. Port-only types: <code>PdfEditorProps</code>, <code>PdfEditorDocumentInfo</code>, <code>PdfEditorSaveResult</code>, <code>PdfEditorZoomLevel</code>, <code>EditedPdfPage</code>, <code>PdfEditState</code>, <code>PdfRotateDirection</code> (upstream's <code>PDFEditorProps</code> and <code>PDFEditorZoomLevel</code> are exported too). Not exported: upstream's <code>serializeAnnotationItems</code>, <code>deserializeAnnotationItems</code>, <code>PDFEditorHandle</code>, <code>PDFEditorToast</code> and <code>PDFEditorPageOverlayProps</code>, which belong to features not ported.</li>
</ul>

<p><a href="/">Back to overview</a></p>

<style>
	h2 {
		margin-top: 2rem;
	}
</style>
