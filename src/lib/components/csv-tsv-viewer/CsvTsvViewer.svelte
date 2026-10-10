<!--
	MIT License — Svelte 5 port of Extend UI csv-viewer. Upstream: extend-hq/ui (MIT).
	Deliberate changes vs the React CsvViewer ({ className, data, search }):
	- Dark mode is parent-controlled (isDark + onIsDarkChange) per project contract;
	  upstream reads the .dark class from the document.
	- The grid is a virtualized native table with local windowing (no shared
	  virtual list exists yet) instead of glide-data-grid.
	- search={true} shows an inline row filter with a match count; upstream opens
	  a find-next search popover over grid cells.
	- Zoom, upload, and download actions are out of scope for this port.
-->
<script lang="ts">
	import { parseDelimitedText } from './parse.js';
	import type { ParsedTable } from './parse.js';

	interface Props {
		/** Raw CSV/TSV text. Parsed with papaparse (delimiter auto-detected). */
		data?: string;
		/** Show the search filter input. */
		search?: boolean;
		/** Explicit delimiter (e.g. "\t"). Empty means auto-detect. */
		delimiter?: string;
		/** Parent-controlled dark mode flag. */
		isDark?: boolean;
		/** Called when the user toggles dark mode. */
		onIsDarkChange?: (isDark: boolean) => void;
		/** Fixed row height in px; required for windowing math. */
		rowHeight?: number;
		/** Viewport height in px. */
		height?: number;
		/** Extra rows rendered above/below the visible window. */
		overscan?: number;
		class?: string;
	}

	let {
		data = '',
		search = false,
		delimiter = '',
		isDark = false,
		onIsDarkChange,
		rowHeight = 34,
		height = 560,
		overscan = 5,
		class: className = ''
	}: Props = $props();

	// Raw state: parsed tables can be huge and need no deep reactivity.
	let parsed: ParsedTable = $state.raw({ headers: [], rows: [], error: null });
	let parsing = $state(false);
	let query = $state('');
	let scrollTop = $state(0);
	let viewportHeight = $state(0);
	let viewport: HTMLDivElement | null = $state(null);

	// Client-only parsing: $effect never runs on the server, and papaparse is
	// loaded through a dynamic import inside parseDelimitedText.
	$effect(() => {
		const text = data;
		const delim = delimiter;
		if (!text.trim()) {
			parsed = { headers: [], rows: [], error: null };
			parsing = false;
			return;
		}
		let cancelled = false;
		parsing = true;
		parseDelimitedText(text, delim).then(
			(result) => {
				if (cancelled) return;
				parsed = result;
				parsing = false;
			},
			(failure: unknown) => {
				if (cancelled) return;
				parsed = {
					headers: [],
					rows: [],
					error: failure instanceof Error ? failure.message : 'Could not parse CSV file.'
				};
				parsing = false;
			}
		);
		return () => {
			cancelled = true;
		};
	});

	// Keep the window valid when the input or filter changes.
	$effect(() => {
		void data;
		void query;
		scrollTop = 0;
		if (viewport) viewport.scrollTop = 0;
	});

	$effect(() => {
		const element = viewport;
		if (!element) return;
		const measure = () => {
			viewportHeight = element.clientHeight;
		};
		measure();
		if (typeof ResizeObserver === 'undefined') return;
		const observer = new ResizeObserver(measure);
		observer.observe(element);
		return () => observer.disconnect();
	});

	const filteredRows = $derived.by(() => {
		const q = query.trim().toLowerCase();
		if (!q) return parsed.rows;
		return parsed.rows.filter((row) => row.some((cell) => cell.toLowerCase().includes(q)));
	});

	// Falls back to the height prop when layout is unmeasurable (SSR, jsdom).
	const effectiveViewportHeight = $derived(viewportHeight > 0 ? viewportHeight : height);
	const startIndex = $derived.by(() => {
		const raw = Math.floor(scrollTop / rowHeight) - overscan;
		return Math.min(Math.max(0, raw), Math.max(0, filteredRows.length - 1));
	});
	const visibleCount = $derived(Math.ceil(effectiveViewportHeight / rowHeight) + overscan * 2);
	const endIndex = $derived(Math.min(filteredRows.length, startIndex + visibleCount));
	const visibleRows = $derived(filteredRows.slice(startIndex, endIndex));
	const topPad = $derived(startIndex * rowHeight);
	const bottomPad = $derived((filteredRows.length - endIndex) * rowHeight);
	const columnCount = $derived(parsed.headers.length + 1);
	const rowCountLabel = $derived(
		query.trim() ? `${filteredRows.length} of ${parsed.rows.length} rows` : `${parsed.rows.length} rows`
	);

	function handleScroll(event: Event) {
		scrollTop = (event.currentTarget as HTMLDivElement).scrollTop;
	}
</script>

<div
	class={`csv-tsv-viewer${isDark ? ' dark' : ''}${className ? ` ${className}` : ''}`}
	data-dark={String(isDark)}
	data-testid="csv-tsv-viewer"
>
	<div class="csv-toolbar">
		{#if search}
			<input
				type="search"
				class="csv-search"
				aria-label="Search table"
				placeholder="Search…"
				disabled={parsing || parsed.rows.length === 0}
				bind:value={query}
			/>
		{/if}
		<span class="csv-count" data-testid="row-count">{rowCountLabel}</span>
		<button
			type="button"
			class="csv-theme-toggle"
			role="switch"
			aria-checked={String(isDark)}
			aria-label="Toggle dark mode"
			onclick={() => onIsDarkChange?.(!isDark)}
		>
			{isDark ? 'Light' : 'Dark'}
		</button>
	</div>

	{#if parsing}
		<div class="csv-state" role="status">Parsing…</div>
	{:else if parsed.error}
		<div class="csv-state csv-error" role="alert">{parsed.error}</div>
	{:else if parsed.rows.length === 0}
		<div class="csv-state">
			<p class="csv-state-title">No data to preview</p>
			<p class="csv-state-hint">Pass delimited text with the data prop.</p>
		</div>
	{:else if search && query.trim() && filteredRows.length === 0}
		<div class="csv-state">
			<p class="csv-state-title">No rows match the current search.</p>
		</div>
	{:else}
		<div
			class="csv-viewport"
			data-testid="csv-viewport"
			style={`height: ${height}px;`}
			bind:this={viewport}
			onscroll={handleScroll}
		>
			<table class="csv-table">
				<thead>
					<tr>
						<th scope="col" class="csv-rownum" aria-label="Row number">#</th>
						{#each parsed.headers as header}
							<th scope="col">{header}</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#if topPad > 0}
						<tr class="csv-spacer" aria-hidden="true">
							<td colspan={columnCount} style={`height: ${topPad}px; padding: 0; border: 0;`}></td>
						</tr>
					{/if}
					{#each visibleRows as row, i (startIndex + i)}
						<tr data-row-index={startIndex + i} style={`height: ${rowHeight}px;`}>
							<th scope="row" class="csv-rownum">{startIndex + i + 1}</th>
							{#each row as cell, j (j)}
								<td>{cell}</td>
							{/each}
						</tr>
					{/each}
					{#if bottomPad > 0}
						<tr class="csv-spacer" aria-hidden="true">
							<td colspan={columnCount} style={`height: ${bottomPad}px; padding: 0; border: 0;`}></td>
						</tr>
					{/if}
				</tbody>
			</table>
		</div>
	{/if}
</div>

<style>
	.csv-tsv-viewer {
		--csv-bg: #ffffff;
		--csv-fg: #171717;
		--csv-muted: #525252;
		--csv-border: #e5e5e5;
		--csv-header-bg: #fafafa;
		--csv-row-alt: #fafafa;
		display: flex;
		flex-direction: column;
		width: 100%;
		overflow: hidden;
		background: var(--csv-bg);
		color: var(--csv-fg);
		border: 1px solid var(--csv-border);
		border-radius: 0.75rem;
		font-family:
			system-ui,
			-apple-system,
			'Segoe UI',
			sans-serif;
		font-size: 13px;
	}

	.csv-tsv-viewer.dark {
		--csv-bg: #0a0a0a;
		--csv-fg: #e5e5e5;
		--csv-muted: #a3a3a3;
		--csv-border: #262626;
		--csv-header-bg: #171717;
		--csv-row-alt: #111111;
	}

	.csv-toolbar {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		border-bottom: 1px solid var(--csv-border);
	}

	.csv-search {
		flex: 1;
		min-width: 0;
		padding: 0.375rem 0.625rem;
		border: 1px solid var(--csv-border);
		border-radius: 0.375rem;
		background: var(--csv-bg);
		color: var(--csv-fg);
		font: inherit;
	}

	.csv-count {
		margin-left: auto;
		white-space: nowrap;
		color: var(--csv-muted);
		font-size: 12px;
	}

	.csv-theme-toggle {
		flex: none;
		padding: 0.375rem 0.625rem;
		border: 1px solid var(--csv-border);
		border-radius: 0.375rem;
		background: transparent;
		color: var(--csv-fg);
		font: inherit;
		cursor: pointer;
	}

	.csv-state {
		display: grid;
		place-items: center;
		align-content: center;
		gap: 0.25rem;
		min-height: 200px;
		padding: 1rem;
		text-align: center;
	}

	.csv-state-title {
		margin: 0;
		font-weight: 600;
	}

	.csv-state-hint {
		margin: 0;
		color: var(--csv-muted);
	}

	.csv-error {
		color: #b91c1c;
	}

	.dark .csv-error {
		color: #f87171;
	}

	.csv-viewport {
		overflow: auto;
	}

	.csv-table {
		width: 100%;
		border-collapse: collapse;
		table-layout: fixed;
	}

	.csv-table th,
	.csv-table td {
		padding: 0 0.5rem;
		border-bottom: 1px solid var(--csv-border);
		text-align: left;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.csv-table thead th {
		position: sticky;
		top: 0;
		z-index: 1;
		height: 36px;
		background: var(--csv-header-bg);
		font-weight: 600;
	}

	.csv-table tbody tr:nth-child(even of tr[data-row-index]) {
		background: var(--csv-row-alt);
	}

	.csv-rownum {
		width: 3rem;
		color: var(--csv-muted);
		font-weight: 400;
	}
</style>
