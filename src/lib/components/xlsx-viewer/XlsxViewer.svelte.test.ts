// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
// Component tests: run in the Vitest client (jsdom) project.
import { describe, expect, it, vi, afterEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { utils, write } from 'xlsx';
import XlsxViewer from './XlsxViewer.svelte';

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

function renderedRowIndexes(container: HTMLElement): number[] {
	return [...container.querySelectorAll('[data-virtual-index]')].map((el) =>
		Number((el as HTMLElement).dataset.virtualIndex)
	);
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('XlsxViewer', () => {
	it('renders sheet tabs and first-sheet cell values from data bytes', async () => {
		render(XlsxViewer, { data: inventoryBytes() });

		const tablist = await screen.findByRole('tablist', { name: 'Sheets' });
		const tabs = within(tablist).getAllByRole('tab');
		expect(tabs.map((tab) => tab.textContent)).toEqual(['Inventory', 'Summary']);
		expect(tabs[0]).toHaveAttribute('aria-selected', 'true');

		expect(await screen.findByRole('columnheader', { name: 'SKU' })).toBeVisible();
		expect(screen.getByRole('columnheader', { name: 'Warehouse' })).toBeVisible();
		expect(screen.getByRole('cell', { name: 'Resistor kit' })).toBeVisible();
		expect(screen.getByRole('cell', { name: '120' })).toBeVisible();
		expect(screen.getAllByRole('cell', { name: 'Reno' })).toHaveLength(2);
		expect(screen.getByTestId('row-count')).toHaveTextContent('3 rows');
	});

	it('switches sheets when a tab is clicked', async () => {
		render(XlsxViewer, { data: inventoryBytes() });

		const summaryTab = await screen.findByRole('tab', { name: 'Summary' });
		await fireEvent.click(summaryTab);

		expect(summaryTab).toHaveAttribute('aria-selected', 'true');
		expect(await screen.findByRole('columnheader', { name: 'Metric' })).toBeVisible();
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
		render(XlsxViewer, { src: '/fixtures/sample.xlsx' });

		expect(await screen.findByRole('tab', { name: 'Inventory' })).toBeVisible();
		expect(await screen.findByRole('cell', { name: 'Resistor kit' })).toBeVisible();
		expect(fetch).toHaveBeenCalledWith('/fixtures/sample.xlsx');
	});

	it('virtualizes many rows instead of rendering them all', async () => {
		const { container } = render(XlsxViewer, { data: bigSheetBytes(1000), height: 400 });

		expect(await screen.findByRole('columnheader', { name: 'id' })).toBeVisible();
		expect(screen.getByTestId('row-count')).toHaveTextContent('1000 rows');

		const rendered = renderedRowIndexes(container);
		expect(rendered.length).toBeGreaterThan(0);
		expect(rendered.length).toBeLessThan(100);
		expect(screen.queryByRole('cell', { name: 'row-999' })).not.toBeInTheDocument();

		const viewport = screen.getByTestId('virtual-viewport');
		viewport.scrollTop = 1000 * 34;
		await fireEvent.scroll(viewport);

		expect(await screen.findByRole('cell', { name: 'row-999' })).toBeVisible();
	});

	it('shows an empty state when neither src nor data is given', async () => {
		render(XlsxViewer, {});

		expect(await screen.findByText('No workbook to preview')).toBeVisible();
		expect(screen.queryByRole('table')).not.toBeInTheDocument();
		expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
	});

	it('shows an error for empty workbook bytes', async () => {
		render(XlsxViewer, { data: new Uint8Array(0) });

		expect(await screen.findByRole('alert')).toHaveTextContent(
			'Cannot load workbook from empty data'
		);
	});

	it('shows an error when the src fetch fails', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response('nope', { status: 404, statusText: 'Not Found' }))
		);
		render(XlsxViewer, { src: '/fixtures/missing.xlsx' });

		expect(await screen.findByRole('alert')).toHaveTextContent('Cannot load workbook');
	});

	it('reflects the parent-controlled dark mode', async () => {
		const { unmount } = render(XlsxViewer, { data: inventoryBytes(), isDark: false });

		const viewer = await screen.findByTestId('xlsx-viewer');
		expect(viewer).toHaveAttribute('data-dark', 'false');
		expect(viewer.classList.contains('dark')).toBe(false);
		unmount();

		render(XlsxViewer, { data: inventoryBytes(), isDark: true });
		const darkViewer = await screen.findByTestId('xlsx-viewer');
		expect(darkViewer).toHaveAttribute('data-dark', 'true');
		expect(darkViewer.classList.contains('dark')).toBe(true);
	});

	it('notifies the parent when the dark-mode toggle is clicked', async () => {
		const onIsDarkChange = vi.fn();
		render(XlsxViewer, { data: inventoryBytes(), isDark: false, onIsDarkChange });

		const toggle = await screen.findByRole('switch', { name: 'Toggle dark mode' });
		expect(toggle).toHaveAttribute('aria-checked', 'false');
		await fireEvent.click(toggle);

		expect(onIsDarkChange).toHaveBeenCalledTimes(1);
		expect(onIsDarkChange).toHaveBeenCalledWith(true);
	});
});
