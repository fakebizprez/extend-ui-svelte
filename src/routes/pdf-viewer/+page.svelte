<!-- MIT License — Svelte 5 port of Extend UI pdf-viewer. Upstream: extend-hq/ui (MIT). -->
<script lang="ts">
	import { PdfViewer } from '#lib/components/pdf-viewer/index.js';

	let darkPreview = $state(true);
</script>

<h1>PDF Viewer</h1>
<p>Svelte 5 port of the Extend UI pdf-viewer. Rendering runs on the client with PDF.js.</p>

<h2>Fixture document</h2>
<!-- Matches the upstream docs preview, which starts at 50%. -->
<PdfViewer src="/fixtures/sample.pdf" fileName="sample" defaultZoom={0.5} />

<h2>Dark mode, fit width</h2>
<p>
	Dark mode is controlled by the parent through <code>isDark</code> and
	<code>onIsDarkChange</code>; this switch lives on the page, outside the viewer.
</p>
<button
	type="button"
	role="switch"
	aria-checked={darkPreview}
	onclick={() => (darkPreview = !darkPreview)}
>
	Dark mode
</button>
<PdfViewer
	src="/fixtures/sample.pdf"
	fileName="sample"
	defaultZoom="fit-width"
	isDark={darkPreview}
	onIsDarkChange={(value) => (darkPreview = value)}
/>

<h2>Empty source</h2>
<PdfViewer />

<h2>Differences from upstream</h2>
<ul>
	<li>Renders with PDF.js through the shared engine instead of EmbedPDF; zoom modes use EmbedPDF's formulas.</li>
	<li>Dark mode is parent-controlled with <code>isDark</code> and <code>onIsDarkChange</code>; the viewer renders no dark toggle.</li>
	<li><code>renderPageOverlay</code> is the <code>pageOverlay</code> snippet and <code>toolbarActions</code> is a snippet.</li>
	<li><code>class</code> and <code>className</code> are both accepted.</li>
	<li>Extra props: <code>height</code>, <code>pageWidth</code>/<code>pageHeight</code> (fallback page size), <code>pageGap</code>, <code>overscan</code>.</li>
	<li>The toolbar adds previous/next page buttons and a plain page indicator (no inline page-number input); Download and Upload are buttons instead of a menu.</li>
	<li>Not ported yet: thumbnail sidebar and multi-page selection (rotate applies to the active page), text search, text selection and copy, tiling, page pointer callbacks, <code>resolveScrollAreaViewport</code>, and the imperative handle (<code>scrollToPage</code>, <code>scrollToPageArea</code>).</li>
</ul>

<p><a href="/">Back to all components</a></p>

<style>
	h2 {
		margin-top: 2rem;
	}
</style>
