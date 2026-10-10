<!-- MIT License — Svelte 5 port of Extend UI xlsx-viewer. Upstream: extend-hq/ui (MIT). -->
<script lang="ts">
	import XlsxViewer from '#lib/components/xlsx-viewer/XlsxViewer.svelte';

	const FIXTURE_URL = '/fixtures/sample.xlsx';

	let isDark = $state(false);
	let darkPreview = $state(true);
</script>

<h1>XLSX Viewer</h1>
<p>Svelte 5 port of the Extend UI xlsx-viewer. Workbooks load on the client with SheetJS.</p>

<h2>Fixture workbook</h2>
<XlsxViewer
	src={FIXTURE_URL}
	fileName="sample.xlsx"
	isDark={isDark}
	onIsDarkChange={(value) => (isDark = value)}
/>

<h2>Dark mode</h2>
<XlsxViewer
	src={FIXTURE_URL}
	fileName="sample.xlsx"
	height={320}
	isDark={darkPreview}
	onIsDarkChange={(value) => (darkPreview = value)}
/>

<h2>Empty state</h2>
<XlsxViewer />

<p><a href="/">Back to all components</a></p>

<style>
	h2 {
		margin-top: 2rem;
	}
</style>
