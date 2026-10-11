<!-- MIT License — Svelte 5 port of Extend UI xlsx-viewer. Upstream: extend-hq/ui (MIT). -->
<script lang="ts">
	import { docsTheme } from '../_shell/theme.svelte.js';
	import XlsxViewer from '#lib/components/xlsx-viewer/XlsxViewer.svelte';

	const FIXTURE_URL = '/fixtures/sample.xlsx';

	let isDark = $derived(docsTheme.isDark);
	let darkPreview = $derived(docsTheme.isDark);
	let emptyDark = $derived(docsTheme.isDark);
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

<h2>Compact workbook</h2>
<XlsxViewer
	src={FIXTURE_URL}
	fileName="sample.xlsx"
	height={320}
	isDark={darkPreview}
	onIsDarkChange={(value) => (darkPreview = value)}
/>

<h2>Empty state</h2>
<XlsxViewer isDark={emptyDark} onIsDarkChange={(value) => (emptyDark = value)} />

<h2>Differences from upstream</h2>
<p>Also exported as <code>XlsxViewerPreview</code>, the upstream name.</p>
<ul data-testid="differences">
	<li>
		The grid is a virtualized native grid over SheetJS values, not
		<code>@extend-ai/react-xlsx</code> (React-only). Like upstream it shows column letters and
		row numbers from A1, with row 1 as data and blank rows kept.
	</li>
	<li>
		Added props: <code>data</code> (workbook bytes), <code>rowHeight</code>,
		<code>height</code>, <code>overscan</code>. The toolbar shows a row count.
	</li>
	<li>
		The dark-mode control is a toolbar switch instead of an item in the workbook actions menu.
		It only calls <code>onIsDarkChange</code>; the parent owns <code>isDark</code>.
	</li>
	<li>
		Not ported: cell formatting (fonts, fills, borders, number formats, merged cells), frozen
		panes, column resize, zoom, search, sheet thumbnails, and the upload/download menu
		(<code>showDownload</code>, <code>showUpload</code>, <code>toolbarActions</code>).
	</li>
	<li>
		Exports: <code>WorkbookSheetTabs</code> is ported and shared with the editor. It takes
		<code>sheets</code>, <code>activeSheetIndex</code>, and
		<code>onActiveSheetIndexChange</code> instead of <code>workbookIdentity</code> plus the
		react-xlsx context, and has no hover thumbnails. Not ported:
		<code>renderXlsxScroller</code> (a react-xlsx scroll-area helper),
		<code>WorkbookTableHeaderMenu</code> (the column sort menu; the port has no sorting), and
		<code>XlsxWorkbookSurface</code> (a context surface; <code>XlsxViewer</code> is
		self-contained).
	</li>
	<li>
		Like upstream's read-only grid, cells can be selected and the grid (one Tab stop) navigates
		with the arrows, Ctrl/Cmd+arrows, Home/End, PageUp/PageDown, Tab, and Enter. Not ported:
		range selection (Shift+arrows move instead of extending) and copy.
	</li>
</ul>

<p><a href="/">Back to overview</a></p>

<style>
	h2 {
		margin-top: 2rem;
	}
</style>
