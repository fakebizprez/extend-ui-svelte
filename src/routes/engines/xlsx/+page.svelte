<!-- MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT). -->
<script lang="ts">
	import { onMount } from 'svelte';

	interface SheetSummary {
		name: string;
		rowCount: number;
	}

	const FIXTURE_URL = '/fixtures/sample.xlsx';

	let status = $state<'loading' | 'ready' | 'error'>('loading');
	let sheets = $state<SheetSummary[]>([]);
	let error = $state('');

	onMount(async () => {
		try {
			// Client-only: the engine (and SheetJS inside it) loads via dynamic import.
			const engine = await import('#lib/engines/xlsx/index.js');
			const workbook = await engine.loadWorkbookFromUrl(FIXTURE_URL);
			const names = engine.listSheetNames(workbook);
			sheets = await Promise.all(
				names.map(async (name) => ({
					name,
					rowCount: await engine.getSheetRowCount(workbook, name)
				}))
			);
			status = 'ready';
		} catch (loadError) {
			error = loadError instanceof Error ? loadError.message : String(loadError);
			status = 'error';
		}
	});
</script>

<h1>XLSX Engine Harness</h1>
<p>Loads <code>{FIXTURE_URL}</code> through the xlsx engine wrapper.</p>

{#if status === 'loading'}
	<p>Loading workbook…</p>
{:else if status === 'error'}
	<p data-testid="load-error">Failed to load workbook: {error}</p>
{:else}
	<p data-testid="sheet-count">{sheets.length} sheets</p>
	<ul>
		{#each sheets as sheet (sheet.name)}
			<li data-testid="sheet-item">{sheet.name}: {sheet.rowCount} rows</li>
		{/each}
	</ul>
{/if}

<p><a href="/">Back to overview</a></p>
