// MIT License — Svelte 5 port of Extend UI csv-viewer. Upstream: extend-hq/ui (MIT).
// Docs preview smoke test: run in the Vitest client (jsdom) project.
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import CsvTsvViewerPage from './+page.svelte';

describe('csv-tsv-viewer docs page', () => {
	it('renders the viewer with sample data', async () => {
		render(CsvTsvViewerPage);

		expect(screen.getByRole('heading', { name: 'CSV/TSV Viewer' })).toBeVisible();
		expect(await screen.findByRole('cell', { name: 'INV-1001' })).toBeVisible();
		expect(screen.getByRole('cell', { name: 'A-9001' })).toBeVisible();
		expect(screen.getByText('No data to preview')).toBeVisible();
	});
});
