<!--
	MIT License — Svelte 5 port of Extend UI xlsx-viewer. Upstream: extend-hq/ui (MIT).
	Exported as XlsxViewer and under the upstream name XlsxViewerPreview.
	Like upstream, the grid shows column letters and row numbers from A1, with
	row 1 as data and blank rows kept. Differences from upstream (keep in sync
	with the docs page, src/routes/xlsx-viewer/+page.svelte):
	- The grid is a virtualized native grid over SheetJS values instead of
	  @extend-ai/react-xlsx, which is React-only.
	- Added props: data (workbook bytes), rowHeight, height, overscan; the
	  toolbar shows a row count.
	- The dark-mode control is a toolbar switch, not an item in a workbook
	  actions menu; it only calls onIsDarkChange.
	- Not ported: cell formatting (fonts, fills, borders, number formats, merged
	  cells), frozen panes, column resize, zoom, search, sheet thumbnails, and
	  the upload/download menu (showDownload, showUpload, toolbarActions).
-->
<script lang="ts">
	import { VirtualList } from '#lib/virtual-list/index.js';
	import type { DarkModeProps } from '#lib/dark-mode.js';
	import type { WorkBook } from '#lib/engines/xlsx/index.js';

	type EngineModule = typeof import('#lib/engines/xlsx/index.js');

	/** Zero-based column index to spreadsheet letters (0 is A, 26 is AA). */
	function columnIndexToLetter(index: number): string {
		let letters = '';
		for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
			letters = String.fromCharCode(65 + ((n - 1) % 26)) + letters;
		}
		return letters;
	}

	interface Props extends DarkModeProps {
		/** Workbook URL. Loaded with fetch on the client. */
		src?: string;
		/** Workbook bytes. Takes precedence over src when both are given. */
		data?: ArrayBuffer | Uint8Array;
		/** Display name shown in the toolbar. Defaults to the src basename. */
		fileName?: string;
		/** Show the toolbar (file name, row count, theme toggle). */
		showToolbar?: boolean;
		/** Fixed row height in px; required for virtualization math. */
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
		src,
		data,
		fileName,
		isDark = false,
		onIsDarkChange,
		showToolbar = true,
		rowHeight = 34,
		height = 480,
		overscan = 5,
		class: classProp = '',
		className = ''
	}: Props = $props();

	type Status = 'empty' | 'loading' | 'ready' | 'error';

	let status = $state<Status>('empty');
	let errorMessage = $state('');
	let sheetNames = $state<string[]>([]);
	let activeSheetIndex = $state(0);
	// Raw state: parsed workbooks and row arrays can be huge and need no deep reactivity.
	let workbookCache = $state.raw<{ key: unknown; workbook: WorkBook } | null>(null);
	let rows = $state.raw<unknown[][]>([]);
	let loadingSheet = $state(false);

	const ROWNUM_WIDTH = 48;
	const COLUMN_WIDTH = 150;

	const activeSheetName = $derived(sheetNames[activeSheetIndex] ?? '');
	const columns = $derived(
		Array.from({ length: rows.reduce((max, row) => Math.max(max, row.length), 0) }, (_, index) =>
			columnIndexToLetter(index)
		)
	);
	const rootClass = $derived(
		['xlsx-viewer', isDark ? 'dark' : '', classProp, className].filter(Boolean).join(' ')
	);
	const gridTemplate = $derived(
		`${ROWNUM_WIDTH}px repeat(${Math.max(columns.length, 1)}, ${COLUMN_WIDTH}px)`
	);
	const gridMinWidth = $derived(ROWNUM_WIDTH + Math.max(columns.length, 1) * COLUMN_WIDTH);
	const displayName = $derived.by(() => {
		if (fileName?.trim()) return fileName;
		if (src) {
			const raw = (src.split('?')[0] ?? '').split('/').pop() || 'workbook.xlsx';
			try {
				return decodeURIComponent(raw);
			} catch {
				return raw;
			}
		}
		return 'workbook.xlsx';
	});
	const rowCountLabel = $derived(`${rows.length} ${rows.length === 1 ? 'row' : 'rows'}`);

	function formatCell(value: unknown): string {
		if (value === null || value === undefined) return '';
		if (typeof value === 'string') return value;
		// Excel shows booleans as TRUE/FALSE; error cells print their code.
		if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
		return String(value);
	}

	// Client-only loading: $effect never runs on the server, and the engine
	// (with SheetJS inside it) is loaded through a dynamic import.
	$effect(() => {
		const sourceKey: unknown = data ?? src ?? null;
		if (sourceKey === null || sourceKey === undefined) {
			workbookCache = null;
			sheetNames = [];
			activeSheetIndex = 0;
			rows = [];
			errorMessage = '';
			status = 'empty';
			return;
		}
		let cancelled = false;
		status = 'loading';
		errorMessage = '';
		(async () => {
			try {
				const engine: EngineModule = await import('#lib/engines/xlsx/index.js');
				if (cancelled) return;
				let workbook = workbookCache?.key === sourceKey ? workbookCache.workbook : null;
				if (!workbook) {
					workbook =
						data !== undefined && data !== null
							? await engine.loadWorkbookFromBytes(data)
							: await engine.loadWorkbookFromUrl(src as string);
					if (cancelled) return;
					workbookCache = { key: sourceKey, workbook };
				}
				const names = engine.listSheetNames(workbook);
				if (cancelled) return;
				sheetNames = names;
				activeSheetIndex = 0;
				status = 'ready';
			} catch (failure) {
				if (cancelled) return;
				sheetNames = [];
				rows = [];
				errorMessage =
					failure instanceof Error ? failure.message : 'Could not load workbook.';
				status = 'error';
			}
		})();
		return () => {
			cancelled = true;
		};
	});

	// Load the active sheet's rows whenever the workbook or tab changes.
	$effect(() => {
		const cached = workbookCache;
		const names = sheetNames;
		const index = activeSheetIndex;
		if (!cached || names.length === 0) return;
		const sheetName = names[Math.min(index, names.length - 1)] as string;
		let cancelled = false;
		loadingSheet = true;
		(async () => {
			try {
				const engine: EngineModule = await import('#lib/engines/xlsx/index.js');
				const next = await engine.sheetToGrid(cached.workbook, sheetName);
				if (cancelled) return;
				rows = next.values;
			} catch (failure) {
				if (cancelled) return;
				rows = [];
				errorMessage =
					failure instanceof Error ? failure.message : 'Could not load sheet.';
				status = 'error';
			} finally {
				if (!cancelled) loadingSheet = false;
			}
		})();
		return () => {
			cancelled = true;
		};
	});

	function selectSheet(index: number): void {
		activeSheetIndex = index;
	}
</script>

<div
	class={rootClass}
	data-dark={String(isDark)}
	data-testid="xlsx-viewer"
>
	{#if showToolbar}
		<div class="xlsx-toolbar">
			<span class="xlsx-name" data-testid="workbook-name">{displayName}</span>
			{#if status === 'ready'}
				<span class="xlsx-count" data-testid="row-count">{rowCountLabel}</span>
			{/if}
			<button
				type="button"
				class="xlsx-theme-toggle"
				role="switch"
				aria-checked={isDark}
				aria-label="Toggle dark mode"
				onclick={() => onIsDarkChange?.(!isDark)}
			>
				{isDark ? 'Light' : 'Dark'}
			</button>
		</div>
	{/if}

	{#if status === 'loading'}
		<div class="xlsx-state" role="status">Loading workbook…</div>
	{:else if status === 'error'}
		<div class="xlsx-state xlsx-error" role="alert">{errorMessage}</div>
	{:else if status === 'empty'}
		<div class="xlsx-state">
			<p class="xlsx-state-title">No workbook to preview</p>
			<p class="xlsx-state-hint">Pass a workbook URL with src or bytes with data.</p>
		</div>
	{:else if loadingSheet}
		<div class="xlsx-state" role="status">Loading sheet…</div>
	{:else if rows.length === 0}
		<div class="xlsx-state">
			<p class="xlsx-state-title">This sheet is empty.</p>
		</div>
		{#if sheetNames.length > 0}
			<div class="xlsx-tabs" role="tablist" aria-label="Sheets">
				{#each sheetNames as name, i (name)}
					<button
						type="button"
						role="tab"
						data-testid="sheet-tab"
						aria-selected={i === activeSheetIndex}
						class:active={i === activeSheetIndex}
						onclick={() => selectSheet(i)}
					>
						{name}
					</button>
				{/each}
			</div>
		{/if}
	{:else}
		<div class="xlsx-scroll">
			<div class="xlsx-grid" role="table" aria-label={activeSheetName} style={`min-width: ${gridMinWidth}px;`}>
				<div role="row" class="xlsx-header-row" style={`grid-template-columns: ${gridTemplate};`}>
					<div role="columnheader" class="xlsx-rownum" aria-label="Row numbers"></div>
					{#each columns as column (column)}
						<div role="columnheader" class="xlsx-header-cell">{column}</div>
					{/each}
				</div>
				{#key activeSheetName}
					<VirtualList items={rows} itemHeight={rowHeight} {height} {overscan}>
						{#snippet children(row, index)}
							<div
								role="row"
								class="xlsx-row"
								data-row-index={index}
								style={`grid-template-columns: ${gridTemplate}; height: 100%;`}
							>
								<div role="rowheader" class="xlsx-rownum">{index + 1}</div>
								{#each columns as column, col (column)}
									<div role="cell" class="xlsx-cell">{formatCell(row[col])}</div>
								{/each}
							</div>
						{/snippet}
					</VirtualList>
				{/key}
			</div>
		</div>
		<div class="xlsx-tabs" role="tablist" aria-label="Sheets">
			{#each sheetNames as name, i (name)}
				<button
					type="button"
					role="tab"
					data-testid="sheet-tab"
					aria-selected={i === activeSheetIndex}
					class:active={i === activeSheetIndex}
					onclick={() => selectSheet(i)}
				>
					{name}
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.xlsx-viewer {
		--xlsx-bg: #ffffff;
		--xlsx-fg: #171717;
		--xlsx-muted: #525252;
		--xlsx-border: #e5e5e5;
		--xlsx-header-bg: #fafafa;
		--xlsx-row-alt: #fafafa;
		--xlsx-tab-active: #171717;
		display: flex;
		flex-direction: column;
		width: 100%;
		overflow: hidden;
		background: var(--xlsx-bg);
		color: var(--xlsx-fg);
		border: 1px solid var(--xlsx-border);
		border-radius: 0.75rem;
		font-family:
			system-ui,
			-apple-system,
			'Segoe UI',
			sans-serif;
		font-size: 13px;
	}

	.xlsx-viewer.dark {
		--xlsx-bg: #0a0a0a;
		--xlsx-fg: #e5e5e5;
		--xlsx-muted: #a3a3a3;
		--xlsx-border: #262626;
		--xlsx-header-bg: #171717;
		--xlsx-row-alt: #111111;
		--xlsx-tab-active: #ffffff;
	}

	.xlsx-toolbar {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		border-bottom: 1px solid var(--xlsx-border);
	}

	.xlsx-name {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-weight: 600;
	}

	.xlsx-count {
		margin-left: auto;
		white-space: nowrap;
		color: var(--xlsx-muted);
		font-size: 12px;
	}

	.xlsx-theme-toggle {
		flex: none;
		padding: 0.375rem 0.625rem;
		border: 1px solid var(--xlsx-border);
		border-radius: 0.375rem;
		background: transparent;
		color: var(--xlsx-fg);
		font: inherit;
		cursor: pointer;
	}

	.xlsx-state {
		display: grid;
		place-items: center;
		align-content: center;
		gap: 0.25rem;
		min-height: 200px;
		padding: 1rem;
		text-align: center;
	}

	.xlsx-state-title {
		margin: 0;
		font-weight: 600;
	}

	.xlsx-state-hint {
		margin: 0;
		color: var(--xlsx-muted);
	}

	.xlsx-error {
		color: #b91c1c;
	}

	.dark .xlsx-error {
		color: #f87171;
	}

	.xlsx-scroll {
		overflow-x: auto;
	}

	.xlsx-header-row,
	.xlsx-row {
		display: grid;
	}

	.xlsx-header-row {
		background: var(--xlsx-header-bg);
		border-bottom: 1px solid var(--xlsx-border);
		font-weight: 600;
	}

	.xlsx-header-row > div {
		padding: 0.375rem 0.5rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.xlsx-row {
		border-bottom: 1px solid var(--xlsx-border);
		align-items: stretch;
	}

	.xlsx-rownum {
		padding: 0 0.5rem;
		display: flex;
		align-items: center;
		color: var(--xlsx-muted);
		font-weight: 400;
	}

	.xlsx-cell {
		padding: 0 0.5rem;
		display: flex;
		align-items: center;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.xlsx-tabs {
		display: flex;
		gap: 0.25rem;
		overflow-x: auto;
		padding: 0.5rem 0.75rem;
		border-top: 1px solid var(--xlsx-border);
	}

	.xlsx-tabs [role='tab'] {
		flex: none;
		padding: 0.375rem 0.75rem;
		border: 1px solid transparent;
		border-radius: 0.375rem;
		background: transparent;
		color: var(--xlsx-muted);
		font: inherit;
		cursor: pointer;
	}

	.xlsx-tabs [role='tab'].active {
		border-color: var(--xlsx-border);
		color: var(--xlsx-tab-active);
		font-weight: 600;
	}
</style>
