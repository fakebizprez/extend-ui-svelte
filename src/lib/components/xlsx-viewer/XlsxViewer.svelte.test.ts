// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
// Component tests: run in the Vitest client (jsdom) project.
import { describe, expect, it, vi, afterEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { utils, write } from 'xlsx';
import XlsxViewer from './XlsxViewer.svelte';
import XlsxEditor from '../xlsx-editor/XlsxEditor.svelte';
import { XlsxViewerPreview, type XlsxViewerProps } from './index.js';

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

function bigSheetBytes(rowCount: number): Uint8Array {
	const workbook = utils.book_new();
	const data: (string | number)[][] = [['id', 'value']];
	for (let i = 0; i < rowCount; i += 1) data.push([`row-${i}`, `value-${i}`]);
	utils.book_append_sheet(workbook, utils.aoa_to_sheet(data), 'Big');
	return new Uint8Array(write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer);
}

/** Data starts at B2 with a blank row 4 (sheet used range B2:D5). */
function offsetBytes(): Uint8Array {
	const workbook = utils.book_new();
	const sheet = {};
	utils.sheet_add_aoa(
		sheet,
		[['Lane', 'Loads'], ['Reno-Austin', 4], [], ['Austin-Reno', 3]],
		{ origin: 'B2' }
	);
	(sheet as Record<string, unknown>)['!ref'] = 'B2:C5';
	utils.book_append_sheet(workbook, sheet, 'Lanes');
	return new Uint8Array(write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer);
}

function renderedRowIndexes(container: HTMLElement): number[] {
	return [...container.querySelectorAll('[data-virtual-index]')].map((el) =>
		Number((el as HTMLElement).dataset.virtualIndex)
	);
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('XlsxViewer', () => {
	it('requires isDark and onIsDarkChange, like upstream XlsxViewerPreview', () => {
		// @ts-expect-error isDark and onIsDarkChange are required
		const missingBoth: XlsxViewerProps = { src: '/fixtures/sample.xlsx' };
		// @ts-expect-error onIsDarkChange is required
		const missingCallback: XlsxViewerProps = { src: '/fixtures/sample.xlsx', isDark: false };
		const complete: XlsxViewerProps = { src: '/fixtures/sample.xlsx', ...DARK };
		expect([missingBoth, missingCallback, complete]).toHaveLength(3);
	});

	it('renders sheet tabs and first-sheet cell values from data bytes', async () => {
		render(XlsxViewer, { ...DARK, data: inventoryBytes() });

		const tablist = await screen.findByRole('tablist', { name: 'Sheets' });
		const tabs = within(tablist).getAllByRole('tab');
		expect(tabs.map((tab) => tab.textContent)).toEqual(['Inventory', 'Summary']);
		expect(tabs[0]).toHaveAttribute('aria-selected', 'true');

		expect(await screen.findByRole('cell', { name: 'Resistor kit' })).toBeVisible();
		expect(screen.getByRole('cell', { name: '120' })).toBeVisible();
		expect(screen.getAllByRole('cell', { name: 'Reno' })).toHaveLength(2);
		expect(screen.getByTestId('row-count')).toHaveTextContent('4 rows');
	});

	it('shows column letters and row numbers with row 1 as data, like upstream', async () => {
		const { container } = render(XlsxViewer, { ...DARK, data: inventoryBytes() });

		expect(await screen.findByRole('columnheader', { name: 'A' })).toBeVisible();
		expect(screen.getByRole('columnheader', { name: 'D' })).toBeVisible();
		expect(screen.queryByRole('columnheader', { name: 'SKU' })).not.toBeInTheDocument();
		const firstRow = container.querySelector('[data-row-index="0"]') as HTMLElement;
		expect(within(firstRow).getByRole('rowheader')).toHaveTextContent('1');
		expect(within(firstRow).getAllByRole('cell').map((cell) => cell.textContent)).toEqual([
			'SKU',
			'Item',
			'Qty',
			'Warehouse'
		]);
	});

	it('keeps true positions: A1 origin and blank rows', async () => {
		const { container } = render(XlsxViewer, { ...DARK, data: offsetBytes() });

		expect(await screen.findByRole('cell', { name: 'Lane' })).toBeVisible();
		expect(screen.getByTestId('row-count')).toHaveTextContent('5 rows');
		expect(screen.getByRole('columnheader', { name: 'C' })).toBeVisible();
		const rowCells = (index: number) =>
			within(container.querySelector(`[data-row-index="${index}"]`) as HTMLElement)
				.getAllByRole('cell')
				.map((cell) => cell.textContent);
		expect(rowCells(0)).toEqual(['', '', '']);
		expect(rowCells(1)).toEqual(['', 'Lane', 'Loads']);
		expect(rowCells(3)).toEqual(['', '', '']);
		expect(rowCells(4)).toEqual(['', 'Austin-Reno', '3']);
	});

	it('shows error and boolean cells as text, like upstream', async () => {
		const workbook = utils.book_new();
		utils.book_append_sheet(
			workbook,
			{
				'!ref': 'A1:C1',
				A1: { t: 'e', v: 7, f: '1/0' },
				B1: { t: 'b', v: true },
				C1: { t: 'n', v: 3 }
			},
			'Errors'
		);
		const bytes = new Uint8Array(write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer);
		const { container } = render(XlsxViewer, { ...DARK, data: bytes });

		await screen.findByRole('cell', { name: '3' });
		const cells = within(container.querySelector('[data-row-index="0"]') as HTMLElement)
			.getAllByRole('cell')
			.map((cell) => cell.textContent);
		expect(cells).toEqual(['#DIV/0!', 'TRUE', '3']);
	});

	it('hides the sheet tabs for a single-sheet workbook in viewer and editor, like upstream', async () => {
		render(XlsxViewer, { ...DARK, data: offsetBytes() });
		render(XlsxEditor, { ...DARK, data: offsetBytes() });

		await screen.findByRole('cell', { name: 'Lane' });
		await screen.findByRole('gridcell', { name: 'Lane' });
		expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
	});

	it('switches sheets from the keyboard', async () => {
		render(XlsxViewer, { ...DARK, data: inventoryBytes() });
		const inventory = await screen.findByRole('tab', { name: 'Inventory' });
		inventory.focus();

		// Arrow keys move focus; pressing the tab (Enter/Space) activates it.
		await fireEvent.keyDown(inventory, { key: 'ArrowRight' });
		const summary = screen.getByRole('tab', { name: 'Summary' });
		expect(summary).toHaveFocus();
		expect(summary).toHaveAttribute('aria-selected', 'false');
		await fireEvent.click(summary);
		expect(await screen.findByRole('cell', { name: 'Total SKUs' })).toBeVisible();
		expect(summary).toHaveAttribute('aria-selected', 'true');
		// The tab strip stays mounted while the sheet loads, so focus stays put.
		expect(summary).toHaveFocus();
	});

	it('reports the same row count as the editor for the same file', async () => {
		const bytes = offsetBytes();
		render(XlsxViewer, { ...DARK, data: bytes });
		render(XlsxEditor, { ...DARK, data: bytes });

		await screen.findByRole('cell', { name: 'Lane' });
		await screen.findByRole('gridcell', { name: 'Lane' });
		const counts = screen.getAllByTestId('row-count').map((el) => el.textContent);
		expect(counts).toEqual(['5 rows', '5 rows']);
	});

	it('accepts className as an alias of class and exports the upstream name', async () => {
		render(XlsxViewerPreview, { ...DARK, data: inventoryBytes(), class: 'from-class', className: 'from-alias' });

		const viewer = await screen.findByTestId('xlsx-viewer');
		expect(viewer).toHaveClass('from-class', 'from-alias');
	});

	it('switches sheets when a tab is clicked', async () => {
		render(XlsxViewer, { ...DARK, data: inventoryBytes() });

		const summaryTab = await screen.findByRole('tab', { name: 'Summary' });
		await fireEvent.click(summaryTab);

		expect(summaryTab).toHaveAttribute('aria-selected', 'true');
		expect(await screen.findByRole('cell', { name: 'Metric' })).toBeVisible();
		expect(screen.getByRole('cell', { name: 'Total SKUs' })).toBeVisible();
		expect(screen.getByRole('cell', { name: '247' })).toBeVisible();
		expect(screen.queryByRole('cell', { name: 'Resistor kit' })).not.toBeInTheDocument();
	});

	it('loads a workbook from a src URL', async () => {
		const bytes = inventoryBytes();
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response(bytes.buffer as ArrayBuffer, { status: 200 }))
		);
		render(XlsxViewer, { ...DARK, src: '/fixtures/sample.xlsx' });

		expect(await screen.findByRole('tab', { name: 'Inventory' })).toBeVisible();
		expect(await screen.findByRole('cell', { name: 'Resistor kit' })).toBeVisible();
		expect(fetch).toHaveBeenCalledWith('/fixtures/sample.xlsx');
	});

	it('virtualizes many rows instead of rendering them all', async () => {
		const { container } = render(XlsxViewer, { ...DARK, data: bigSheetBytes(1000), height: 400 });

		expect(await screen.findByRole('cell', { name: 'id' })).toBeVisible();
		expect(screen.getByTestId('row-count')).toHaveTextContent('1001 rows');

		const rendered = renderedRowIndexes(container);
		expect(rendered.length).toBeGreaterThan(0);
		expect(rendered.length).toBeLessThan(100);
		expect(screen.queryByRole('cell', { name: 'row-999' })).not.toBeInTheDocument();

		const viewport = screen.getByTestId('virtual-viewport');
		viewport.scrollTop = 1001 * 34;
		await fireEvent.scroll(viewport);

		expect(await screen.findByRole('cell', { name: 'row-999' })).toBeVisible();
	});

	it('shows an empty state when neither src nor data is given', async () => {
		render(XlsxViewer, DARK);

		expect(await screen.findByText('No workbook to preview')).toBeVisible();
		expect(screen.queryByRole('table')).not.toBeInTheDocument();
		expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
	});

	it('shows an error for empty workbook bytes', async () => {
		render(XlsxViewer, { ...DARK, data: new Uint8Array(0) });

		expect(await screen.findByRole('alert')).toHaveTextContent(
			'Cannot load workbook from empty data'
		);
	});

	it('shows an error when the src fetch fails', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response('nope', { status: 404, statusText: 'Not Found' }))
		);
		render(XlsxViewer, { ...DARK, src: '/fixtures/missing.xlsx' });

		expect(await screen.findByRole('alert')).toHaveTextContent('Cannot load workbook');
	});

	it('reflects the parent-controlled dark mode', async () => {
		const { unmount } = render(XlsxViewer, { ...DARK, data: inventoryBytes(), isDark: false });

		const viewer = await screen.findByTestId('xlsx-viewer');
		expect(viewer).toHaveAttribute('data-dark', 'false');
		expect(viewer.classList.contains('dark')).toBe(false);
		unmount();

		render(XlsxViewer, { ...DARK, data: inventoryBytes(), isDark: true });
		const darkViewer = await screen.findByTestId('xlsx-viewer');
		expect(darkViewer).toHaveAttribute('data-dark', 'true');
		expect(darkViewer.classList.contains('dark')).toBe(true);
	});

	it('notifies the parent when the dark-mode toggle is clicked', async () => {
		const onIsDarkChange = vi.fn();
		render(XlsxViewer, { ...DARK, data: inventoryBytes(), isDark: false, onIsDarkChange });

		const toggle = await screen.findByRole('switch', { name: 'Toggle dark mode' });
		expect(toggle).toHaveAttribute('aria-checked', 'false');
		await fireEvent.click(toggle);

		expect(onIsDarkChange).toHaveBeenCalledTimes(1);
		expect(onIsDarkChange).toHaveBeenCalledWith(true);
	});
});
