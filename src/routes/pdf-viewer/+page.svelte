<!-- MIT License — Svelte 5 port of Extend UI pdf-viewer. Upstream: extend-hq/ui (MIT). -->
<script lang="ts">
	import { PdfViewer } from '#lib/components/pdf-viewer/index.js';

	let isDark = $state(false);
	let darkPreview = $state(true);
</script>

<h1>PDF Viewer</h1>
<p>Svelte 5 port of the Extend UI pdf-viewer. Rendering runs on the client with PDF.js.</p>

<h2>Fixture document</h2>
<PdfViewer
	src="/fixtures/sample.pdf"
	fileName="sample"
	isDark={isDark}
	onIsDarkChange={(value) => (isDark = value)}
/>

<h2>Dark mode with rotated start</h2>
<PdfViewer
	src="/fixtures/sample.pdf"
	fileName="sample"
	defaultZoom={1.25}
	isDark={darkPreview}
	onIsDarkChange={(value) => (darkPreview = value)}
/>

<h2>Empty source</h2>
<PdfViewer />

<p><a href="/">Back to all components</a></p>

<style>
	h2 {
		margin-top: 2rem;
	}
</style>
