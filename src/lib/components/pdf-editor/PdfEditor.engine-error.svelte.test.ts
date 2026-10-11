// MIT License — Svelte 5 port of Extend UI pdf-editor. Upstream: extend-hq/ui (MIT).
// Regression: a failed engine import used to leave the editor on "Loading PDF…".
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import PdfEditor from './PdfEditor.svelte';

vi.mock('#lib/engines/pdf/index.js', () => {
	throw new Error('Failed to fetch dynamically imported module');
});

describe('PdfEditor engine failure', () => {
	it.each([
		['with a source', { src: 'https://example.com/files/bank.pdf' }],
		['without a source', {}]
	])('shows upstream\'s engine error %s', async (_label, props) => {
		// Upstream only reports document failures through onDocumentLoadError.
		const onDocumentLoadError = vi.fn();
		render(PdfEditor, { ...props, onDocumentLoadError });

		expect(await screen.findByRole('alert')).toHaveTextContent(
			/^The PDF engine could not be loaded\.$/
		);
		expect(screen.queryByText('Loading PDF…')).not.toBeInTheDocument();
		expect(onDocumentLoadError).not.toHaveBeenCalled();
	});
});
