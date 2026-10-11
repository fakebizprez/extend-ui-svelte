<!--
	MIT License — Svelte 5 port of Extend UI csv-viewer. Upstream: extend-hq/ui (MIT).
	Exported as CsvTsvViewer and under the upstream name CsvViewer.
	search={true} opens a find popover like upstream: next/previous (Enter /
	Shift+Enter) step through matching cells, the active match's cell is
	selected and scrolled into view, and the popover closes on an outside
	press, on Escape, or when the data changes. Differences from upstream
	(keep in sync with the docs page, src/routes/csv-tsv-viewer/+page.svelte):
	- Dark mode is parent-controlled (isDark; onIsDarkChange is accepted but
	  never called); upstream reads the .dark class from the document.
	- The grid is a native <table> windowed locally instead of glide-data-grid.
	  The shared VirtualList renders div rows, which a table body cannot hold.
	- Added props: delimiter, isDark, onIsDarkChange, rowHeight, height,
	  overscan; the toolbar shows a row count.
	- Not ported: zoom, upload, download, cell selection, and column resize.
-->
<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { parseDelimitedText } from './parse.js';
	import type { ParsedTable } from './parse.js';

	const SEARCH_DEBOUNCE_MS = 300;

	/** Zero-based column index to spreadsheet letters (0 is A, 26 is AA). */
	function columnIndexToLetter(index: number): string {
		let letters = '';
		for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
			letters = String.fromCharCode(65 + ((n - 1) % 26)) + letters;
		}
		return letters;
	}

	interface SearchResult {
		row: number;
		col: number;
	}

	interface Props {
		/** Raw CSV/TSV text. Parsed with papaparse (delimiter auto-detected). */
		data?: string;
		/** Show the find popover (matches, next/previous, scroll to match). */
		search?: boolean;
		/** Explicit delimiter (e.g. "\t"). Empty means auto-detect. */
		delimiter?: string;
		/** Parent-controlled dark mode flag. */
		isDark?: boolean;
		/** Accepted for contract parity; never called (no in-component theme control). */
		onIsDarkChange?: (isDark: boolean) => void;
		/** Fixed row height in px; required for windowing math. */
		rowHeight?: number;
		/** Viewport height in px. */
		height?: number;
		/** Extra rows rendered above/below the visible window. */
		overscan?: number;
		class?: string;
		/** Alias of `class`, matching the React prop name. Both are applied. */
		className?: string;
	}

	let {
		data = '',
		search = false,
		delimiter = '',
		isDark = false,
		rowHeight = 34,
		height = 560,
		overscan = 5,
		class: classProp = '',
		className = ''
	}: Props = $props();

	// Raw state: parsed tables can be huge and need no deep reactivity.
	let parsed: ParsedTable = $state.raw({ headers: [], rows: [], error: null });
	let parsing = $state(false);
	let searchOpen = $state(false);
	let searchTrigger: HTMLButtonElement | null = $state(null);
	let searchPanel: HTMLDivElement | null = $state(null);
	let searchDraft = $state('');
	let searchQuery = $state('');
	let searching = $state(false);
	let results = $state.raw<SearchResult[]>([]);
	let activeResultIndex = $state(0);
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

	// New input resets the scroll position and any search, like upstream's
	// per-data search popover.
	$effect(() => {
		void data;
		untrack(() => {
			scrollTop = 0;
			if (viewport) viewport.scrollTop = 0;
			searchOpen = false;
			clearSearch();
		});
	});

	// Close on a press outside the popover, as upstream's Radix popover does.
	$effect(() => {
		if (!searchOpen) return;
		const close = (event: PointerEvent) => {
			const target = event.target as Node | null;
			if (target && (searchPanel?.contains(target) || searchTrigger?.contains(target))) return;
			searchOpen = false;
		};
		document.addEventListener('pointerdown', close);
		return () => document.removeEventListener('pointerdown', close);
	});

	function runSearch(raw: string): void {
		const q = raw.trim().toLowerCase();
		searchQuery = q;
		activeResultIndex = 0;
		searching = false;
		if (!q) {
			results = [];
			return;
		}
		// ponytail: one synchronous scan; upstream yields every 500 rows. Batch
		// it if multi-hundred-thousand-row files stall typing.
		const next: SearchResult[] = [];
		parsed.rows.forEach((row, rowIndex) => {
			row.forEach((cell, col) => {
				if (cell.toLowerCase().includes(q)) next.push({ row: rowIndex, col });
			});
		});
		results = next;
	}

	// Debounced search while typing, as upstream does.
	$effect(() => {
		const draft = searchDraft;
		if (!draft.trim()) return;
		const timer = setTimeout(() => runSearch(draft), SEARCH_DEBOUNCE_MS);
		return () => clearTimeout(timer);
	});

	function handleSearchInput(value: string): void {
		searchDraft = value;
		if (value.trim()) searching = true;
		else runSearch('');
	}

	function clearSearch(): void {
		searchDraft = '';
		searchQuery = '';
		results = [];
		activeResultIndex = 0;
		searching = false;
	}

	function goToRelativeResult(direction: 1 | -1): void {
		if (results.length === 0) return;
		activeResultIndex = (activeResultIndex + direction + results.length) % results.length;
	}

	const activeResult = $derived(results[activeResultIndex] ?? null);
	const resultLabel = $derived(
		searching
			? 'Searching'
			: !searchQuery
				? 'No search'
				: results.length
					? `${activeResultIndex + 1} / ${results.length}`
					: 'No results'
	);

	// Scroll the active match to the centre of the viewport, then bring its
	// column into view.
	$effect(() => {
		const result = activeResult;
		const element = viewport;
		if (!result || !element) return;
		const target = Math.max(
			0,
			result.row * rowHeight - (effectiveViewportHeight - rowHeight) / 2
		);
		element.scrollTop = target;
		scrollTop = target;
		void tick().then(() => {
			element
				.querySelector('td[data-search-active]')
				?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
		});
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


	// Falls back to the height prop when layout is unmeasurable (SSR, jsdom).
	const effectiveViewportHeight = $derived(viewportHeight > 0 ? viewportHeight : height);
	const startIndex = $derived.by(() => {
		const raw = Math.floor(scrollTop / rowHeight) - overscan;
		return Math.min(Math.max(0, raw), Math.max(0, parsed.rows.length - 1));
	});
	const visibleCount = $derived(Math.ceil(effectiveViewportHeight / rowHeight) + overscan * 2);
	const endIndex = $derived(Math.min(parsed.rows.length, startIndex + visibleCount));
	const visibleRows = $derived(parsed.rows.slice(startIndex, endIndex));
	const topPad = $derived(startIndex * rowHeight);
	const bottomPad = $derived((parsed.rows.length - endIndex) * rowHeight);
	const columnCount = $derived(parsed.headers.length + 1);
	const rowCountLabel = $derived(`${parsed.rows.length} ${parsed.rows.length === 1 ? 'row' : 'rows'}`);
	const searchDisabled = $derived(parsing || Boolean(parsed.error) || parsed.rows.length === 0);

	function handleScroll(event: Event) {
		scrollTop = (event.currentTarget as HTMLDivElement).scrollTop;
	}
</script>

<div
	class={['csv-tsv-viewer', isDark ? 'dark' : '', classProp, className].filter(Boolean).join(' ')}
	data-dark={String(isDark)}
	data-testid="csv-tsv-viewer"
>
	<div class="csv-toolbar">
		<span class="csv-count" data-testid="row-count">{rowCountLabel}</span>
		{#if search}
			<button
				type="button"
				class="csv-tool"
				aria-label="Search CSV"
				title="Search CSV"
				aria-expanded={searchOpen}
				disabled={searchDisabled}
				bind:this={searchTrigger}
				onclick={() => (searchOpen = !searchOpen)}
			>
				<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
					<circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2" />
					<path d="m20 20-3.5-3.5" fill="none" stroke="currentColor" stroke-width="2" />
				</svg>
			</button>
		{/if}
		{#if search && searchOpen}
			<div
				class="csv-search-panel"
				role="dialog"
				aria-label="Search CSV"
				tabindex="-1"
				bind:this={searchPanel}
				onkeydown={(event) => {
					if (event.key !== 'Escape') return;
					// Like upstream's popover, Escape hands focus back to the trigger.
					searchOpen = false;
					searchTrigger?.focus();
				}}
			>
				<!-- Focus on open, as upstream's popover does. -->
				<input
					type="search"
					class="csv-search"
					aria-label="Search CSV"
					placeholder="Search CSV"
					{@attach (input) => input.focus()}
					value={searchDraft}
					oninput={(event) => handleSearchInput(event.currentTarget.value)}
					onkeydown={(event) => {
						if (event.key !== 'Enter') return;
						event.preventDefault();
						if (results.length) goToRelativeResult(event.shiftKey ? -1 : 1);
						else if (searchDraft.trim()) runSearch(searchDraft);
					}}
				/>
				<div class="csv-search-status">
					<div class="csv-search-text">
						<div data-testid="search-result-label">{resultLabel}</div>
						{#if activeResult}
							<div data-testid="search-result-address">
								{parsed.headers[activeResult.col] ?? `Column ${activeResult.col + 1}`}!{columnIndexToLetter(
									activeResult.col
								)}{activeResult.row + 1}
							</div>
						{/if}
					</div>
					<button
						type="button"
						class="csv-tool"
						aria-label="Previous result"
						disabled={searching || results.length === 0}
						onclick={() => goToRelativeResult(-1)}>‹</button
					>
					<button
						type="button"
						class="csv-tool"
						aria-label="Next result"
						disabled={searching || results.length === 0}
						onclick={() => goToRelativeResult(1)}>›</button
					>
				</div>
				<button type="button" class="csv-tool csv-clear" onclick={clearSearch}>Clear</button>
			</div>
		{/if}
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
{:else}
		<!-- svelte-ignore a11y_no_noninteractive_tabindex (Keyboard users need to focus this viewport to scroll the table.) -->
		<div
			class="csv-viewport"
			data-testid="csv-viewport"
			role="group"
			aria-label="CSV table"
			tabindex="0"
			style={`height: ${height}px;`}
			bind:this={viewport}
			onscroll={handleScroll}
		>
			<table class="csv-table">
				<thead>
					<tr>
						<th scope="col" class="csv-rownum" aria-label="Row number">#</th>
						{#each parsed.headers as header, i (i)}
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
								<!-- Like upstream, only the active result's cell is selected. -->
								{@const isActive =
									activeResult !== null &&
									activeResult.row === startIndex + i &&
									activeResult.col === j}
								<td class:active-match={isActive} data-search-active={isActive ? '' : undefined}>
									{cell}
								</td>
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
		--csv-accent: #2563eb;
		--csv-match-active: #dbeafe;
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
		--csv-accent: #60a5fa;
		--csv-match-active: #1d4ed826;
	}

	.csv-toolbar {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		border-bottom: 1px solid var(--csv-border);
	}

	.csv-toolbar {
		position: relative;
		justify-content: flex-end;
	}

	.csv-tool {
		display: inline-grid;
		place-items: center;
		min-width: 28px;
		height: 28px;
		padding: 0 0.375rem;
		border: 1px solid var(--csv-border);
		border-radius: 0.375rem;
		background: transparent;
		color: var(--csv-fg);
		font: inherit;
		cursor: pointer;
	}

	.csv-tool:disabled {
		opacity: 0.5;
		cursor: default;
	}

	.csv-search-panel {
		position: absolute;
		top: calc(100% + 4px);
		right: 0.75rem;
		z-index: 3;
		display: grid;
		gap: 0.75rem;
		width: min(18rem, calc(100% - 1.5rem));
		padding: 0.75rem;
		border: 1px solid var(--csv-border);
		border-radius: 0.5rem;
		background: var(--csv-bg);
		box-shadow: 0 8px 24px rgb(0 0 0 / 0.12);
	}

	.csv-search-status {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.csv-search-text {
		flex: 1;
		min-width: 0;
		color: var(--csv-muted);
		font-size: 12px;
	}

	.csv-search-text > div {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.csv-clear {
		justify-self: end;
	}

	.csv-table td.active-match {
		background: var(--csv-match-active);
		box-shadow: inset 0 0 0 2px var(--csv-accent);
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

	.csv-viewport:focus-visible {
		outline: 2px solid var(--csv-accent);
		outline-offset: -2px;
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
