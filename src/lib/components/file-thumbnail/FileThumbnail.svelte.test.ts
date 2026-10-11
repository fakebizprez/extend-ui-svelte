// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
// Tests for FileThumbnail, ported from apps/v4/components/extend/file-thumbnail.tsx.
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import FileThumbnail from './FileThumbnail.svelte';
import { FileThumbnail as FileThumbnailExport } from './index.js';

// A US Letter page (612x792 pt): portrait, so width/height is below 1.
const LETTER = { width: 612, height: 792 };
vi.mock('../../engines/pdf/index.js', () => ({
	createPdfEngine: () => ({
		load: async () => 3,
		renderPage: async (_page: number, _canvas: HTMLCanvasElement, options?: { scale?: number }) => ({
			width: LETTER.width * (options?.scale ?? 1),
			height: LETTER.height * (options?.scale ?? 1)
		}),
		destroy: async () => {}
	})
}));

const customPreview = () =>
	createRawSnippet(() => ({ render: () => '<span>custom preview content</span>' }));

describe('FileThumbnail', () => {
	it('renders the thumbnail shell with a square preview region by default', () => {
		const { container } = render(FileThumbnail, {
			file: { name: 'report.pdf', type: 'application/pdf' }
		});

		expect(screen.getByTestId('file-thumbnail')).toBeInTheDocument();
		const preview = screen.getByTestId('file-thumbnail-preview');
		expect(preview).toBeInTheDocument();
		expect(preview.style.aspectRatio).toContain('1');
		expect(container.firstElementChild).toHaveClass('file-thumbnail');
	});

	it('shows the loading overlay while isLoading', () => {
		render(FileThumbnail, {
			file: { name: 'report.pdf', type: 'application/pdf' },
			isLoading: true
		});

		expect(screen.getByTestId('file-thumbnail-loading')).toBeInTheDocument();
		expect(screen.queryByTestId('file-thumbnail-fallback')).not.toBeInTheDocument();
	});

	it('shows the fallback when hasError', () => {
		render(FileThumbnail, {
			file: { name: 'report.pdf', type: 'application/pdf' },
			hasError: true
		});

		expect(screen.getByTestId('file-thumbnail-fallback')).toBeInTheDocument();
		expect(screen.queryByTestId('file-thumbnail-loading')).not.toBeInTheDocument();
	});

	it('shows the fallback when there is no preview source at all', () => {
		render(FileThumbnail, {
			file: { name: 'notes.txt', type: 'text/plain' }
		});

		expect(screen.getByTestId('file-thumbnail-fallback')).toBeInTheDocument();
	});

	it('renders a lazy preview image while it loads', () => {
		render(FileThumbnail, {
			file: { name: 'photo.png', type: 'image/png' },
			previewImageUrl: 'https://example.com/photo.png'
		});

		const image = screen.getByTestId('file-thumbnail-image') as HTMLImageElement;
		expect(image).toBeInTheDocument();
		expect(image.getAttribute('src')).toBe('https://example.com/photo.png');
		expect(image.getAttribute('loading')).toBe('lazy');
		expect(image.getAttribute('decoding')).toBe('async');
		expect(image).toHaveAttribute('alt', '');
		expect(screen.getByTestId('file-thumbnail-loading')).toBeInTheDocument();
	});

	it('reveals the preview image once it loads with real dimensions', async () => {
		render(FileThumbnail, {
			file: { name: 'photo.png', type: 'image/png' },
			previewImageUrl: 'https://example.com/loaded.png'
		});

		const image = screen.getByTestId('file-thumbnail-image') as HTMLImageElement;
		Object.defineProperty(image, 'naturalWidth', { configurable: true, value: 120 });
		Object.defineProperty(image, 'naturalHeight', { configurable: true, value: 80 });
		await fireEvent.load(image);

		await vi.waitFor(() => {
			expect(screen.queryByTestId('file-thumbnail-loading')).not.toBeInTheDocument();
		});
		expect(screen.getByTestId('file-thumbnail-image')).toBeInTheDocument();
		expect(screen.queryByTestId('file-thumbnail-fallback')).not.toBeInTheDocument();
	});

	it('falls back when the preview image fails to load', async () => {
		render(FileThumbnail, {
			file: { name: 'photo.png', type: 'image/png' },
			previewImageUrl: 'https://example.com/missing.png'
		});

		await fireEvent.error(screen.getByTestId('file-thumbnail-image'));

		await vi.waitFor(() => {
			expect(screen.getByTestId('file-thumbnail-fallback')).toBeInTheDocument();
		});
		expect(screen.queryByTestId('file-thumbnail-loading')).not.toBeInTheDocument();
	});

	it('renders custom preview content from the previewContent snippet', () => {
		render(FileThumbnail, {
			file: { name: 'demo.docx', type: 'application/msword' },
			previewContent: customPreview()
		});

		expect(screen.getByText('custom preview content')).toBeInTheDocument();
		expect(screen.queryByTestId('file-thumbnail-fallback')).not.toBeInTheDocument();
	});

	it('applies an explicit preview aspect ratio and class names', () => {
		render(FileThumbnail, {
			file: { name: 'attention.pdf', type: 'application/pdf' },
			className: 'custom-shell',
			previewAspectRatio: 0.77,
			previewClassName: 'custom-preview'
		});

		expect(screen.getByTestId('file-thumbnail')).toHaveClass('custom-shell');
		const preview = screen.getByTestId('file-thumbnail-preview');
		expect(preview).toHaveClass('custom-preview');
		expect(preview.style.aspectRatio).toContain('0.77');
	});

	it('pdf mode renders a canvas and starts in the loading state', () => {
		render(FileThumbnail, {
			file: { name: 'sample.pdf', type: 'application/pdf' },
			pdfUrl: '/fixtures/sample.pdf',
			pageNumber: 2,
			width: 200
		});

		const canvas = screen.getByTestId('file-thumbnail-canvas') as HTMLCanvasElement;
		expect(canvas).toBeInTheDocument();
		expect(canvas.tagName).toBe('CANVAS');
		expect(screen.getByTestId('file-thumbnail-loading')).toBeInTheDocument();
		expect(screen.queryByTestId('file-thumbnail-fallback')).not.toBeInTheDocument();
	});

	it('applies the dark class when isDark is true', async () => {
		const { rerender } = render(FileThumbnail, {
			file: { name: 'report.pdf', type: 'application/pdf' },
			isDark: false
		});

		expect(screen.getByTestId('file-thumbnail')).not.toHaveClass('dark');

		await rerender({ isDark: true });

		expect(screen.getByTestId('file-thumbnail')).toHaveClass('dark');
	});

	it('renders no buttons of its own, so it can sit inside a parent button', () => {
		const { container } = render(FileThumbnail, {
			file: { name: 'report.pdf', type: 'application/pdf' },
			pdfUrl: '/fixtures/sample.pdf',
			isDark: false,
			onIsDarkChange: vi.fn()
		});

		expect(container.querySelectorAll('button')).toHaveLength(0);
		expect(screen.queryByText(/^(Dark|Light)$/)).not.toBeInTheDocument();
	});

	it('accepts class alongside the upstream className on the root', () => {
		render(FileThumbnail, {
			file: { name: 'report.pdf', type: 'application/pdf' },
			class: 'from-class',
			className: 'from-class-name'
		});

		expect(screen.getByTestId('file-thumbnail')).toHaveClass(
			'file-thumbnail',
			'from-class',
			'from-class-name'
		);
	});

	it('is exported under the upstream name FileThumbnail', () => {
		expect(FileThumbnailExport).toBe(FileThumbnail);
	});

	it('falls back to a blank muted surface, like upstream', () => {
		render(FileThumbnail, { file: { name: 'notes.txt', type: 'text/plain' }, hasError: true });

		expect(screen.getByTestId('file-thumbnail-fallback')).toBeEmptyDOMElement();
	});

	it('pdf mode sizes the preview to the page shape as width / height', async () => {
		render(FileThumbnail, {
			file: { name: 'sample.pdf', type: 'application/pdf' },
			pdfUrl: '/fixtures/sample.pdf',
			width: 240
		});

		const preview = screen.getByTestId('file-thumbnail-preview');
		await vi.waitFor(() => {
			expect(screen.queryByTestId('file-thumbnail-loading')).not.toBeInTheDocument();
		});
		// CSS aspect-ratio is width / height; a portrait page must be below 1.
		expect(parseFloat(preview.style.aspectRatio)).toBeCloseTo(LETTER.width / LETTER.height, 3);
	});
});

describe('file-thumbnail docs', () => {
	it('lists every port-only export under Differences from upstream', async () => {
		const exports = Object.keys(await import('./index.js'));
		const page = (await import('../../../routes/file-thumbnail/+page.svelte?raw')).default as string;
		const differences = page.slice(page.indexOf('Differences from upstream'));
		// Runtime exports of upstream components/extend/file-thumbnail.tsx.
		const upstream = new Set(['default', 'FileThumbnail', 'FileThumbnailLoadingOverlay']);
		const missing = exports.filter(
			(name) => !upstream.has(name) && !differences.includes(`<code>${name}</code>`)
		);
		expect(missing).toEqual([]);
	});
});
