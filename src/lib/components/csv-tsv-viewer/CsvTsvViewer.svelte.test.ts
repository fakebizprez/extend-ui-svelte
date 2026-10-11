// MIT License — Svelte 5 port of Extend UI csv-viewer. Upstream: extend-hq/ui (MIT).
// Component tests: run in the Vitest client (jsdom) project.
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import CsvTsvViewer from './CsvTsvViewer.svelte';
import { CsvViewer } from './index.js';

const SAMPLE_CSV = `Invoice,Customer,Status
INV-1001,Northstar Supply,Approved
INV-1002,Bluebird Medical,Needs review
INV-1003,Aster Logistics,Approved`;

function dataRows(container: HTMLElement): NodeListOf<HTMLElement> {
	return container.querySelectorAll('tbody tr[data-row-index]');
}

/** Opens the search popover and types a query; resolves once results settle. */
async function search(query: string, expectedLabel: string): Promise<HTMLElement> {
	const trigger = await screen.findByRole('button', { name: 'Search CSV' });
	// Disabled until the data has parsed.
	await waitFor(() => expect(trigger).toBeEnabled());
	await fireEvent.click(trigger);
	const panel = screen.getByRole('dialog', { name: 'Search CSV' });
	const input = within(panel).getByRole('searchbox', { name: 'Search CSV' });
	await fireEvent.input(input, { target: { value: query } });
	await waitFor(() => expect(screen.getByTestId('search-result-label')).toHaveTextContent(expectedLabel));
	return panel;
}

describe('CsvTsvViewer', () => {
	it('lets keyboard users focus the scrollable table', async () => {
		render(CsvTsvViewer, { data: SAMPLE_CSV });
		await screen.findByRole('cell', { name: 'INV-1001' });

		const viewport = screen.getByRole('group', { name: 'CSV table' });
		expect(viewport).toHaveAttribute('tabindex', '0');
		viewport.focus();
		expect(viewport).toHaveFocus();
	});

	it('renders CSV headers and rows', async () => {
		const { container } = render(CsvTsvViewer, { data: SAMPLE_CSV });

		expect(await screen.findByRole('columnheader', { name: 'Invoice' })).toBeVisible();
		expect(screen.getByRole('columnheader', { name: 'Customer' })).toBeVisible();
		expect(screen.getByRole('cell', { name: 'INV-1001' })).toBeVisible();
		expect(screen.getByRole('cell', { name: 'Bluebird Medical' })).toBeVisible();
		expect(dataRows(container)).toHaveLength(3);
	});

	it('parses TSV input', async () => {
		render(CsvTsvViewer, { data: 'name\tage\nAda\t36\nGrace\t85' });

		expect(await screen.findByRole('columnheader', { name: 'name' })).toBeVisible();
		expect(screen.getByRole('cell', { name: 'Grace' })).toBeVisible();
		expect(screen.getByRole('cell', { name: '85' })).toBeVisible();
	});

	it('opens a find popover only when search is enabled', async () => {
		const { unmount } = render(CsvTsvViewer, { data: SAMPLE_CSV });
		await screen.findByRole('cell', { name: 'INV-1001' });
		expect(screen.queryByRole('button', { name: 'Search CSV' })).not.toBeInTheDocument();
		unmount();

		render(CsvTsvViewer, { data: SAMPLE_CSV, search: true });
		const trigger = await screen.findByRole('button', { name: 'Search CSV' });
		expect(trigger).toHaveAttribute('aria-expanded', 'false');
		expect(screen.queryByRole('dialog', { name: 'Search CSV' })).not.toBeInTheDocument();
		await fireEvent.click(trigger);
		expect(trigger).toHaveAttribute('aria-expanded', 'true');
		expect(screen.getByRole('searchbox', { name: 'Search CSV' })).toHaveFocus();
		expect(screen.getByTestId('search-result-label')).toHaveTextContent('No search');
	});

	it('selects only the active match and keeps every row, like upstream', async () => {
		const { container } = render(CsvTsvViewer, { data: SAMPLE_CSV, search: true });
		await search('approved', '1 / 2');

		// Rows are not filtered: upstream searches cells in place.
		expect(dataRows(container)).toHaveLength(3);
		// Upstream selects the active result's cell; other matches are not marked.
		const active = container.querySelectorAll('td[data-search-active]');
		expect([...active].map((cell) => cell.textContent?.trim())).toEqual(['Approved']);
		expect(active[0]?.closest('tr')?.dataset.rowIndex).toBe('0');
		expect(container.querySelectorAll('td.match, td[data-search-match]')).toHaveLength(0);
		expect(screen.getByTestId('search-result-address')).toHaveTextContent('Status!C1');
	});

	it('closes the find popover on Escape and returns focus to the trigger, like upstream', async () => {
		render(CsvTsvViewer, { data: SAMPLE_CSV, search: true });
		const panel = await search('approved', '1 / 2');
		const input = within(panel).getByRole('searchbox', { name: 'Search CSV' });
		expect(input).toHaveFocus();

		await fireEvent.keyDown(input, { key: 'Escape' });
		expect(screen.queryByRole('dialog', { name: 'Search CSV' })).not.toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Search CSV' })).toHaveFocus();
	});

	it('closes the find popover on an outside click, like upstream', async () => {
		render(CsvTsvViewer, { data: SAMPLE_CSV, search: true });
		const panel = await search('approved', '1 / 2');

		// A click inside keeps it open.
		await fireEvent.pointerDown(within(panel).getByRole('button', { name: 'Next result' }));
		expect(screen.getByRole('dialog', { name: 'Search CSV' })).toBeVisible();

		await fireEvent.pointerDown(screen.getByRole('cell', { name: 'INV-1002' }));
		expect(screen.queryByRole('dialog', { name: 'Search CSV' })).not.toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Search CSV' })).toHaveAttribute(
			'aria-expanded',
			'false'
		);
	});

	it('closes the find popover and resets the search when data changes', async () => {
		const { container, rerender } = render(CsvTsvViewer, { data: SAMPLE_CSV, search: true });
		await search('approved', '1 / 2');

		await rerender({ data: 'Load,Status\nL-1,Approved' });
		expect(await screen.findByRole('cell', { name: 'L-1' })).toBeVisible();
		expect(screen.queryByRole('dialog', { name: 'Search CSV' })).not.toBeInTheDocument();
		expect(container.querySelector('td[data-search-active]')).toBeNull();

		await fireEvent.click(screen.getByRole('button', { name: 'Search CSV' }));
		expect(screen.getByRole('searchbox', { name: 'Search CSV' })).toHaveValue('');
		expect(screen.getByTestId('search-result-label')).toHaveTextContent('No search');
	});

	it('steps through results with next and previous, wrapping around', async () => {
		const { container } = render(CsvTsvViewer, { data: SAMPLE_CSV, search: true });
		const panel = await search('approved', '1 / 2');
		const activeText = () =>
			container.querySelector('td[data-search-active]')?.closest('tr')?.dataset.rowIndex;

		await fireEvent.click(within(panel).getByRole('button', { name: 'Next result' }));
		expect(screen.getByTestId('search-result-label')).toHaveTextContent('2 / 2');
		expect(screen.getByTestId('search-result-address')).toHaveTextContent('Status!C3');
		expect(activeText()).toBe('2');

		await fireEvent.click(within(panel).getByRole('button', { name: 'Next result' }));
		expect(screen.getByTestId('search-result-label')).toHaveTextContent('1 / 2');

		await fireEvent.click(within(panel).getByRole('button', { name: 'Previous result' }));
		expect(screen.getByTestId('search-result-label')).toHaveTextContent('2 / 2');

		// Enter goes forward, Shift+Enter back, like upstream.
		const input = within(panel).getByRole('searchbox', { name: 'Search CSV' });
		await fireEvent.keyDown(input, { key: 'Enter' });
		expect(screen.getByTestId('search-result-label')).toHaveTextContent('1 / 2');
		await fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
		expect(screen.getByTestId('search-result-label')).toHaveTextContent('2 / 2');
	});

	it('reports no results and clears the search', async () => {
		const { container } = render(CsvTsvViewer, { data: SAMPLE_CSV, search: true });
		const panel = await search('zzz-no-such-customer', 'No results');
		expect(within(panel).getByRole('button', { name: 'Next result' })).toBeDisabled();

		await fireEvent.click(within(panel).getByRole('button', { name: 'Clear' }));
		expect(within(panel).getByRole('searchbox', { name: 'Search CSV' })).toHaveValue('');
		expect(screen.getByTestId('search-result-label')).toHaveTextContent('No search');
		expect(container.querySelector('td[data-search-active]')).toBeNull();
	});

	it('scrolls the active match into view in a long table', async () => {
		const lines = ['id,value'];
		for (let i = 0; i < 1000; i += 1) lines.push(`row-${i},value-${i}`);
		render(CsvTsvViewer, { data: lines.join('\n'), search: true, height: 340 });
		await screen.findByRole('cell', { name: 'row-0' });
		expect(screen.queryByRole('cell', { name: 'value-900' })).not.toBeInTheDocument();

		await search('value-900', '1 / 1');

		const viewport = screen.getByTestId('csv-viewport');
		// Row 900 is centred: 900 * 34 minus half the viewport less one row.
		expect(viewport.scrollTop).toBe(900 * 34 - (340 - 34) / 2);
		const cell = await screen.findByRole('cell', { name: 'value-900' });
		expect(cell).toHaveAttribute('data-search-active');
	});

	it('accepts className as an alias of class and exports the upstream name', async () => {
		render(CsvViewer, { data: SAMPLE_CSV, class: 'from-class', className: 'from-alias' });

		const viewer = await screen.findByTestId('csv-tsv-viewer');
		expect(viewer).toHaveClass('from-class', 'from-alias');
	});

	it('virtualizes many rows instead of rendering them all', async () => {
		const lines = ['id,value'];
		for (let i = 0; i < 1000; i += 1) lines.push(`row-${i},value-${i}`);
		const { container } = render(CsvTsvViewer, { data: lines.join('\n') });

		expect(await screen.findByRole('columnheader', { name: 'id' })).toBeVisible();
		expect(screen.getByTestId('row-count')).toHaveTextContent('1000 rows');

		const rendered = dataRows(container).length;
		expect(rendered).toBeGreaterThan(0);
		expect(rendered).toBeLessThan(100);
		expect(screen.queryByRole('cell', { name: 'row-999' })).not.toBeInTheDocument();

		const viewport = screen.getByTestId('csv-viewport');
		viewport.scrollTop = 1000 * 34;
		await fireEvent.scroll(viewport);

		expect(await screen.findByRole('cell', { name: 'row-999' })).toBeVisible();
	});

	it('shows an empty state for empty input', async () => {
		render(CsvTsvViewer, { data: '' });

		expect(await screen.findByText('No data to preview')).toBeVisible();
		expect(
			screen.getByText('Pass delimited text with the data prop.', { exact: false })
		).toBeVisible();
		expect(screen.queryByRole('table')).not.toBeInTheDocument();
	});

	it('reflects the parent-controlled dark mode', async () => {
		const { unmount } = render(CsvTsvViewer, { data: SAMPLE_CSV, isDark: false });

		const viewer = await screen.findByTestId('csv-tsv-viewer');
		expect(viewer).toHaveAttribute('data-dark', 'false');
		expect(viewer.classList.contains('dark')).toBe(false);
		unmount();

		render(CsvTsvViewer, { data: SAMPLE_CSV, isDark: true });
		const darkViewer = await screen.findByTestId('csv-tsv-viewer');
		expect(darkViewer).toHaveAttribute('data-dark', 'true');
		expect(darkViewer.classList.contains('dark')).toBe(true);
	});

	it('renders no dark toggle of its own, like upstream; the parent owns the theme', async () => {
		const onIsDarkChange = vi.fn();
		render(CsvTsvViewer, { data: SAMPLE_CSV, search: true, isDark: false, onIsDarkChange });

		await screen.findByRole('cell', { name: 'INV-1001' });
		expect(screen.queryByRole('switch')).not.toBeInTheDocument();
		expect(onIsDarkChange).not.toHaveBeenCalled();
	});
});
