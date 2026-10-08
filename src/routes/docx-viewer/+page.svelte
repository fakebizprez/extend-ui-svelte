<!-- MIT License — Svelte 5 port of Extend UI docx-viewer. Upstream: extend-hq/ui (MIT). -->
<script lang="ts">
	import DocxViewer from '#lib/components/docx-viewer/DocxViewer.svelte';

	let isDark = $state(false);
</script>

<h1>DOCX Viewer</h1>
<p>
	Svelte 5 port of the Extend UI docx-viewer. Rendering runs on the client through the docx
	engine wrapper (docx-preview); the thumbnail sidebar is virtualized.
</p>

<DocxViewer
	src="/fixtures/sample.docx"
	fileName="sample.docx"
	isDark={isDark}
	onIsDarkChange={(value) => (isDark = value)}
/>

<p><a href="/">Back to all components</a></p>
