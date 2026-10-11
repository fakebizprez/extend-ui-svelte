// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
// Component tests: run in the Vitest client (jsdom) project.
import { describe, expect, it, vi, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { read, utils, write } from 'xlsx';
import XlsxEditor from './XlsxEditor.svelte';
import { XlsxEditorPreview, type XlsxEditorProps } from './index.js';

/** Required upstream props: dark mode is parent-controlled. */
const DARK = { isDark: false, onIsDarkChange: () => {} };

function inventoryBytes(): Uint8Array {
	const workbook = utils.book_new();
	const inventory = utils.aoa_to_sheet([
		['SKU', 'Item', 'Qty', 'Warehouse'],
		['A-9001', 'Resistor kit', 120, 'Reno'],
		['A-9002', 'Capacitor set', 85, 'Austin'],
		['A-9005', 'Multimeter', 42, 'Reno']
	]);
	utils.book_append_sheet(workbook, inventory, 'Inventory');
	const summary = utils.aoa_to_sheet([
		['Metric', 'Value'],
		['Total SKUs', 3],
		['Total units', 247]
	]);
	utils.book_append_sheet(workbook, summary, 'Summary');
	return new Uint8Array(write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer);
}

/**
 * Lanes: data starts at B2 (used range B2:D6) with a blank row 4 and SUM
 * formulas in row 6. Totals: a cross-sheet formula the local evaluator cannot
 * compute, so its cached value (787) must be kept.
 */
function lanesBytes(): Uint8Array {
	const workbook = utils.book_new();
	const lanes = {};
	utils.sheet_add_aoa(
		lanes,
		[
			['Lane', 'Loads', 'Miles'],
			['Reno-Austin', 4, 1650],
			[],
			['Austin-Reno', 3, 1650],
			['Total', { t: 'n', v: 7, f: 'SUM(C3:C5)' }, { t: 'n', v: 3300, f: 'SUM(D3:D5)' }]
		],
		{ origin: 'B2' }
	);
	(lanes as Record<string, unknown>)['!ref'] = 'B2:D6';
	utils.book_append_sheet(workbook, lanes, 'Lanes');
	const totals = utils.aoa_to_sheet([
		['Metric', 'Value'],
		['Total units', { t: 'n', v: 787, f: 'SUM(Inventory!C2:C6)' }]
	]);
	utils.book_append_sheet(workbook, totals, 'Totals');
	return new Uint8Array(write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer);
}

/**
 * One row of tricky cells, as Excel saves them:
 * A1 text "=abc" · B1 10 · C1 TRUE · D1 text "5" ·
 * E1 =SUM(B1:D1) saved 10 · F1 =B1*2 saved 999 (stale, manual calc) ·
 * G1 =1=1 saved TRUE · H1 =1/0 saved #DIV/0! · I1 literal #N/A
 */
function mixedBytes(): Uint8Array {
	const workbook = utils.book_new();
	utils.book_append_sheet(
		workbook,
		{
			'!ref': 'A1:I1',
			A1: { t: 's', v: '=abc' },
			B1: { t: 'n', v: 10 },
			C1: { t: 'b', v: true },
			D1: { t: 's', v: '5' },
			E1: { t: 'n', v: 10, f: 'SUM(B1:D1)' },
			F1: { t: 'n', v: 999, f: 'B1*2' },
			G1: { t: 'b', v: true, f: '1=1' },
			H1: { t: 'e', v: 7, f: '1/0' },
			I1: { t: 'e', v: 0x2a }
		},
		'Mixed'
	);
	return new Uint8Array(write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer);
}

function rowTexts(container: HTMLElement, row = 0): string[] {
	return [...container.querySelectorAll(`[data-row-index="${row}"] [role="gridcell"]`)].map(
		(cell) => cell.textContent?.trim() ?? ''
	);
}

/** Edits the cell with that text, or the cell at [row, col]. */
async function editCell(target: string | [number, number], value: string): Promise<void> {
	const cell =
		typeof target === 'string'
			? screen.getByRole('gridcell', { name: target })
			: (document.querySelector(
					`[data-testid="editor-cell"][data-row="${target[0]}"][data-col="${target[1]}"]`
				) as HTMLElement);
	await fireEvent.dblClick(cell);
	const input = await screen.findByTestId('cell-input');
	await fireEvent.input(input, { target: { value } });
	await fireEvent.keyDown(input, { key: 'Enter' });
}

async function exportedWorkbook(onExport: ReturnType<typeof vi.fn>) {
	await fireEvent.click(screen.getByTestId('export-button'));
	await waitFor(() => expect(onExport).toHaveBeenCalledTimes(1));
	const [bytes] = onExport.mock.calls[0] as [Uint8Array, string];
	return read(bytes, { type: 'array' });
}

async function gridLoaded(): Promise<HTMLElement> {
	const editor = await screen.findByTestId('xlsx-editor');
	expect(await screen.findByRole('gridcell', { name: 'Resistor kit' })).toBeVisible();
	return editor;
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('XlsxEditor', () => {
	it('requires isDark and onIsDarkChange, like upstream XlsxEditorPreview', () => {
		// @ts-expect-error isDark and onIsDarkChange are required
		const missingBoth: XlsxEditorProps = { src: '/fixtures/sample.xlsx' };
		// @ts-expect-error onIsDarkChange is required
		const missingCallback: XlsxEditorProps = { src: '/fixtures/sample.xlsx', isDark: false };
		const complete: XlsxEditorProps = { src: '/fixtures/sample.xlsx', ...DARK };
		expect([missingBoth, missingCallback, complete]).toHaveLength(3);
	});

	it('renders every grid row with letter column headers', async () => {
		render(XlsxEditor, { ...DARK, data: inventoryBytes() });
		await gridLoaded();

		// Unlike the viewer, the header row is editable grid data.
		expect(screen.getByRole('gridcell', { name: 'SKU' })).toBeVisible();
		expect(screen.getByRole('gridcell', { name: '120' })).toBeVisible();
		expect(screen.getByRole('columnheader', { name: 'A' })).toBeVisible();
		expect(screen.getByRole('columnheader', { name: 'D' })).toBeVisible();
		expect(screen.getByRole('tab', { name: 'Inventory' })).toHaveAttribute(
			'aria-selected',
			'true'
		);
	});

	it('selects a cell on click and shows its address in the formula bar', async () => {
		render(XlsxEditor, { ...DARK, data: inventoryBytes() });
		await gridLoaded();

		await fireEvent.click(screen.getByRole('gridcell', { name: 'Resistor kit' }));

		const cell = screen.getByRole('gridcell', { name: 'Resistor kit' });
		expect(cell).toHaveAttribute('aria-selected', 'true');
		expect(screen.getByTestId('active-cell-address')).toHaveTextContent('B2');
		expect(screen.getByTestId('formula-bar')).toHaveValue('Resistor kit');
	});

	it('commits a double-click edit on Enter and notifies onCellChange', async () => {
		const onCellChange = vi.fn();
		render(XlsxEditor, { ...DARK, data: inventoryBytes(), onCellChange });
		await gridLoaded();

		await fireEvent.dblClick(screen.getByRole('gridcell', { name: 'Resistor kit' }));
		const input = await screen.findByTestId('cell-input');
		expect(input).toHaveValue('Resistor kit');
		await fireEvent.input(input, { target: { value: 'Resistor kit pro' } });
		await fireEvent.keyDown(input, { key: 'Enter' });

		expect(await screen.findByRole('gridcell', { name: 'Resistor kit pro' })).toBeVisible();
		expect(screen.queryByTestId('cell-input')).not.toBeInTheDocument();
		expect(onCellChange).toHaveBeenCalledTimes(1);
		expect(onCellChange).toHaveBeenCalledWith({
			sheet: 'Inventory',
			row: 1,
			col: 1,
			value: 'Resistor kit pro'
		});
	});

	it('cancels an edit on Escape without changing the grid', async () => {
		const onCellChange = vi.fn();
		render(XlsxEditor, { ...DARK, data: inventoryBytes(), onCellChange });
		await gridLoaded();

		await fireEvent.dblClick(screen.getByRole('gridcell', { name: '120' }));
		const input = await screen.findByTestId('cell-input');
		await fireEvent.input(input, { target: { value: '999' } });
		await fireEvent.keyDown(input, { key: 'Escape' });

		expect(screen.queryByTestId('cell-input')).not.toBeInTheDocument();
		expect(screen.getByRole('gridcell', { name: '120' })).toBeVisible();
		expect(screen.queryByRole('gridcell', { name: '999' })).not.toBeInTheDocument();
		expect(onCellChange).not.toHaveBeenCalled();
	});

	it('focuses the edit input with the caret at the end when editing starts', async () => {
		render(XlsxEditor, { ...DARK, data: inventoryBytes() });
		await gridLoaded();

		await fireEvent.dblClick(screen.getByRole('gridcell', { name: 'Resistor kit' }));
		const input = (await screen.findByTestId('cell-input')) as HTMLInputElement;
		expect(input).toHaveFocus();
		expect(input.selectionStart).toBe('Resistor kit'.length);
		expect(input.selectionEnd).toBe('Resistor kit'.length);

		// Enter commits and, like upstream, keeps the cell active with focus on the grid.
		await fireEvent.keyDown(input, { key: 'Enter' });
		expect(screen.queryByTestId('cell-input')).not.toBeInTheDocument();
		expect(screen.getByRole('grid')).toHaveFocus();
		expect(screen.getByTestId('active-cell-address')).toHaveTextContent('B2');

		// F2 edits the active cell again, caret at the end.
		await fireEvent.keyDown(screen.getByRole('grid'), { key: 'F2' });
		const again = (await screen.findByTestId('cell-input')) as HTMLInputElement;
		expect(again).toHaveFocus();
		expect(again.selectionStart).toBe('Resistor kit'.length);
	});

	it('returns focus to the grid after Escape cancels an edit', async () => {
		render(XlsxEditor, { ...DARK, data: inventoryBytes() });
		await gridLoaded();

		await fireEvent.dblClick(screen.getByRole('gridcell', { name: '120' }));
		const input = await screen.findByTestId('cell-input');
		await fireEvent.input(input, { target: { value: '999' } });
		await fireEvent.keyDown(input, { key: 'Escape' });

		expect(screen.queryByTestId('cell-input')).not.toBeInTheDocument();
		expect(screen.getByRole('grid')).toHaveFocus();
		expect(screen.getByTestId('active-cell-address')).toHaveTextContent('C2');
		expect(screen.getByRole('gridcell', { name: '120' })).toBeVisible();
	});

	it('is a single Tab stop: the grid is focusable, cells are not', async () => {
		const { container } = render(XlsxEditor, { ...DARK, data: inventoryBytes() });
		await gridLoaded();

		expect(screen.getByRole('grid')).toHaveAttribute('tabindex', '0');
		const focusableCells = container.querySelectorAll('[role="gridcell"][tabindex]:not([tabindex="-1"])');
		expect(focusableCells).toHaveLength(0);
	});

	it('moves the active cell with the arrows, Tab, and Enter, like upstream', async () => {
		render(XlsxEditor, { ...DARK, data: inventoryBytes() });
		await gridLoaded();
		const grid = screen.getByRole('grid');
		const address = () => screen.getByTestId('active-cell-address').textContent;

		// With no active cell, keys start from A1.
		grid.focus();
		await fireEvent.keyDown(grid, { key: 'ArrowDown' });
		expect(address()).toBe('A2');
		await fireEvent.keyDown(grid, { key: 'ArrowRight' });
		expect(address()).toBe('B2');
		expect(screen.getByTestId('formula-bar')).toHaveValue('Resistor kit');
		// The grid points assistive tech at the active cell.
		const active = screen.getByRole('gridcell', { name: 'Resistor kit' });
		expect(grid).toHaveAttribute('aria-activedescendant', active.id);
		expect(active).toHaveAttribute('aria-selected', 'true');

		await fireEvent.keyDown(grid, { key: 'Tab' });
		expect(address()).toBe('C2');
		await fireEvent.keyDown(grid, { key: 'Tab', shiftKey: true });
		expect(address()).toBe('B2');
		await fireEvent.keyDown(grid, { key: 'Enter' });
		expect(address()).toBe('B3');
		await fireEvent.keyDown(grid, { key: 'Enter', shiftKey: true });
		expect(address()).toBe('B2');
		await fireEvent.keyDown(grid, { key: 'End' });
		expect(address()).toBe('D2');
		await fireEvent.keyDown(grid, { key: 'Home', ctrlKey: true });
		expect(address()).toBe('A1');
		await fireEvent.keyDown(grid, { key: 'ArrowDown', ctrlKey: true });
		expect(address()).toBe('A4');
		expect(screen.queryByTestId('cell-input')).not.toBeInTheDocument();
	});

	it('starts editing when a printable key is typed, replacing the value', async () => {
		const onCellChange = vi.fn();
		render(XlsxEditor, { ...DARK, data: inventoryBytes(), onCellChange });
		await gridLoaded();
		await fireEvent.click(screen.getByRole('gridcell', { name: '120' }));
		const grid = screen.getByRole('grid');
		expect(grid).toHaveFocus();

		await fireEvent.keyDown(grid, { key: '7' });
		const input = (await screen.findByTestId('cell-input')) as HTMLInputElement;
		expect(input).toHaveFocus();
		expect(input).toHaveValue('7');
		await fireEvent.input(input, { target: { value: '75' } });
		await fireEvent.keyDown(input, { key: 'Enter' });

		expect(await screen.findByRole('gridcell', { name: '75' })).toBeVisible();
		expect(onCellChange).toHaveBeenCalledWith({ sheet: 'Inventory', row: 1, col: 2, value: 75 });
		// Ctrl/Cmd shortcuts do not start an edit.
		await fireEvent.keyDown(grid, { key: 'c', ctrlKey: true });
		expect(screen.queryByTestId('cell-input')).not.toBeInTheDocument();
	});

	it('clears the active cell with Delete or Backspace', async () => {
		const onCellChange = vi.fn();
		render(XlsxEditor, { ...DARK, data: inventoryBytes(), onCellChange });
		await gridLoaded();
		await fireEvent.click(screen.getByRole('gridcell', { name: 'Resistor kit' }));
		const grid = screen.getByRole('grid');

		await fireEvent.keyDown(grid, { key: 'Delete' });
		expect(screen.queryByRole('gridcell', { name: 'Resistor kit' })).not.toBeInTheDocument();
		expect(screen.getByTestId('formula-bar')).toHaveValue('');
		expect(onCellChange).toHaveBeenLastCalledWith({ sheet: 'Inventory', row: 1, col: 1, value: null });

		await fireEvent.keyDown(grid, { key: 'ArrowRight' });
		await fireEvent.keyDown(grid, { key: 'Backspace' });
		expect(screen.queryByRole('gridcell', { name: '120' })).not.toBeInTheDocument();
	});

	it('commits and moves when an arrow key is pressed while editing, like upstream', async () => {
		render(XlsxEditor, { ...DARK, data: inventoryBytes() });
		await gridLoaded();
		await fireEvent.dblClick(screen.getByRole('gridcell', { name: '120' }));
		const input = await screen.findByTestId('cell-input');
		await fireEvent.input(input, { target: { value: '121' } });

		await fireEvent.keyDown(input, { key: 'ArrowDown' });
		expect(screen.queryByTestId('cell-input')).not.toBeInTheDocument();
		expect(screen.getByRole('gridcell', { name: '121' })).toBeVisible();
		expect(screen.getByTestId('active-cell-address')).toHaveTextContent('C3');
		expect(screen.getByRole('grid')).toHaveFocus();
	});

	it('jumps to the used range with Ctrl+Home and Ctrl+End, like upstream', async () => {
		// lanesBytes holds data in B2:D6.
		render(XlsxEditor, { ...DARK, data: lanesBytes() });
		await screen.findByRole('gridcell', { name: 'Lane' });
		const grid = screen.getByRole('grid');
		grid.focus();

		await fireEvent.keyDown(grid, { key: 'Home', ctrlKey: true });
		expect(screen.getByTestId('active-cell-address')).toHaveTextContent('B2');
		await fireEvent.keyDown(grid, { key: 'End', ctrlKey: true });
		expect(screen.getByTestId('active-cell-address')).toHaveTextContent('D6');
		await fireEvent.keyDown(grid, { key: 'Home' });
		expect(screen.getByTestId('active-cell-address')).toHaveTextContent('B6');
	});

	it('keeps the cell editor mounted and focused when its row scrolls out of view', async () => {
		const workbook = utils.book_new();
		const data: (string | number)[][] = [['id']];
		for (let i = 1; i < 500; i += 1) data.push([`row-${i}`]);
		utils.book_append_sheet(workbook, utils.aoa_to_sheet(data), 'Big');
		const bytes = new Uint8Array(write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer);
		const onCellChange = vi.fn();
		render(XlsxEditor, { ...DARK, data: bytes, height: 340, onCellChange });

		await fireEvent.dblClick(await screen.findByRole('gridcell', { name: 'row-1' }));
		const input = await screen.findByTestId('cell-input');
		await fireEvent.input(input, { target: { value: 'row-1 edited' } });

		// Scroll the edited row far out of the virtual window, as a mouse wheel would.
		const viewport = screen.getByTestId('virtual-viewport');
		viewport.scrollTop = 400 * 34;
		await fireEvent.scroll(viewport);
		expect(await screen.findByRole('gridcell', { name: 'row-405' })).toBeVisible();
		expect(screen.queryByRole('gridcell', { name: 'row-2' })).not.toBeInTheDocument();

		// Upstream's editor overlay stays put: same input, still focused, nothing committed.
		expect(screen.getByTestId('cell-input')).toBe(input);
		expect(input).toHaveFocus();
		expect(onCellChange).not.toHaveBeenCalled();

		await fireEvent.keyDown(input, { key: 'Enter' });
		expect(onCellChange).toHaveBeenCalledExactlyOnceWith({
			sheet: 'Big',
			row: 1,
			col: 0,
			value: 'row-1 edited'
		});
		expect(screen.getByRole('grid')).toHaveFocus();
	});

	it('scrolls the virtualized grid to keep the active cell rendered', async () => {
		const workbook = utils.book_new();
		const data: (string | number)[][] = [['id']];
		for (let i = 1; i < 500; i += 1) data.push([`row-${i}`]);
		utils.book_append_sheet(workbook, utils.aoa_to_sheet(data), 'Big');
		const bytes = new Uint8Array(write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer);
		render(XlsxEditor, { ...DARK, data: bytes, height: 340 });
		await screen.findByRole('gridcell', { name: 'row-1' });
		expect(screen.queryByRole('gridcell', { name: 'row-499' })).not.toBeInTheDocument();

		const grid = screen.getByRole('grid');
		grid.focus();
		await fireEvent.keyDown(grid, { key: 'ArrowDown', ctrlKey: true });

		const last = await screen.findByRole('gridcell', { name: 'row-499' });
		expect(last).toHaveAttribute('aria-selected', 'true');
		expect(screen.getByTestId('active-cell-address')).toHaveTextContent('A500');
		expect(grid).toHaveAttribute('aria-activedescendant', last.id);
		// Row 499 (0-based) ends at 500 * 34; the 340px viewport shows its last 10 rows.
		expect(screen.getByTestId('virtual-viewport').scrollTop).toBe(500 * 34 - 340);
	});

	it('evaluates a formula entered into a cell', async () => {
		render(XlsxEditor, { ...DARK, data: inventoryBytes() });
		await gridLoaded();

		// Select D2 (first Reno cell), then replace it with a formula over the
		// Qty column, whose rows 2..4 hold 120, 85, 42.
		await fireEvent.click(screen.getAllByRole('gridcell', { name: 'Reno' })[0]);
		expect(screen.getByTestId('active-cell-address')).toHaveTextContent('D2');
		await fireEvent.dblClick(screen.getAllByRole('gridcell', { name: 'Reno' })[0]);
		const formulaInput = await screen.findByTestId('cell-input');
		expect(formulaInput).toHaveValue('Reno');
		await fireEvent.input(formulaInput, { target: { value: '=SUM(C2:C4)' } });
		await fireEvent.keyDown(formulaInput, { key: 'Enter' });

		expect(await screen.findByRole('gridcell', { name: '247' })).toBeVisible();
		await fireEvent.click(screen.getByRole('gridcell', { name: '247' }));
		expect(screen.getByTestId('formula-bar')).toHaveValue('=SUM(C2:C4)');
	});

	it('keeps formulas on load: the bar shows the formula, the grid the value', async () => {
		render(XlsxEditor, { ...DARK, data: lanesBytes() });
		expect(await screen.findByRole('gridcell', { name: 'Lane' })).toBeVisible();

		const total = screen.getByRole('gridcell', { name: '7' });
		await fireEvent.click(total);
		expect(screen.getByTestId('active-cell-address')).toHaveTextContent('C6');
		expect(screen.getByTestId('formula-bar')).toHaveValue('=SUM(C3:C5)');
		expect(screen.getByRole('gridcell', { name: '3300' })).toBeVisible();

		// Formulas recalculate when a referenced cell changes.
		await fireEvent.dblClick(screen.getByRole('gridcell', { name: '4' }));
		const input = await screen.findByTestId('cell-input');
		await fireEvent.input(input, { target: { value: '10' } });
		await fireEvent.keyDown(input, { key: 'Enter' });
		expect(await screen.findByRole('gridcell', { name: '13' })).toBeVisible();
	});

	it('shows the saved value for a formula the local evaluator cannot compute', async () => {
		render(XlsxEditor, { ...DARK, data: lanesBytes() });
		await fireEvent.click(await screen.findByRole('tab', { name: 'Totals' }));

		const total = await screen.findByRole('gridcell', { name: '787' });
		await fireEvent.click(total);
		expect(screen.getByTestId('formula-bar')).toHaveValue('=SUM(Inventory!C2:C6)');
	});

	it('keeps true positions on load: A1 origin and blank rows', async () => {
		render(XlsxEditor, { ...DARK, data: lanesBytes() });
		const lane = await screen.findByRole('gridcell', { name: 'Lane' });

		expect(screen.getByTestId('row-count')).toHaveTextContent('6 rows');
		await fireEvent.click(lane);
		expect(screen.getByTestId('active-cell-address')).toHaveTextContent('B2');
		await fireEvent.click(screen.getByRole('gridcell', { name: 'Austin-Reno' }));
		expect(screen.getByTestId('active-cell-address')).toHaveTextContent('B5');
	});

	it('round-trips a workbook with a blank row and data at B2 without moving cells', async () => {
		const onExport = vi.fn();
		render(XlsxEditor, { ...DARK, data: lanesBytes(), onExport });
		await screen.findByRole('gridcell', { name: 'Lane' });

		const workbook = await exportedWorkbook(onExport);
		const lanes = workbook.Sheets['Lanes'] as Record<string, { v?: unknown; f?: string }>;
		expect(lanes['A1']).toBeUndefined();
		expect(lanes['B2']?.v).toBe('Lane');
		expect(lanes['D2']?.v).toBe('Miles');
		expect(lanes['B3']?.v).toBe('Reno-Austin');
		expect(lanes['B4']).toBeUndefined();
		expect(lanes['C4']).toBeUndefined();
		expect(lanes['B5']?.v).toBe('Austin-Reno');
		expect(lanes['C5']?.v).toBe(3);
		expect(lanes['B6']?.v).toBe('Total');
	});

	it('writes formulas back on export with their values', async () => {
		const onExport = vi.fn();
		render(XlsxEditor, { ...DARK, data: lanesBytes(), onExport });
		await screen.findByRole('gridcell', { name: 'Lane' });

		const workbook = await exportedWorkbook(onExport);
		const lanes = workbook.Sheets['Lanes'] as Record<string, { v?: unknown; f?: string }>;
		expect(lanes['C6']).toMatchObject({ f: 'SUM(C3:C5)', v: 7 });
		expect(lanes['D6']).toMatchObject({ f: 'SUM(D3:D5)', v: 3300 });
		const totals = workbook.Sheets['Totals'] as Record<string, { v?: unknown; f?: string }>;
		expect(totals['B2']).toMatchObject({ f: 'SUM(Inventory!C2:C6)', v: 787 });
	});

	it('keeps a text cell that starts with = as text on load and export', async () => {
		const onExport = vi.fn();
		const onCellChange = vi.fn();
		render(XlsxEditor, { ...DARK, data: mixedBytes(), onExport, onCellChange });
		const text = await screen.findByRole('gridcell', { name: '=abc' });

		await fireEvent.click(text);
		expect(screen.getByTestId('formula-bar')).toHaveValue('=abc');
		// Opening and committing the editor unchanged leaves it as text.
		await fireEvent.dblClick(text);
		await fireEvent.keyDown(await screen.findByTestId('cell-input'), { key: 'Enter' });
		expect(onCellChange).not.toHaveBeenCalled();
		expect(screen.getByRole('gridcell', { name: '=abc' })).toBeVisible();

		const sheet = (await exportedWorkbook(onExport)).Sheets['Mixed'] as Record<
			string,
			{ t?: string; v?: unknown; f?: string }
		>;
		expect(sheet['A1']).toMatchObject({ t: 's', v: '=abc' });
		expect(sheet['A1']?.f).toBeUndefined();
	});

	it('turns typed text starting with = into a formula, like upstream', async () => {
		render(XlsxEditor, { ...DARK, data: mixedBytes() });
		await screen.findByRole('gridcell', { name: '=abc' });

		await editCell('=abc', '=B1*3');
		expect(await screen.findByRole('gridcell', { name: '30' })).toBeVisible();
		await fireEvent.click(screen.getByRole('gridcell', { name: '30' }));
		expect(screen.getByTestId('formula-bar')).toHaveValue('=B1*3');
	});

	it("shows the file's saved formula values until an input is edited", async () => {
		const { container } = render(XlsxEditor, { ...DARK, data: mixedBytes() });
		await screen.findByRole('gridcell', { name: '=abc' });

		// SUM ignores TRUE and the text "5" (Excel gives 10), and the stale
		// saved 999 is shown as saved.
		expect(rowTexts(container).slice(4, 6)).toEqual(['10', '999']);

		await editCell([0, 1], '20');
		expect(rowTexts(container).slice(4, 6)).toEqual(['20', '40']);
	});

	it('shows boolean and error results as Excel does', async () => {
		const { container } = render(XlsxEditor, { ...DARK, data: mixedBytes() });
		await screen.findByRole('gridcell', { name: '=abc' });

		expect(rowTexts(container).slice(2)).toEqual(['TRUE', '5', '10', '999', 'TRUE', '#DIV/0!', '#N/A']);
	});

	it('exports formula results and literals with their types', async () => {
		const onExport = vi.fn();
		render(XlsxEditor, { ...DARK, data: mixedBytes(), onExport });
		await screen.findByRole('gridcell', { name: '=abc' });

		const sheet = (await exportedWorkbook(onExport)).Sheets['Mixed'] as Record<
			string,
			{ t?: string; v?: unknown; f?: string; w?: string }
		>;
		expect(sheet['C1']).toMatchObject({ t: 'b', v: true });
		expect(sheet['D1']).toMatchObject({ t: 's', v: '5' });
		expect(sheet['E1']).toMatchObject({ t: 'n', v: 10, f: 'SUM(B1:D1)' });
		expect(sheet['F1']).toMatchObject({ t: 'n', v: 999, f: 'B1*2' });
		expect(sheet['G1']).toMatchObject({ t: 'b', v: true, f: '1=1' });
		expect(sheet['H1']).toMatchObject({ t: 'e', w: '#DIV/0!', f: '1/0' });
		expect(sheet['I1']).toMatchObject({ t: 'e', w: '#N/A' });
	});

	it('resets styles and edits when the source changes to another workbook', async () => {
		const { rerender } = render(XlsxEditor, { ...DARK, data: inventoryBytes() });
		await gridLoaded();
		await fireEvent.click(screen.getByRole('gridcell', { name: 'Resistor kit' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Bold' }));
		expect(screen.getByRole('gridcell', { name: 'Resistor kit' })).toHaveStyle({ fontWeight: '700' });

		// Same sheet names, different file: nothing carries over (upstream
		// remounts with key={src}).
		const other = utils.book_new();
		utils.book_append_sheet(other, utils.aoa_to_sheet([['SKU', 'Item'], ['B-1', 'Fuse box']]), 'Inventory');
		utils.book_append_sheet(other, utils.aoa_to_sheet([['x']]), 'Summary');
		await rerender({
			data: new Uint8Array(write(other, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer)
		});

		const cell = await screen.findByRole('gridcell', { name: 'Fuse box' });
		expect(cell.getAttribute('style') ?? '').not.toContain('font-weight');
		expect(cell).toHaveAttribute('aria-selected', 'false');
		expect(screen.getByTestId('active-cell-address')).toHaveTextContent('—');
	});

	it('keeps focus on the sheet tab when switching sheets from the keyboard', async () => {
		render(XlsxEditor, { ...DARK, data: inventoryBytes() });
		await gridLoaded();
		const inventory = screen.getByRole('tab', { name: 'Inventory' });
		inventory.focus();

		await fireEvent.keyDown(inventory, { key: 'ArrowRight' });
		const summary = screen.getByRole('tab', { name: 'Summary' });
		await fireEvent.click(summary);
		expect(await screen.findByRole('gridcell', { name: 'Total SKUs' })).toBeVisible();
		expect(summary).toHaveFocus();
	});

	it('keeps the selected cell when the active sheet tab is clicked again', async () => {
		render(XlsxEditor, { ...DARK, data: inventoryBytes() });
		await gridLoaded();
		await fireEvent.click(screen.getByRole('gridcell', { name: 'Resistor kit' }));
		expect(screen.getByTestId('active-cell-address')).toHaveTextContent('B2');

		await fireEvent.click(screen.getByRole('tab', { name: 'Inventory' }));
		expect(screen.getByTestId('active-cell-address')).toHaveTextContent('B2');
		expect(screen.getByRole('gridcell', { name: 'Resistor kit' })).toHaveAttribute(
			'aria-selected',
			'true'
		);
	});

	it('accepts className as an alias of class and exports the upstream name', async () => {
		render(XlsxEditorPreview, {
...DARK,
			data: inventoryBytes(),
			class: 'from-class',
			className: 'from-alias'
		});

		const editor = await screen.findByTestId('xlsx-editor');
		expect(editor).toHaveClass('from-class', 'from-alias');
	});

	it('toggles bold on the selected cell', async () => {
		render(XlsxEditor, { ...DARK, data: inventoryBytes() });
		await gridLoaded();

		const bold = screen.getByRole('button', { name: 'Bold' });
		expect(bold).toHaveAttribute('aria-pressed', 'false');

		await fireEvent.click(screen.getByRole('gridcell', { name: 'Resistor kit' }));
		await fireEvent.click(bold);

		expect(bold).toHaveAttribute('aria-pressed', 'true');
		expect(screen.getByRole('gridcell', { name: 'Resistor kit' })).toHaveStyle(
			'font-weight: 700'
		);

		await fireEvent.click(bold);
		expect(bold).toHaveAttribute('aria-pressed', 'false');
		expect(
			screen.getByRole('gridcell', { name: 'Resistor kit' }).style.fontWeight
		).not.toBe('700');
	});

	it('sets text alignment on the selected cell', async () => {
		render(XlsxEditor, { ...DARK, data: inventoryBytes() });
		await gridLoaded();

		await fireEvent.click(screen.getByRole('gridcell', { name: 'Resistor kit' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Align center' }));

		const cell = screen.getByRole('gridcell', { name: 'Resistor kit' });
		expect(cell.style.textAlign).toBe('center');
		expect(screen.getByRole('button', { name: 'Align center' })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
	});

	it('sets a fill color on the selected cell', async () => {
		render(XlsxEditor, { ...DARK, data: inventoryBytes() });
		await gridLoaded();

		await fireEvent.click(screen.getByRole('gridcell', { name: 'Resistor kit' }));
		await fireEvent.input(screen.getByTestId('fill-color'), {
			target: { value: '#ff0000' }
		});

		expect(screen.getByRole('gridcell', { name: 'Resistor kit' }).style.backgroundColor).toBe(
			'rgb(255, 0, 0)'
		);
	});

	it('exports the edited workbook through onExport', async () => {
		const onExport = vi.fn();
		render(XlsxEditor, { ...DARK, data: inventoryBytes(), fileName: 'edited.xlsx', onExport });
		await gridLoaded();

		await fireEvent.dblClick(screen.getByRole('gridcell', { name: 'Resistor kit' }));
		const input = await screen.findByTestId('cell-input');
		await fireEvent.input(input, { target: { value: 'Resistor kit pro' } });
		await fireEvent.keyDown(input, { key: 'Enter' });
		expect(await screen.findByRole('gridcell', { name: 'Resistor kit pro' })).toBeVisible();

		await fireEvent.click(screen.getByTestId('export-button'));
		await waitFor(() => expect(onExport).toHaveBeenCalledTimes(1));
		const [bytes, fileName] = onExport.mock.calls[0] as [Uint8Array, string];
		expect(fileName).toBe('edited.xlsx');

		const workbook = read(bytes, { type: 'array' });
		expect(workbook.SheetNames).toEqual(['Inventory', 'Summary']);
		const rows = utils.sheet_to_json<unknown[]>(workbook.Sheets['Inventory'], { header: 1 });
		expect(rows[1]).toEqual(['A-9001', 'Resistor kit pro', 120, 'Reno']);
	});

	it('switches sheets when a tab is clicked and keeps per-sheet edits', async () => {
		render(XlsxEditor, { ...DARK, data: inventoryBytes() });
		await gridLoaded();

		await fireEvent.dblClick(screen.getByRole('gridcell', { name: 'Resistor kit' }));
		const input = await screen.findByTestId('cell-input');
		await fireEvent.input(input, { target: { value: 'Resistor kit pro' } });
		await fireEvent.keyDown(input, { key: 'Enter' });
		expect(await screen.findByRole('gridcell', { name: 'Resistor kit pro' })).toBeVisible();

		await fireEvent.click(screen.getByRole('tab', { name: 'Summary' }));
		expect(await screen.findByRole('gridcell', { name: 'Total SKUs' })).toBeVisible();
		expect(screen.queryByRole('gridcell', { name: 'Resistor kit pro' })).not.toBeInTheDocument();

		await fireEvent.click(screen.getByRole('tab', { name: 'Inventory' }));
		expect(await screen.findByRole('gridcell', { name: 'Resistor kit pro' })).toBeVisible();
	});

	it('shows an empty state when neither src nor data is given', async () => {
		render(XlsxEditor, DARK);

		expect(await screen.findByText('No workbook to edit')).toBeVisible();
		expect(screen.queryByRole('grid')).not.toBeInTheDocument();
	});

	it('shows an error for empty workbook bytes', async () => {
		render(XlsxEditor, { ...DARK, data: new Uint8Array(0) });

		expect(await screen.findByRole('alert')).toHaveTextContent(
			'Cannot load workbook from empty data'
		);
	});

	it('reflects the parent-controlled dark mode and notifies on toggle', async () => {
		const onIsDarkChange = vi.fn();
		const { unmount } = render(XlsxEditor, {
...DARK,
			data: inventoryBytes(),
			isDark: false,
			onIsDarkChange
		});

		const editor = await screen.findByTestId('xlsx-editor');
		expect(editor).toHaveAttribute('data-dark', 'false');

		const toggle = await screen.findByRole('switch', { name: 'Toggle dark mode' });
		await fireEvent.click(toggle);
		expect(onIsDarkChange).toHaveBeenCalledWith(true);
		unmount();

		render(XlsxEditor, { ...DARK, data: inventoryBytes(), isDark: true });
		expect(await screen.findByTestId('xlsx-editor')).toHaveAttribute('data-dark', 'true');
	});
});
