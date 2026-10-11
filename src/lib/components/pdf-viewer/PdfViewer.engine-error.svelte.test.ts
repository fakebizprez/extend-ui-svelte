// MIT License — Svelte 5 port of Extend UI pdf-viewer. Upstream: extend-hq/ui (MIT).
// Regression: a failed engine import used to leave the viewer on "Loading PDF…".
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import PdfViewer from './PdfViewer.svelte';

vi.mock('#lib/engines/pdf/index.js', () => {
	throw new Error('Failed to fetch dynamically imported module');
});

describe('PdfViewer engine failure', () => {
	it.each([
		['with a source', { src: 'https://example.com/files/bank.pdf' }],
		['without a source', {}]
	])('shows upstream\'s engine error %s', async (_label, props) => {
		render(PdfViewer, props);

		expect(await screen.findByRole('alert')).toHaveTextContent(
			/^Unable to load the PDF engine\.$/
		);
		expect(screen.queryByText('Loading PDF…')).not.toBeInTheDocument();
	});
});
