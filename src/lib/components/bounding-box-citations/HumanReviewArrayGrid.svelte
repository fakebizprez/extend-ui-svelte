<!--
	MIT License — Svelte 5 port of Extend UI bounding-box-citations. Upstream: extend-hq/ui (MIT).
	Port of upstream HumanReviewArrayValueGrid. A DOM table replaces the
	glide-data-grid canvas: row numbers, double-click (or Enter / typing) to
	edit a cell, Enter/Tab/Escape in the editor, drill-in on object and array
	cells, and selection mirrored onto the paired Actual/Expected grid. Rows
	are windowed with the shared virtual-list math, so long arrays stay cheap.
-->
<script lang="ts">
	import { computeWindow } from '../../virtual-list/window.js';
	import type { JsonValue, ReviewFieldSchema, ReviewLocation } from './citations.js';
	import { getObjectValue } from './citations.js';
	import HumanReviewArrayGrid from './HumanReviewArrayGrid.svelte';
	import HumanReviewFieldCard from './HumanReviewFieldCard.svelte';
	import ReviewIcon from './ReviewIcon.svelte';
	import {
		getArrayColumns,
		getArrayItemSchema,
		getArrayValue,
		getCellSchemaForArrayColumn,
		getCellValueForArrayColumn,
		getNestedArrayValue,
		isComplexSchema,
		isJsonArray,
		parseCellEdit,
		setArrayItemValue,
		setNestedArrayValue,
		setObjectValue,
		summarizeComplexValue,
		type ArrayColumn,
		type ArrayNestedView,
		type ArrayReviewSide,
		type GridItem
	} from './review.js';

	interface Props {
		activeNestedSide?: ArrayReviewSide | null;
		activeSelectionSide?: ArrayReviewSide | null;
		label: string;
		nestedStackBaseDepth?: number;
		readOnly?: boolean;
		schema: ReviewFieldSchema;
		selectionDepth?: number;
		sharedSelection?: GridItem | null;
		sharedNestedStack?: ArrayNestedView[];
		value: JsonValue;
		viewSide?: ArrayReviewSide;
		metadataPath?: string;
		onChange?: (value: JsonValue) => void;
		onSelectionChange?: (cell: GridItem | null, side: ArrayReviewSide, depth: number) => void;
		onNestedStackChange?: (stack: ArrayNestedView[], side: ArrayReviewSide) => void;
		onLocationHover?: (location?: ReviewLocation) => void;
		resolveArrayItemMetadataPath?: (
			metadataPath: string,
			rowIndex: number,
			rowValue: JsonValue
		) => string | undefined;
		resolveLocation?: (metadataPath: string) => ReviewLocation | undefined;
	}

	let {
		activeNestedSide = null,
		activeSelectionSide = null,
		label,
		nestedStackBaseDepth = 0,
		readOnly = false,
		schema,
		selectionDepth = 0,
		sharedSelection = null,
		sharedNestedStack,
		value,
		viewSide = 'expected',
		metadataPath,
		onChange,
		onSelectionChange,
		onNestedStackChange,
		onLocationHover,
		resolveArrayItemMetadataPath,
		resolveLocation
	}: Props = $props();

	// Upstream sizes: 220px grid, 34px header, 32px rows.
	const GRID_HEIGHT = 220;
	const HEADER_HEIGHT = 34;
	const ROW_HEIGHT = 32;
	const MARKER_WIDTH = 36;

	let localNestedStack: ArrayNestedView[] = $state.raw([]);
	let selected: GridItem | null = $state.raw(null);
	let editing: { item: GridItem; text: string } | null = $state(null);
	let scrollTop = $state(0);
	let gridElement: HTMLDivElement | null = $state(null);

	const rows = $derived(getArrayValue(value));
	const itemSchema = $derived(getArrayItemSchema(schema));
	const columns = $derived(getArrayColumns(itemSchema));
	const totalWidth = $derived(MARKER_WIDTH + columns.reduce((sum, column) => sum + column.width, 0));
	const nestedStack = $derived(sharedNestedStack ?? localNestedStack);
	const visibleNestedStack = $derived(nestedStack.slice(nestedStackBaseDepth));
	const activeNestedView = $derived(visibleNestedStack[0] ?? null);
	const activeNestedValue = $derived(
		activeNestedView ? getNestedArrayValue({ value, schema, nestedStack: [activeNestedView] }) : null
	);
	const isActiveNestedSource = $derived(Boolean(activeNestedView) && activeNestedSide === viewSide);
	const isMirroredNestedTarget = $derived(
		Boolean(activeNestedView) && activeNestedSide !== null && activeNestedSide !== viewSide
	);
	const mirroredCell = $derived(
		activeSelectionSide && activeSelectionSide !== viewSide && selectionDepth === nestedStackBaseDepth
			? sharedSelection
			: null
	);
	const range = $derived(
		computeWindow({
			itemCount: rows.length,
			itemHeight: ROW_HEIGHT,
			viewportHeight: GRID_HEIGHT - HEADER_HEIGHT,
			scrollTop
		})
	);
	const visibleRows = $derived(
		Array.from({ length: range.end - range.start }, (_, offset) => range.start + offset)
	);
	const nestedProperties = $derived(Object.entries(activeNestedView?.schema.properties ?? {}));

	function cellInfo(row: number, column: ArrayColumn) {
		const rowValue = rows[row] ?? null;
		const cellSchema = getCellSchemaForArrayColumn(itemSchema, column.id);
		const cellValue = getCellValueForArrayColumn(rowValue, itemSchema, column.id);
		return { rowValue, cellSchema, cellValue, complex: isComplexSchema(cellSchema) };
	}

	function cellText(row: number, column: ArrayColumn): string {
		const { cellSchema, cellValue, complex } = cellInfo(row, column);
		if (complex) return summarizeComplexValue(cellValue);
		if (cellSchema.type === 'number' || cellSchema.type === 'integer') {
			return typeof cellValue === 'number' ? String(cellValue) : '';
		}
		if (cellValue === null || typeof cellValue === 'object' || isJsonArray(cellValue)) return '';
		return String(cellValue);
	}

	function setNestedStack(next: ArrayNestedView[]): void {
		if (onNestedStackChange) {
			onNestedStackChange(next, viewSide);
			return;
		}
		localNestedStack = next;
	}

	function select(item: GridItem | null): void {
		if (selected?.[0] === item?.[0] && selected?.[1] === item?.[1]) return;
		selected = item;
		onSelectionChange?.(item, viewSide, nestedStackBaseDepth);
	}

	function writeCell(row: number, column: ArrayColumn, nextValue: JsonValue): void {
		if (readOnly || !onChange) return;
		const { rowValue } = cellInfo(row, column);
		const nextRowValue =
			itemSchema.type === 'object' ? setObjectValue(rowValue, column.id, nextValue) : nextValue;
		onChange(setArrayItemValue(value, row, nextRowValue));
	}

	function openNestedCell([col, row]: GridItem): void {
		const column = columns[col];
		if (!column) return;
		const { cellSchema, cellValue, complex } = cellInfo(row, column);
		if (!complex) return;
		const current = nestedStack[nestedStackBaseDepth];
		if (current?.rowIndex === row && current.columnId === column.id) return;
		setNestedStack([
			...nestedStack.slice(0, nestedStackBaseDepth),
			{
				rowIndex: row,
				columnId: column.id,
				title: `${column.title} / row ${row + 1}`,
				schema: cellSchema,
				value: cellValue
			}
		]);
	}

	function activate(item: GridItem, initialText?: string, fromKeyboard = false): void {
		const [col, row] = item;
		const column = columns[col];
		if (!column) return;
		select(item);
		const { cellSchema, cellValue, complex } = cellInfo(row, column);
		if (complex) {
			openNestedCell(item);
		} else if (cellSchema.type === 'boolean') {
			// Pointer toggles go through the checkbox itself; this is the keyboard path.
			if (initialText === undefined && fromKeyboard) writeCell(row, column, cellValue !== true);
		} else {
			editing = { item, text: initialText ?? cellText(row, column) };
		}
	}

	/**
	 * Ends the cell edit. Keyboard endings (Enter/Tab/Escape) return focus to the
	 * grid; a blur leaves focus wherever the user moved it, like upstream.
	 */
	function finishEditing(
		save: boolean,
		movement: [number, number] = [0, 0],
		refocusGrid = true
	): void {
		if (!editing) return;
		const { item, text } = editing;
		editing = null;
		const [col, row] = item;
		const column = columns[col];
		if (save && column) {
			writeCell(row, column, parseCellEdit(cellInfo(row, column).cellSchema, text, cellInfo(row, column).cellValue));
		}
		if (movement[0] || movement[1]) {
			select([
				Math.min(Math.max(col + movement[0], 0), columns.length - 1),
				Math.min(Math.max(row + movement[1], 0), rows.length - 1)
			]);
		}
		if (refocusGrid) gridElement?.focus();
	}

	function handleEditorKeydown(event: KeyboardEvent): void {
		event.stopPropagation();
		if (event.key === 'Escape') {
			event.preventDefault();
			finishEditing(false);
		} else if (event.key === 'Tab') {
			event.preventDefault();
			finishEditing(true, [event.shiftKey ? -1 : 1, 0]);
		} else if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			finishEditing(true, [0, 1]);
		}
	}

	function handleGridKeydown(event: KeyboardEvent): void {
		if (event.target !== event.currentTarget || !rows.length) return;
		const [col, row] = selected ?? [0, 0];
		const moves: Record<string, [number, number]> = {
			ArrowUp: [0, -1],
			ArrowDown: [0, 1],
			ArrowLeft: [-1, 0],
			ArrowRight: [1, 0]
		};
		const move = moves[event.key];
		if (move) {
			event.preventDefault();
			select(
				selected
					? [
							Math.min(Math.max(col + move[0], 0), columns.length - 1),
							Math.min(Math.max(row + move[1], 0), rows.length - 1)
						]
					: [0, 0]
			);
			scrollRowIntoView(selected?.[1] ?? 0);
			return;
		}
		if (!selected) return;
		const column = columns[col];
		const { cellSchema, complex } = cellInfo(row, column);
		if (event.key === 'Enter' || event.key === 'F2' || (event.key === ' ' && cellSchema.type === 'boolean')) {
			event.preventDefault();
			activate(selected, undefined, true);
		} else if (
			event.key.length === 1 &&
			!event.metaKey &&
			!event.ctrlKey &&
			!event.altKey &&
			!complex &&
			cellSchema.type !== 'boolean'
		) {
			event.preventDefault();
			activate(selected, event.key);
		}
	}

	function scrollRowIntoView(row: number): void {
		if (!gridElement) return;
		const top = row * ROW_HEIGHT;
		const bottom = top + ROW_HEIGHT;
		const viewport = GRID_HEIGHT - HEADER_HEIGHT;
		if (top < gridElement.scrollTop) gridElement.scrollTop = top;
		else if (bottom > gridElement.scrollTop + viewport) gridElement.scrollTop = bottom - viewport;
	}

	function handleHover(row: number, column: ArrayColumn): void {
		if (!onLocationHover || !resolveLocation || !metadataPath) return;
		const rowValue = rows[row];
		if (rowValue === undefined) {
			onLocationHover(undefined);
			return;
		}
		const rowMetadataPath = resolveArrayItemMetadataPath
			? resolveArrayItemMetadataPath(metadataPath, row, rowValue)
			: `${metadataPath}[${row}]`;
		if (!rowMetadataPath) {
			onLocationHover(undefined);
			return;
		}
		const propertyMetadataPath =
			itemSchema.type === 'object' ? `${rowMetadataPath}.${column.id}` : rowMetadataPath;
		onLocationHover(resolveLocation(propertyMetadataPath) ?? resolveLocation(rowMetadataPath));
	}

	function updateNestedValue(nextNestedValue: JsonValue): void {
		if (!activeNestedView || readOnly || !onChange) return;
		onChange(
			setNestedArrayValue({
				value,
				schema,
				nestedStack: visibleNestedStack.slice(0, 1),
				nextNestedValue
			})
		);
		setNestedStack(
			nestedStack.map((view, index) =>
				index === nestedStackBaseDepth ? { ...view, value: nextNestedValue } : view
			)
		);
	}

	function closeNested(): void {
		setNestedStack(nestedStack.slice(0, Math.max(nestedStackBaseDepth, nestedStack.length - 1)));
	}

	function focusEditor(node: HTMLTextAreaElement): void {
		node.focus();
		node.setSelectionRange(node.value.length, node.value.length);
	}

	function isSame(left: GridItem | null, col: number, row: number): boolean {
		return left?.[0] === col && left?.[1] === row;
	}
</script>

<div
	class={`hr-grid-card${isActiveNestedSource ? ' source' : ''}`}
	role="presentation"
	onmouseleave={() => onLocationHover?.(undefined)}
>
	<div class="hr-grid-bar">
		<span>{label}</span>
		<span>{rows.length} rows</span>
	</div>
	<div
		class="hr-grid-scroll"
		role="grid"
		tabindex="0"
		aria-label={label}
		aria-rowcount={rows.length + 1}
		aria-colcount={columns.length + 1}
		bind:this={gridElement}
		onkeydown={handleGridKeydown}
		onscroll={(event) => (scrollTop = event.currentTarget.scrollTop)}
	>
		<div
			class="hr-grid-inner"
			style={`width: ${totalWidth}px; height: ${HEADER_HEIGHT + rows.length * ROW_HEIGHT}px;`}
		>
			<div class="hr-grid-lines" aria-hidden="true">
				<div class="hr-line-col" style={`width: ${MARKER_WIDTH}px;`}></div>
				{#each columns as column (column.id)}
					<div class="hr-line-col" style={`width: ${column.width}px;`}></div>
				{/each}
			</div>
			<div class="hr-grid-header" role="row" aria-rowindex={1}>
				<div class="hr-marker hr-head" role="columnheader" aria-label="Row number"></div>
				{#each columns as column, col (column.id)}
					<div
						class={`hr-head${selected?.[0] === col ? ' focus' : ''}`}
						role="columnheader"
						style={`width: ${column.width}px;`}
					>
						{column.title}
					</div>
				{/each}
			</div>
			{#each visibleRows as row (row)}
				<div
					class="hr-row"
					role="row"
					aria-rowindex={row + 2}
					style={`top: ${HEADER_HEIGHT + row * ROW_HEIGHT}px;`}
				>
					<div class={`hr-marker${selected?.[1] === row ? ' focus' : ''}`} role="rowheader">
						{row + 1}
					</div>
					{#each columns as column, col (column.id)}
						{@const info = cellInfo(row, column)}
						{@const isSelected = isSame(selected, col, row)}
						{@const isMirrored = isSame(mirroredCell, col, row)}
						{@const nestedMatch =
							activeNestedView?.rowIndex === row && activeNestedView.columnId === column.id}
						<!-- svelte-ignore a11y_click_events_have_key_events: the grid element handles keyboard navigation and activation. -->
						<div
							class={`hr-cell${info.complex ? ' complex' : ''}${nestedMatch ? (isMirroredNestedTarget ? ' nested-mirrored' : ' nested-selected') : ''}`}
							role="gridcell"
							tabindex="-1"
							style={`width: ${column.width}px;`}
							data-row={row}
							data-column={column.id}
							aria-selected={isSelected}
							data-mirrored={isMirrored ? 'true' : undefined}
							onclick={() => select([col, row])}
							ondblclick={() => activate([col, row])}
							onmouseenter={() => handleHover(row, column)}
						>
							{#if editing && isSame(editing.item, col, row)}
								<textarea
									class="hr-cell-editor"
									aria-label="Edit cell"
									readonly={readOnly}
									value={editing.text}
									use:focusEditor
									oninput={(event) => {
										if (editing) editing.text = event.currentTarget.value;
									}}
									onkeydown={handleEditorKeydown}
									onblur={() => finishEditing(true, [0, 0], false)}
								></textarea>
							{:else if info.cellSchema.type === 'boolean' && !info.complex}
								<input
									type="checkbox"
									class="hr-cell-check"
									aria-label={`${column.title} row ${row + 1}`}
									checked={info.cellValue === true}
									disabled={readOnly}
									onchange={() => writeCell(row, column, info.cellValue !== true)}
								/>
							{:else}
								<span class="hr-cell-text">{cellText(row, column)}</span>
							{/if}
						</div>
					{/each}
				</div>
			{/each}
		</div>
	</div>
	{#if activeNestedView}
		<div class="hr-nested" data-testid="array-nested-view">
			<div class="hr-nested-bar">
				<button
					type="button"
					class="hr-nested-back"
					aria-label="Back to parent array"
					onclick={closeNested}
				>
					<ReviewIcon name="chevron-left" size={14} />
				</button>
				<div class="hr-nested-title">{activeNestedView.title}</div>
			</div>
			<div class="hr-nested-body">
				{#if activeNestedView.schema.type === 'array'}
					<HumanReviewArrayGrid
						label={activeNestedView.schema.title ?? activeNestedView.columnId}
						nestedStackBaseDepth={nestedStackBaseDepth + 1}
						{readOnly}
						schema={activeNestedView.schema}
						{sharedSelection}
						{sharedNestedStack}
						value={activeNestedValue}
						{viewSide}
						{activeNestedSide}
						{activeSelectionSide}
						{selectionDepth}
						onChange={updateNestedValue}
						{onSelectionChange}
						{onNestedStackChange}
						{resolveArrayItemMetadataPath}
						{resolveLocation}
					/>
				{:else if nestedProperties.length}
					<div class="hr-nested-fields">
						{#each nestedProperties as [propertyKey, propertySchema] (propertyKey)}
							{@const original = getObjectValue(activeNestedValue, propertyKey)}
							<HumanReviewFieldCard
								field={{ key: propertyKey, schema: propertySchema, actual: original, expected: original }}
								value={getObjectValue(activeNestedValue, propertyKey)}
								originalValue={original}
								{readOnly}
								onChange={(childValue) =>
									!readOnly &&
									updateNestedValue(setObjectValue(activeNestedValue, propertyKey, childValue))}
								onUndo={() =>
									!readOnly &&
									updateNestedValue(setObjectValue(activeNestedValue, propertyKey, original))}
								onSetNull={() =>
									!readOnly && updateNestedValue(setObjectValue(activeNestedValue, propertyKey, null))}
							/>
						{/each}
					</div>
				{:else}
					<div class="hr-empty">No properties</div>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	.hr-grid-card {
		position: relative;
		overflow: hidden;
		border: 1px solid var(--hr-border);
		border-radius: 8px;
		background: var(--hr-bg);
		transition:
			border-color 150ms,
			background-color 150ms,
			box-shadow 150ms;
	}

	.hr-grid-card:hover,
	.hr-grid-card:focus-within {
		border-color: rgb(59 130 246 / 0.5);
	}

	.hr-grid-card:focus-within {
		box-shadow: 0 0 0 1px rgb(59 130 246 / 0.08);
	}

	.hr-grid-card.source {
		border-color: rgb(59 130 246 / 0.6);
		background: rgb(59 130 246 / 0.05);
		box-shadow: 0 0 0 1px rgb(59 130 246 / 0.1);
	}

	.hr-grid-bar {
		display: flex;
		height: 32px;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		border-bottom: 1px solid var(--hr-border);
		padding: 0 0.5rem;
		color: var(--hr-muted-fg);
		font-size: 11px;
		font-weight: 500;
	}

	.hr-grid-scroll {
		position: relative;
		height: 220px;
		overflow: auto;
		background: var(--hr-grid-bg);
		outline: none;
		font-size: 13px;
		color: var(--hr-grid-text);
	}

	.hr-grid-inner {
		position: relative;
		min-width: 100%;
		min-height: 100%;
	}

	/* Empty grid lines below the last row, like glide-data-grid's canvas. */
	.hr-grid-lines {
		position: absolute;
		inset: 0;
		display: flex;
		min-height: 220px;
		background-image: linear-gradient(to bottom, var(--hr-grid-border) 1px, transparent 1px);
		background-size: 100% 32px;
		background-position: 0 33px;
		pointer-events: none;
	}

	.hr-line-col,
	.hr-head,
	.hr-marker,
	.hr-cell {
		box-sizing: border-box;
	}

	.hr-line-col {
		flex: none;
		border-right: 1px solid var(--hr-grid-border);
	}

	.hr-grid-header {
		position: sticky;
		top: 0;
		z-index: 2;
		display: flex;
		height: 34px;
		background: var(--hr-grid-header-bg);
		border-bottom: 1px solid var(--hr-grid-border);
	}

	.hr-head {
		flex: none;
		display: flex;
		align-items: center;
		overflow: hidden;
		border-right: 1px solid var(--hr-grid-border);
		padding: 0 8px;
		color: var(--hr-grid-header-text);
		font-weight: 600;
		white-space: nowrap;
		text-overflow: ellipsis;
	}

	.hr-head.focus {
		background: var(--hr-grid-header-focus);
	}

	.hr-row {
		position: absolute;
		left: 0;
		display: flex;
		height: 32px;
	}

	.hr-marker {
		position: sticky;
		left: 0;
		z-index: 1;
		flex: none;
		display: flex;
		width: 36px;
		align-items: center;
		justify-content: center;
		border-right: 1px solid var(--hr-grid-border);
		border-bottom: 1px solid var(--hr-grid-border);
		background: var(--hr-grid-bg);
		color: var(--hr-grid-text-light);
		font-size: 11px;
	}

	.hr-head.hr-marker {
		z-index: 3;
		height: 100%;
		border-bottom: none;
		background: var(--hr-grid-header-bg);
	}

	.hr-marker.focus {
		background: var(--hr-accent-light);
		color: var(--hr-grid-text);
	}

	.hr-cell {
		position: relative;
		flex: none;
		display: flex;
		align-items: center;
		overflow: visible;
		border-right: 1px solid var(--hr-grid-border);
		border-bottom: 1px solid var(--hr-grid-border);
		background: var(--hr-grid-bg);
		padding: 0 8px;
		cursor: default;
		outline: none;
	}

	.hr-cell-text {
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}

	.hr-cell.complex {
		color: var(--hr-blue-text);
		cursor: pointer;
	}

	.hr-cell.nested-selected {
		background: var(--hr-cell-selected);
		color: var(--hr-blue-text);
	}

	.hr-cell.nested-mirrored {
		background: var(--hr-cell-mirrored);
		color: var(--hr-blue-text);
	}

	.hr-cell[data-mirrored='true'] {
		background: var(--hr-cell-mirrored);
		outline: 1px dashed var(--hr-mirror-border);
		outline-offset: -1px;
	}

	.hr-cell[aria-selected='true'] {
		outline: 2px solid var(--hr-accent);
		outline-offset: -2px;
		z-index: 1;
	}

	.hr-cell-check {
		margin: 0 auto;
		accent-color: var(--hr-accent);
	}

	.hr-cell-editor {
		position: absolute;
		top: -1px;
		left: -1px;
		z-index: 4;
		box-sizing: border-box;
		width: max(100% + 2px, 180px);
		min-height: 34px;
		resize: none;
		border: 2px solid var(--hr-accent);
		border-radius: 2px;
		background: var(--hr-grid-bg);
		box-shadow: 0 4px 16px rgb(0 0 0 / 0.12);
		padding: 6px 7px;
		color: var(--hr-grid-text);
		font: inherit;
		outline: none;
	}

	.hr-nested {
		position: absolute;
		inset: 0;
		z-index: 10;
		display: flex;
		flex-direction: column;
		background: var(--hr-bg);
	}

	.hr-nested-bar {
		display: flex;
		height: 32px;
		flex: none;
		align-items: center;
		gap: 0.5rem;
		border-bottom: 1px solid var(--hr-border);
		padding: 0 0.5rem;
	}

	.hr-nested-back {
		display: inline-flex;
		width: 24px;
		height: 24px;
		align-items: center;
		justify-content: center;
		border: none;
		border-radius: 6px;
		background: transparent;
		color: var(--hr-muted-fg);
		cursor: pointer;
	}

	.hr-nested-back:hover {
		background: var(--hr-muted);
		color: var(--hr-fg);
	}

	.hr-nested-title {
		min-width: 0;
		flex: 1;
		overflow: hidden;
		color: var(--hr-fg);
		font-size: 12px;
		font-weight: 500;
		white-space: nowrap;
		text-overflow: ellipsis;
	}

	.hr-nested-body {
		min-height: 0;
		flex: 1;
		overflow: auto;
		padding: 0.5rem;
	}

	.hr-nested-fields {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 0.5rem;
	}

	.hr-empty {
		border-radius: 8px;
		background: var(--hr-bg);
		padding: 0.375rem 0.5rem;
		color: var(--hr-muted-fg);
		font-size: 14px;
	}
</style>
