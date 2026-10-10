<!-- MIT License — Svelte 5 port of Extend UI csv-viewer. Upstream: extend-hq/ui (MIT). -->
<script lang="ts">
	import CsvTsvViewer from '../../lib/components/csv-tsv-viewer/CsvTsvViewer.svelte';

	const SAMPLE_CSV = `Invoice,Customer,Status,Amount,Submitted
INV-1001,Northstar Supply,Approved,4280.50,2026-04-28
INV-1002,Bluebird Medical,Needs review,1190.00,2026-04-29
INV-1003,Aster Logistics,Approved,845.75,2026-04-30
INV-1004,Juniper Foods,Exception,3499.99,2026-05-01
INV-1005,Keystone Labs,Approved,920.10,2026-05-02
INV-1006,Monarch Studio,Processing,1510.45,2026-05-03
INV-1007,Orchard Bank,Approved,7820.00,2026-05-04
INV-1008,Riverstone Energy,Needs review,632.25,2026-05-05
INV-1009,Summit Health,Approved,2730.00,2026-05-06
INV-1010,Westhaven Legal,Processing,410.80,2026-05-07`;

	const SAMPLE_TSV = `Order\tItem\tQty\tWarehouse
A-9001\tResistor kit\t120\tReno
A-9002\tCapacitor set\t85\tAustin
A-9003\tBreadboard\t200\tReno
A-9004\tJumper wires\t340\tAustin`;

	// 2,000 rows: only the visible window renders, and search scrolls to matches.
	const LONG_CSV = [
		'Load,Lane,Pallets',
		...Array.from({ length: 2000 }, (_, i) => `L-${i + 1},Lane ${(i % 40) + 1},${(i % 9) + 1}`)
	].join('\n');

	let isDark = $state(false);
	let tsvDark = $state(true);
</script>

<h1>CSV/TSV Viewer</h1>
<p>Svelte 5 port of the Extend UI csv-viewer. Parsing runs on the client with papaparse.</p>

<h2>CSV with search</h2>
<p>
	Open the search button, type a value, then use next/previous (or Enter / Shift+Enter) to step
	through matches.
</p>
<!-- The theme toggle lives in the parent; the viewer only reflects isDark. -->
<button type="button" data-testid="page-dark-toggle" onclick={() => (isDark = !isDark)}>
	{isDark ? 'Use light mode' : 'Use dark mode'}
</button>
<CsvTsvViewer
	data={SAMPLE_CSV}
	search
	isDark={isDark}
	onIsDarkChange={(value) => (isDark = value)}
/>

<h2>TSV in dark mode</h2>
<CsvTsvViewer
	data={SAMPLE_TSV}
	search
	height={240}
	isDark={tsvDark}
	onIsDarkChange={(value) => (tsvDark = value)}
/>

<h2>Long CSV (2,000 rows)</h2>
<CsvTsvViewer data={LONG_CSV} search height={320} />

<h2>Empty input</h2>
<CsvTsvViewer data="" />

<h2>Differences from upstream</h2>
<p>Also exported as <code>CsvViewer</code>, the upstream name.</p>
<ul data-testid="differences">
	<li>
		Dark mode is controlled by the parent through <code>isDark</code>
		(<code>onIsDarkChange</code> is accepted but never called). Upstream reads the
		<code>.dark</code> class from the document.
	</li>
	<li>
		The grid is a native table windowed locally instead of glide-data-grid. Search works like
		upstream: a find popover that highlights matches, steps through them, and scrolls the
		active match into view.
	</li>
	<li>
		Added props: <code>delimiter</code>, <code>isDark</code>, <code>onIsDarkChange</code>,
		<code>rowHeight</code>, <code>height</code>, <code>overscan</code>. The toolbar shows a
		row count.
	</li>
	<li>Not ported: zoom, upload, download, cell selection, and column resize.</li>
</ul>

<p><a href="/">Back to all components</a></p>

<style>
	h2 {
		margin-top: 2rem;
	}
</style>
