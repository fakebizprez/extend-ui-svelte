<!-- MIT License — Svelte 5 port of Extend UI pdf-editor. Upstream: extend-hq/ui (MIT). -->
<script lang="ts">
	import { PdfEditor } from '#lib/components/pdf-editor/index.js';
	import type { EditedPdfPage } from '#lib/components/pdf-editor/index.js';

	let isDark = $state(false);
	let pages: EditedPdfPage[] = $state([]);
	let savedFile = $state('');
</script>

<h1>PDF Editor</h1>
<p>
	Svelte 5 port of the Extend UI pdf-editor (document-level edits: rotate, delete, reorder,
	export). Rendering runs on the client with PDF.js; export runs on pdf-lib.
</p>

<h2>Fixture document</h2>
<PdfEditor
	src="/fixtures/sample.pdf"
	fileName="sample"
	isDark={isDark}
	onIsDarkChange={(value) => (isDark = value)}
	onPagesChange={(next) => (pages = next)}
	onSave={(result) => (savedFile = result.fileName)}
/>

<p data-testid="pdf-editor-docs-state">
	Edited pages: {pages.length === 0 ? 'none yet' : pages.map((page) => `#${page.sourcePage}@${page.rotation}°`).join(', ')}
	{#if savedFile}
		<span data-testid="pdf-editor-docs-saved">Last export: {savedFile}</span>
	{/if}
</p>

<p><a href="/">Back to all components</a></p>

<style>
	h2 {
		margin-top: 2rem;
	}
</style>
