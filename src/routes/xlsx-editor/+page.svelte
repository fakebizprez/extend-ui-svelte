<!-- MIT License — Svelte 5 port of Extend UI xlsx-editor. Upstream: extend-hq/ui (MIT). -->
<script lang="ts">
	import XlsxEditor from '#lib/components/xlsx-editor/XlsxEditor.svelte';

	const FIXTURE_URL = '/fixtures/sample.xlsx';

	let isDark = $state(false);
	let darkPreview = $state(true);
	let lastChange = $state('');
	let lastExport = $state('');
</script>

<h1>XLSX Editor</h1>
<p>
	Svelte 5 port of the Extend UI xlsx-editor. Double-click a cell to edit it, type
	<code>=SUM(C2:C6)</code> for a local formula, style the selection, then export back to
	<code>.xlsx</code>.
</p>

<h2>Fixture workbook</h2>
<XlsxEditor
	src={FIXTURE_URL}
	fileName="sample.xlsx"
	isDark={isDark}
	onIsDarkChange={(value) => (isDark = value)}
	onCellChange={(change) =>
		(lastChange = `${change.sheet} row ${change.row + 1}, col ${change.col + 1} → ${String(change.value)}`)}
	onExport={(_bytes, fileName) => (lastExport = fileName)}
/>
<p data-testid="last-change">Last edit: {lastChange || 'none yet'}</p>
<p data-testid="last-export">Last export: {lastExport || 'none yet'}</p>

<h2>Dark mode</h2>
<XlsxEditor
	src={FIXTURE_URL}
	fileName="sample.xlsx"
	height={320}
	isDark={darkPreview}
	onIsDarkChange={(value) => (darkPreview = value)}
/>

<h2>Empty state</h2>
<XlsxEditor />

<p><a href="/">Back to all components</a></p>

<style>
	h2 {
		margin-top: 2rem;
	}
</style>
