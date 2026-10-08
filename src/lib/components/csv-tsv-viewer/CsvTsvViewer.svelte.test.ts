// MIT License — Svelte 5 port of Extend UI csv-viewer. Upstream: extend-hq/ui (MIT).
// Component tests: run in the Vitest client (jsdom) project.
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import CsvTsvViewer from './CsvTsvViewer.svelte';

const SAMPLE_CSV = `Invoice,Customer,Status
INV-1001,Northstar Supply,Approved
INV-1002,Bluebird Medical,Needs review
INV-1003,Aster Logistics,Approved`;

function dataRows(container: HTMLElement): NodeListOf<HTMLElement> {
	return container.querySelectorAll('tbody tr[data-row-index]');
}

describe('CsvTsvViewer', () => {
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

	it('filters rows through the search box', async () => {
		const { container } = render(CsvTsvViewer, { data: SAMPLE_CSV, search: true });

		const searchBox = await screen.findByRole('searchbox', { name: 'Search table' });
		await fireEvent.input(searchBox, { target: { value: 'bluebird' } });

		expect(await screen.findByRole('cell', { name: 'Bluebird Medical' })).toBeVisible();
		expect(screen.queryByRole('cell', { name: 'Northstar Supply' })).not.toBeInTheDocument();
		expect(dataRows(container)).toHaveLength(1);
		expect(screen.getByTestId('row-count')).toHaveTextContent('1 of 3 rows');
	});

	it('shows a no-results message when the filter matches nothing', async () => {
		render(CsvTsvViewer, { data: SAMPLE_CSV, search: true });

		const searchBox = await screen.findByRole('searchbox', { name: 'Search table' });
		await fireEvent.input(searchBox, { target: { value: 'zzz-no-such-customer' } });

		expect(await screen.findByText('No rows match the current search.')).toBeVisible();
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

	it('notifies the parent when the dark-mode toggle is clicked', async () => {
		const onIsDarkChange = vi.fn();
		render(CsvTsvViewer, { data: SAMPLE_CSV, isDark: false, onIsDarkChange });

		const toggle = await screen.findByRole('switch', { name: 'Toggle dark mode' });
		expect(toggle).toHaveAttribute('aria-checked', 'false');
		await fireEvent.click(toggle);

		expect(onIsDarkChange).toHaveBeenCalledTimes(1);
		expect(onIsDarkChange).toHaveBeenCalledWith(true);
	});
});
