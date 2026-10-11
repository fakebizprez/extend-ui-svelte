<!-- MIT License — Svelte 5 port of Extend UI xlsx-editor. Upstream: extend-hq/ui (MIT). -->
<script lang="ts">
	import { docsTheme } from '../_shell/theme.svelte.js';
	import XlsxEditor from '#lib/components/xlsx-editor/XlsxEditor.svelte';

	const FIXTURE_URL = '/fixtures/sample.xlsx';

	let isDark = $derived(docsTheme.isDark);
	let darkPreview = $derived(docsTheme.isDark);
	let emptyDark = $derived(docsTheme.isDark);
	let lastChange = $state('');
	let lastExport = $state('');
	// Each reload hands the editor a new src, so it starts over like a new file.
	let reloads = $state(0);
	const fixtureSrc = $derived(reloads ? `${FIXTURE_URL}?reload=${reloads}` : FIXTURE_URL);
</script>

<h1>XLSX Editor</h1>
<p>
	Svelte 5 port of the Extend UI xlsx-editor. Double-click a cell to edit it, type
	<code>=SUM(C2:C6)</code> for a local formula, style the selection, then export back to
	<code>.xlsx</code>.
</p>

<h2>Fixture workbook</h2>
<button type="button" data-testid="reload-workbook" onclick={() => (reloads += 1)}>
	Reload file (drops edits and styles)
</button>
<XlsxEditor
	src={fixtureSrc}
	fileName="sample.xlsx"
	isDark={isDark}
	onIsDarkChange={(value) => (isDark = value)}
	onCellChange={(change) =>
		(lastChange = `${change.sheet} row ${change.row + 1}, col ${change.col + 1} → ${String(change.value)}`)}
	onExport={(_bytes, fileName) => (lastExport = fileName)}
/>
<p data-testid="last-change">Last edit: {lastChange || 'none yet'}</p>
<p data-testid="last-export">Last export: {lastExport || 'none yet'}</p>

<h2>Compact workbook</h2>
<XlsxEditor
	src={FIXTURE_URL}
	fileName="sample.xlsx"
	height={320}
	isDark={darkPreview}
	onIsDarkChange={(value) => (darkPreview = value)}
/>

<h2>Empty state</h2>
<XlsxEditor isDark={emptyDark} onIsDarkChange={(value) => (emptyDark = value)} />

<h2>Differences from upstream</h2>
<p>Also exported as <code>XlsxEditorPreview</code>, the upstream name.</p>
<ul data-testid="differences">
	<li>
		Formulas are kept from the file and shown in the formula bar; each shows the file's saved
		value until it or one of its inputs is edited. Then SUM, AVERAGE, MIN, MAX, COUNT, PRODUCT,
		TRUE/FALSE, and arithmetic over same-sheet references recalculate locally with Excel's
		argument rules; other formulas (cross-sheet references, other functions, comparisons)
		keep the saved value and do not recalculate.
	</li>
	<li>
		Styling is limited to bold, horizontal alignment, and fill, and is not written on export
		(the community SheetJS writer drops styles). Values, formulas, and cell addresses are kept.
	</li>
	<li>
		Added props: <code>data</code>, <code>showToolbar</code>, <code>rowHeight</code>,
		<code>height</code>, <code>overscan</code>, <code>onCellChange</code>,
		<code>onExport</code>, plus an Export .xlsx button.
	</li>
	<li>
		The dark-mode control is a toolbar switch instead of a workbook actions menu item. It only
		calls <code>onIsDarkChange</code>.
	</li>
	<li>
		Not ported: italic, underline, strikethrough, font family and size, text color, borders,
		number formats, merge cells, wrap text, vertical alignment, undo/redo, add/remove sheet,
		cell formatting from the file, frozen panes, column resize, zoom, the upload menu, and
		read-only mode for files over 5 MB.
	</li>
	<li>
		Exports: <code>XlsxEditorSurface</code> (a react-xlsx context surface) is not ported;
		<code>XlsxEditor</code> is self-contained. Sheet tabs reuse the viewer's
		<code>WorkbookSheetTabs</code>, as upstream does.
	</li>
	<li>
		Keyboard follows upstream: the grid is one Tab stop; the arrows, Ctrl/Cmd+arrows, Home/End,
		PageUp/PageDown, Tab/Shift+Tab, and Enter/Shift+Enter move the active cell; typing or F2
		edits; Delete or Backspace clears. In the cell editor Enter commits and stays, Escape
		cancels, and the arrows commit and move. Not ported: range selection (Shift+arrows move
		instead of extending), undo/redo, copy/paste, and the column sort menu (upstream
		<code>WorkbookTableHeaderMenu</code>).
	</li>
</ul>

<p><a href="/">Back to overview</a></p>

<style>
	h2 {
		margin-top: 2rem;
	}
</style>
