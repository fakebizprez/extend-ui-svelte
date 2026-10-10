// MIT License — Svelte 5 port of Extend UI pdf-viewer. Upstream: extend-hq/ui (MIT).
// Docs preview smoke test: run in the Vitest client (jsdom) project.
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import PdfViewerPage from './+page.svelte';

describe('pdf-viewer docs page', () => {
	it('renders the viewer previews with the fixture source', async () => {
		render(PdfViewerPage);

		expect(screen.getByRole('heading', { name: 'PDF Viewer' })).toBeVisible();
		// Toolbar shells render before the client-only engine loads the fixture.
		expect(await screen.findAllByRole('toolbar', { name: 'PDF viewer toolbar' })).toHaveLength(
			3
		);
		expect(screen.getByText('Upload a PDF to preview')).toBeVisible();
	});
});
