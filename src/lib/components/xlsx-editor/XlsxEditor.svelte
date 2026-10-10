<!--
	MIT License — Svelte 5 port of Extend UI xlsx-editor. Upstream: extend-hq/ui (MIT).
	Exported as XlsxEditor and under the upstream name XlsxEditorPreview.
	Built on the XLSX engine: sheets load as A1-anchored grids (blank rows and
	columns kept, so addresses match the file), formulas are kept and shown in
	the formula bar, and export writes cells back at the same addresses.
	Differences from upstream (keep in sync with the docs page,
	src/routes/xlsx-editor/+page.svelte):
	- Formulas (SUM/AVERAGE/MIN/MAX/COUNT/PRODUCT plus arithmetic over
	  same-sheet A1 references) are evaluated locally instead of through
	  @extend-ai/react-xlsx. Other formulas (cross-sheet, unsupported
	  functions) show the file's saved value and do not recalculate.
	- Styling is limited to bold, horizontal alignment, and fill, kept as editor
	  state; the community SheetJS writer drops styles on export.
	- Added props: data, showToolbar, rowHeight, height, overscan, onCellChange,
	  onExport, plus an Export .xlsx button.
	- The dark-mode control is a toolbar switch, not a workbook actions menu
	  item; it only calls onIsDarkChange.
	- Not ported: italic/underline/strikethrough, font family and size, text
	  color, borders, number formats, merge cells, wrap text, vertical
	  alignment, undo/redo, add/remove sheet, cell formatting from the file,
	  frozen panes, column resize, zoom, upload menu, and the read-only mode for
	  files over 5 MB.
-->
<script lang="ts" module>
	import type { CellValue } from './formulas.js';

	export interface XlsxCellChange {
		sheet: string;
		row: number;
		col: number;
		value: CellValue;
	}

	export type XlsxCellAlign = 'left' | 'center' | 'right';

	export interface XlsxCellStyle {
		bold?: boolean;
		align?: XlsxCellAlign;
		fill?: string;
	}
</script>
<script lang="ts">
	import { VirtualList } from '#lib/virtual-list/index.js';
	import type { DarkModeProps } from '#lib/dark-mode.js';
	import type { WorkBook } from '#lib/engines/xlsx/index.js';
	import { columnIndexToLetter, evaluateCell } from './formulas.js';
	import {
		downloadXlsxBytes,
		sheetsToXlsxBytes,
		type EditableSheet
	} from './workbook-export.js';

	type EngineModule = typeof import('#lib/engines/xlsx/index.js');

	interface Props extends DarkModeProps {
		/** Workbook URL. Loaded with fetch on the client. */
		src?: string;
		/** Workbook bytes. Takes precedence over src when both are given. */
		data?: ArrayBuffer | Uint8Array;
		/** Display name shown in the toolbar. Defaults to the src basename. */
		fileName?: string;
		/** Show the toolbar (file name, formula bar, style controls, export). */
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
		/** Called after a cell edit commits, with zero-based coordinates. */
		onCellChange?: (change: XlsxCellChange) => void;
		/** Called after export with the .xlsx bytes and file name. */
		onExport?: (bytes: Uint8Array, fileName: string) => void;
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
		className = '',
		onCellChange,
		onExport
	}: Props = $props();

	type Status = 'empty' | 'loading' | 'ready' | 'error';

	let status = $state<Status>('empty');
	let errorMessage = $state('');
	let sheetNames = $state<string[]>([]);
	let activeSheetIndex = $state(0);
	// Raw state: parsed grids can be huge and need no deep reactivity. Mutations
	// bump `revision` so the derived grid below recomputes.
	let workbookCache = $state.raw<{ key: unknown; workbook: WorkBook } | null>(null);
	let grids = $state.raw<Record<string, CellValue[][]>>({});
	let styles = $state.raw<Record<string, Record<string, XlsxCellStyle>>>({});
	// Values saved in the file for each loaded formula cell, keyed by sheet then
	// `row:col`. Shown (and exported) when the local evaluator cannot compute a
	// formula that is still unchanged, e.g. cross-sheet references.
	let savedResults = $state.raw<Record<string, Record<string, { formula: string; value: CellValue }>>>(
		{}
	);
	let revision = $state(0);
	let loadingSheet = $state(false);
	let exporting = $state(false);
	let exportError = $state('');

	let selected = $state<{ row: number; col: number } | null>(null);
	let editing = $state(false);
	let draft = $state('');

	const ROWNUM_WIDTH = 48;
	const COLUMN_WIDTH = 130;

	const activeSheetName = $derived(sheetNames[activeSheetIndex] ?? '');
	const activeGrid = $derived.by((): CellValue[][] => {
		void revision;
		return grids[activeSheetName] ?? [];
	});
	const columnCount = $derived(
		activeGrid.reduce((max, row) => Math.max(max, row.length), 0)
	);
	const columnLetters = $derived(
		Array.from({ length: columnCount }, (_, index) => columnIndexToLetter(index))
	);
	const gridTemplate = $derived(
		`${ROWNUM_WIDTH}px repeat(${Math.max(columnCount, 1)}, ${COLUMN_WIDTH}px)`
	);
	const gridMinWidth = $derived(ROWNUM_WIDTH + Math.max(columnCount, 1) * COLUMN_WIDTH);
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
	const exportFileName = $derived(
		displayName.toLowerCase().endsWith('.xlsx') ? displayName : `${displayName}.xlsx`
	);
	const rowCountLabel = $derived(`${activeGrid.length} rows`);

	function rawAt(row: number, col: number): CellValue {
		return activeGrid[row]?.[col] ?? null;
	}

	function isFormulaError(value: CellValue): boolean {
		return typeof value === 'string' && value.startsWith('#');
	}

	/** Saved file value for an unchanged formula cell, when local evaluation fails. */
	function savedResultFor(sheet: string, row: number, col: number, evaluated: CellValue) {
		const saved = savedResults[sheet]?.[styleKey(row, col)];
		const raw = (grids[sheet] ?? [])[row]?.[col];
		return saved && saved.formula === raw && isFormulaError(evaluated) ? saved : undefined;
	}

	function displayAt(row: number, col: number): string {
		let evaluated = evaluateCell(rawAt(row, col), (r, c) => activeGrid[r]?.[c]);
		// ponytail: cross-sheet and unsupported functions show the saved value and
		// do not recalculate; a full formula engine would be needed for that.
		const saved = savedResultFor(activeSheetName, row, col, evaluated);
		if (saved) evaluated = saved.value;
		return evaluated === null || evaluated === undefined ? '' : String(evaluated);
	}

	function styleKey(row: number, col: number): string {
		return `${row}:${col}`;
	}

	function styleAt(row: number, col: number): XlsxCellStyle | undefined {
		void revision;
		return styles[activeSheetName]?.[styleKey(row, col)];
	}

	function cellStyleAttr(style: XlsxCellStyle | undefined): string | undefined {
		if (!style) return undefined;
		const parts: string[] = [];
		if (style.bold) parts.push('font-weight: 700');
		if (style.align) parts.push(`text-align: ${style.align}`);
		if (style.fill) parts.push(`background-color: ${style.fill}`);
		return parts.length > 0 ? parts.join('; ') : undefined;
	}

	const selectedAddress = $derived(
		selected ? `${columnIndexToLetter(selected.col)}${selected.row + 1}` : '—'
	);
	const selectedRawText = $derived(selected ? rawToText(rawAt(selected.row, selected.col)) : '');
	const selectedStyle = $derived(
		selected ? (styleAt(selected.row, selected.col) ?? {}) : ({} as XlsxCellStyle)
	);

	function rawToText(value: CellValue): string {
		return value === null || value === undefined ? '' : String(value);
	}

	function touch(): void {
		revision += 1;
	}

	function normalizeCell(value: unknown): CellValue {
		if (value === null || value === undefined) return null;
		if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
			return value;
		}
		return String(value);
	}

	const NUMERIC_PATTERN = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;

	/** Coerces editor input the way spreadsheets do: blanks to null, numbers to numbers. */
	function coerceDraft(text: string): CellValue {
		const trimmed = text.trim();
		if (trimmed === '') return null;
		if (NUMERIC_PATTERN.test(trimmed)) {
			const numeric = Number(trimmed);
			if (Number.isFinite(numeric)) return numeric;
		}
		return text;
	}

	function setRaw(row: number, col: number, value: CellValue): void {
		const grid = grids[activeSheetName] ?? [];
		while (grid.length <= row) grid.push([]);
		const gridRow = grid[row] as CellValue[];
		while (gridRow.length <= col) gridRow.push(null);
		gridRow[col] = value;
		grids = { ...grids, [activeSheetName]: grid };
		touch();
	}

	function selectCell(row: number, col: number): void {
		if (editing) commitEdit();
		selected = { row, col };
	}

	function startEdit(): void {
		if (!selected || status !== 'ready') return;
		draft = rawToText(rawAt(selected.row, selected.col));
		editing = true;
	}

	function commitEdit(): void {
		if (!editing || !selected) {
			editing = false;
			return;
		}
		const { row, col } = selected;
		const previous = rawAt(row, col);
		const next = coerceDraft(draft);
		editing = false;
		if (next !== previous) {
			setRaw(row, col, next);
			onCellChange?.({ sheet: activeSheetName, row, col, value: next });
		}
	}

	function cancelEdit(): void {
		editing = false;
	}

	/** Matches upstream: the edit input takes focus with the caret at the end. */
	function focusAtEnd(input: HTMLInputElement): void {
		input.focus();
		input.setSelectionRange(input.value.length, input.value.length);
	}

	function commitFormulaBar(value: string): void {
		if (!selected) return;
		const { row, col } = selected;
		const previous = rawAt(row, col);
		const next = coerceDraft(value);
		if (next !== previous) {
			setRaw(row, col, next);
			onCellChange?.({ sheet: activeSheetName, row, col, value: next });
		}
	}

	function updateSelectedStyle(mutator: (style: XlsxCellStyle) => XlsxCellStyle): void {
		if (!selected) return;
		const key = styleKey(selected.row, selected.col);
		const sheetStyles = styles[activeSheetName] ?? {};
		const updated = mutator({ ...(sheetStyles[key] ?? {}) });
		styles = { ...styles, [activeSheetName]: { ...sheetStyles, [key]: updated } };
		touch();
	}

	function toggleBold(): void {
		updateSelectedStyle((style) => ({ ...style, bold: !style.bold }));
	}

	function setAlign(align: XlsxCellAlign): void {
		updateSelectedStyle((style) => ({ ...style, align }));
	}

	function setFill(fill: string): void {
		updateSelectedStyle((style) => ({ ...style, fill }));
	}

	function clearFill(): void {
		updateSelectedStyle((style) => {
			const next = { ...style };
			delete next.fill;
			return next;
		});
	}

	function selectSheet(index: number): void {
		if (editing) commitEdit();
		activeSheetIndex = index;
		selected = null;
	}

	async function handleExport(): Promise<void> {
		if (exporting || status !== 'ready') return;
		exporting = true;
		exportError = '';
		try {
			const sheets: EditableSheet[] = sheetNames.map((name) => {
				const grid = grids[name] ?? [[]];
				const results: Record<string, CellValue> = {};
				for (const [key, saved] of Object.entries(savedResults[name] ?? {})) {
					const [row, col] = key.split(':').map(Number) as [number, number];
					if (grid[row]?.[col] === saved.formula) results[key] = saved.value;
				}
				return { name, grid, savedResults: results };
			});
			const bytes = await sheetsToXlsxBytes(sheets);
			downloadXlsxBytes(bytes, exportFileName);
			onExport?.(bytes, exportFileName);
		} catch (failure) {
			exportError = failure instanceof Error ? failure.message : 'Could not export workbook.';
		} finally {
			exporting = false;
		}
	}

	// Client-only loading: $effect never runs on the server, and the engine
	// (with SheetJS inside it) is loaded through a dynamic import.
	$effect(() => {
		const sourceKey: unknown = data ?? src ?? null;
		if (sourceKey === null || sourceKey === undefined) {
			workbookCache = null;
			sheetNames = [];
			activeSheetIndex = 0;
			grids = {};
			styles = {};
			savedResults = {};
			selected = null;
			editing = false;
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
				selected = null;
				editing = false;
				status = 'ready';
			} catch (failure) {
				if (cancelled) return;
				sheetNames = [];
				grids = {};
				errorMessage =
					failure instanceof Error ? failure.message : 'Could not load workbook.';
				status = 'error';
			}
		})();
		return () => {
			cancelled = true;
		};
	});

	// Convert every sheet to an editable grid once the workbook loads. All
	// sheets load up front so export always writes the whole workbook.
	$effect(() => {
		const cached = workbookCache;
		const names = sheetNames;
		if (!cached || names.length === 0) return;
		let cancelled = false;
		loadingSheet = true;
		(async () => {
			try {
				const engine: EngineModule = await import('#lib/engines/xlsx/index.js');
				const next: Record<string, CellValue[][]> = {};
				const nextSaved: typeof savedResults = {};
				for (const name of names) {
					// A1-anchored with blank rows kept, so addresses match the file.
					const { values, formulas } = await engine.sheetToGrid(cached.workbook, name);
					const grid = values.map((row) => row.map(normalizeCell));
					const saved: Record<string, { formula: string; value: CellValue }> = {};
					for (const [key, formula] of Object.entries(formulas)) {
						const [row, col] = key.split(':').map(Number) as [number, number];
						const gridRow = grid[row] as CellValue[];
						saved[key] = { formula: `=${formula}`, value: gridRow[col] ?? null };
						gridRow[col] = `=${formula}`;
					}
					next[name] = grid;
					nextSaved[name] = saved;
				}
				if (cancelled) return;
				savedResults = nextSaved;
				grids = next;
				touch();
			} catch (failure) {
				if (cancelled) return;
				grids = {};
				errorMessage =
					failure instanceof Error ? failure.message : 'Could not load sheets.';
				status = 'error';
			} finally {
				if (!cancelled) loadingSheet = false;
			}
		})();
		return () => {
			cancelled = true;
		};
	});
</script>

<div
	class={['xlsx-editor', isDark ? 'dark' : '', classProp, className].filter(Boolean).join(' ')}
	data-dark={String(isDark)}
	data-testid="xlsx-editor"
>
	{#if showToolbar}
		<div class="xlsx-toolbar">
			<span class="xlsx-name" data-testid="workbook-name">{displayName}</span>
			{#if status === 'ready' && !loadingSheet}
				<span class="xlsx-count" data-testid="row-count">{rowCountLabel}</span>
			{/if}
			<button
				type="button"
				class="xlsx-export"
				data-testid="export-button"
				disabled={exporting || status !== 'ready' || loadingSheet}
				onclick={() => void handleExport()}
			>
				{exporting ? 'Exporting…' : 'Export .xlsx'}
			</button>
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
		{#if exportError}
			<div class="xlsx-export-error" role="alert">{exportError}</div>
		{/if}
		{#if status === 'ready'}
			<div class="xlsx-editbar">
				<span class="xlsx-address" data-testid="active-cell-address">{selectedAddress}</span>
				<input
					class="xlsx-formula"
					data-testid="formula-bar"
					aria-label="Formula bar"
					placeholder="Select a cell to edit"
					value={selectedRawText}
					disabled={!selected}
					onchange={(event) => commitFormulaBar(event.currentTarget.value)}
					onkeydown={(event) => {
						if (event.key === 'Enter') event.currentTarget.blur();
					}}
				/>
				<div class="xlsx-styles" role="group" aria-label="Cell style">
					<button
						type="button"
						aria-pressed={selectedStyle.bold === true}
						aria-label="Bold"
						disabled={!selected}
						onclick={toggleBold}
					>
						B
					</button>
					<button
						type="button"
						aria-pressed={selectedStyle.align === 'left'}
						aria-label="Align left"
						disabled={!selected}
						onclick={() => setAlign('left')}
					>
						⟨
					</button>
					<button
						type="button"
						aria-pressed={selectedStyle.align === 'center'}
						aria-label="Align center"
						disabled={!selected}
						onclick={() => setAlign('center')}
					>
						≣
					</button>
					<button
						type="button"
						aria-pressed={selectedStyle.align === 'right'}
						aria-label="Align right"
						disabled={!selected}
						onclick={() => setAlign('right')}
					>
						⟩
					</button>
					<input
						type="color"
						data-testid="fill-color"
						aria-label="Fill color"
						title="Fill color"
						value={selectedStyle.fill ?? '#ffffff'}
						disabled={!selected}
						oninput={(event) => setFill(event.currentTarget.value)}
					/>
					<button
						type="button"
						aria-label="Clear fill"
						disabled={!selected || !selectedStyle.fill}
						onclick={clearFill}
					>
						∅
					</button>
				</div>
			</div>
		{/if}
	{/if}

	{#if status === 'loading'}
		<div class="xlsx-state" role="status">Loading workbook…</div>
	{:else if status === 'error'}
		<div class="xlsx-state xlsx-error" role="alert">{errorMessage}</div>
	{:else if status === 'empty'}
		<div class="xlsx-state">
			<p class="xlsx-state-title">No workbook to edit</p>
			<p class="xlsx-state-hint">Pass a workbook URL with src or bytes with data.</p>
		</div>
	{:else if loadingSheet}
		<div class="xlsx-state" role="status">Loading sheets…</div>
	{:else if activeGrid.length === 0}
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
			<div
				class="xlsx-grid"
				role="grid"
				aria-label={activeSheetName}
				style={`min-width: ${gridMinWidth}px;`}
			>
				<div role="row" class="xlsx-header-row" style={`grid-template-columns: ${gridTemplate};`}>
					<div role="columnheader" class="xlsx-rownum" aria-label="Row numbers"></div>
					{#each columnLetters as letter (letter)}
						<div role="columnheader" class="xlsx-header-cell">{letter}</div>
					{/each}
				</div>
				{#key activeSheetName}
					<VirtualList items={activeGrid} itemHeight={rowHeight} {height} {overscan}>
						{#snippet children(_row, index)}
							<div
								role="row"
								class="xlsx-row"
								data-row-index={index}
								style={`grid-template-columns: ${gridTemplate}; height: 100%;`}
							>
								<div role="rowheader" class="xlsx-rownum">{index + 1}</div>
								{#each columnLetters as _letter, col (col)}
									{@const isSelected =
										selected !== null && selected.row === index && selected.col === col}
									{@const isEditing = isSelected && editing}
									<div
										role="gridcell"
										tabindex="0"
										class="xlsx-cell"
										class:selected={isSelected}
										data-testid="editor-cell"
										data-row={index}
										data-col={col}
										aria-selected={isSelected}
										style={cellStyleAttr(styleAt(index, col))}
										onclick={(event) => {
											// Ignore events bubbling up from the edit input.
											if (event.target !== event.currentTarget) return;
											selectCell(index, col);
										}}
										ondblclick={(event) => {
											if (event.target !== event.currentTarget) return;
											selectCell(index, col);
											startEdit();
										}}
										onkeydown={(event) => {
											if (event.target !== event.currentTarget) return;
											if (event.key === 'Enter' && !editing) {
												event.preventDefault();
												selectCell(index, col);
												startEdit();
											}
										}}
									>
										{#if isEditing}
											<input
												class="xlsx-cell-input"
												data-testid="cell-input"
												aria-label={`Edit ${columnIndexToLetter(col)}${index + 1}`}
												value={draft}
												{@attach focusAtEnd}
												oninput={(event) => {
													draft = event.currentTarget.value;
												}}
												onkeydown={(event) => {
													if (event.key === 'Enter') {
														event.preventDefault();
														commitEdit();
													} else if (event.key === 'Escape') {
														event.preventDefault();
														cancelEdit();
													} else {
														return;
													}
													// Hand focus back to the cell so keyboard use continues.
													event.currentTarget.parentElement?.focus();
												}}
												onblur={() => commitEdit()}
											/>
										{:else}
											{displayAt(index, col)}
										{/if}
									</div>
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
	.xlsx-editor {
		--xlsx-bg: #ffffff;
		--xlsx-fg: #171717;
		--xlsx-muted: #525252;
		--xlsx-border: #e5e5e5;
		--xlsx-header-bg: #fafafa;
		--xlsx-row-alt: #fafafa;
		--xlsx-tab-active: #171717;
		--xlsx-selected: #dbeafe;
		--xlsx-selected-border: #2563eb;
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

	.xlsx-editor.dark {
		--xlsx-bg: #0a0a0a;
		--xlsx-fg: #e5e5e5;
		--xlsx-muted: #a3a3a3;
		--xlsx-border: #262626;
		--xlsx-header-bg: #171717;
		--xlsx-row-alt: #111111;
		--xlsx-tab-active: #ffffff;
		--xlsx-selected: #1e3a8a;
		--xlsx-selected-border: #60a5fa;
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

	.xlsx-export,
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

	.xlsx-export {
		margin-left: auto;
		font-weight: 600;
	}

	.xlsx-count + .xlsx-export {
		margin-left: 0;
	}

	.xlsx-export:disabled {
		opacity: 0.5;
		cursor: default;
	}

	.xlsx-export-error {
		padding: 0.5rem 0.75rem;
		border-bottom: 1px solid var(--xlsx-border);
		color: #b91c1c;
	}

	.dark .xlsx-export-error {
		color: #f87171;
	}

	.xlsx-editbar {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		border-bottom: 1px solid var(--xlsx-border);
	}

	.xlsx-address {
		flex: none;
		min-width: 3rem;
		text-align: center;
		font-variant-numeric: tabular-nums;
		font-weight: 600;
		color: var(--xlsx-muted);
	}

	.xlsx-formula {
		flex: 1;
		min-width: 0;
		padding: 0.375rem 0.5rem;
		border: 1px solid var(--xlsx-border);
		border-radius: 0.375rem;
		background: transparent;
		color: var(--xlsx-fg);
		font: inherit;
	}

	.xlsx-styles {
		display: flex;
		flex: none;
		align-items: center;
		gap: 0.25rem;
	}

	.xlsx-styles button {
		padding: 0.375rem 0.5rem;
		border: 1px solid var(--xlsx-border);
		border-radius: 0.375rem;
		background: transparent;
		color: var(--xlsx-fg);
		font: inherit;
		cursor: pointer;
	}

	.xlsx-styles button[aria-pressed='true'] {
		background: var(--xlsx-header-bg);
		border-color: var(--xlsx-selected-border);
		font-weight: 700;
	}

	.xlsx-styles button:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.xlsx-styles input[type='color'] {
		width: 2rem;
		height: 1.75rem;
		padding: 0;
		border: 1px solid var(--xlsx-border);
		border-radius: 0.375rem;
		background: transparent;
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
		cursor: cell;
		outline-offset: -2px;
	}

	.xlsx-cell.selected {
		background: var(--xlsx-selected);
		outline: 2px solid var(--xlsx-selected-border);
	}

	.xlsx-cell-input {
		width: 100%;
		padding: 0.125rem 0.25rem;
		border: 1px solid var(--xlsx-selected-border);
		border-radius: 0.25rem;
		background: var(--xlsx-bg);
		color: var(--xlsx-fg);
		font: inherit;
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
