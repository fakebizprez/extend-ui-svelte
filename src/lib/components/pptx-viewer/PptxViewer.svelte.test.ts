// MIT License — Svelte 5 port of Extend UI pptx-viewer. Upstream: extend-hq/ui (MIT).
// Component tests: run in the Vitest client (jsdom) project. The engine is
// mocked because jsdom has no canvas 2D context; real rendering is covered by
// tests/pptx-viewer.e2e.ts against the sample fixture.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import PptxViewer from './PptxViewer.svelte';
import { PptxViewerPreview } from './index.js';

const { mockLoadDeck } = vi.hoisted(() => ({ mockLoadDeck: vi.fn() }));

vi.mock('#lib/engines/pptx/index.js', () => ({
	loadDeck: mockLoadDeck,
	DEFAULT_RENDER_WIDTH: 1280
}));

interface FakeDeck {
	slideCount: number;
	renderSlide: ReturnType<typeof vi.fn>;
	destroy: ReturnType<typeof vi.fn>;
}

function fakeDeck(slideCount: number): FakeDeck {
	return {
		slideCount,
		renderSlide: vi.fn(async (_index: number, canvas: HTMLCanvasElement) => {
			canvas.setAttribute('data-rendered-slide', String(_index));
		}),
		destroy: vi.fn()
	};
}

function stubFetchOk(): ReturnType<typeof vi.fn> {
	const fetchMock = vi.fn(async () => ({
		ok: true,
		status: 200,
		arrayBuffer: async () => new ArrayBuffer(8)
	}));
	vi.stubGlobal('fetch', fetchMock);
	return fetchMock;
}

function slideCanvases(container: HTMLElement): NodeListOf<HTMLCanvasElement> {
	return container.querySelectorAll('canvas[data-testid="slide-canvas"]');
}

beforeEach(() => {
	mockLoadDeck.mockReset();
	mockLoadDeck.mockResolvedValue(fakeDeck(2));
	stubFetchOk();
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('PptxViewer', () => {
	it('shows a loading state while the deck loads, then the slide count', async () => {
		let resolveDeck!: (deck: FakeDeck) => void;
		mockLoadDeck.mockReturnValueOnce(
			new Promise<FakeDeck>((resolve) => {
				resolveDeck = resolve;
			})
		);
		render(PptxViewer, { src: '/sample.pptx' });

		expect(screen.getByRole('status')).toHaveTextContent('Loading presentation');
		resolveDeck(fakeDeck(2));

		expect(await screen.findByTestId('slide-count')).toHaveTextContent('2');
		expect(screen.queryByRole('status')).not.toBeInTheDocument();
	});

	it('renders one canvas per slide once loaded', async () => {
		const deck = fakeDeck(2);
		mockLoadDeck.mockResolvedValueOnce(deck);
		const { container } = render(PptxViewer, { src: '/sample.pptx' });

		expect(await screen.findByTestId('slide-count')).toHaveTextContent('2');
		expect(slideCanvases(container)).toHaveLength(2);
		expect(deck.renderSlide).toHaveBeenCalledTimes(2);
		expect(deck.renderSlide).toHaveBeenCalledWith(
			0,
			expect.any(HTMLCanvasElement),
			expect.any(Number)
		);
		expect(deck.renderSlide).toHaveBeenCalledWith(
			1,
			expect.any(HTMLCanvasElement),
			expect.any(Number)
		);
	});

	it('virtualizes a large deck instead of rendering every slide', async () => {
		mockLoadDeck.mockResolvedValueOnce(fakeDeck(100));
		const { container } = render(PptxViewer, {
			src: '/sample.pptx',
			height: 200,
			slideHeight: 100,
			overscan: 1
		});

		expect(await screen.findByTestId('slide-count')).toHaveTextContent('100');

		const rendered = slideCanvases(container).length;
		expect(rendered).toBeGreaterThan(0);
		expect(rendered).toBeLessThan(10);
		expect(
			container.querySelector('canvas[data-slide-index="99"]')
		).not.toBeInTheDocument();

		const viewport = container.querySelector('[data-testid="virtual-viewport"]');
		expect(viewport).toBeInstanceOf(HTMLElement);
		(viewport as HTMLElement).scrollTop = 100 * 100;
		await fireEvent.scroll(viewport as HTMLElement);

		expect(await screen.findByText('Slide 100 of 100')).toBeInTheDocument();
		expect(
			container.querySelector('canvas[data-slide-index="99"]')
		).toBeInTheDocument();
	});

	it('shows an empty state and loads nothing when no src is given', async () => {
		render(PptxViewer, {});

		expect(await screen.findByText('No presentation to preview')).toBeVisible();
		expect(mockLoadDeck).not.toHaveBeenCalled();
		expect(screen.queryByTestId('slide-count')).not.toBeInTheDocument();
	});

	it('shows an error when the deck fails to load', async () => {
		mockLoadDeck.mockRejectedValueOnce(new Error('not a presentation'));
		render(PptxViewer, { src: '/sample.pptx' });

		expect(await screen.findByRole('alert')).toHaveTextContent('not a presentation');
		expect(screen.queryByTestId('slide-count')).not.toBeInTheDocument();
	});

	it('shows an error when the fetch fails', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => ({ ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) }))
		);
		render(PptxViewer, { src: '/missing.pptx' });

		expect(await screen.findByRole('alert')).toHaveTextContent('404');
		expect(mockLoadDeck).not.toHaveBeenCalled();
	});

	it('displays the file name when given', async () => {
		render(PptxViewer, { src: '/sample.pptx', fileName: 'quarterly-review.pptx' });

		expect(await screen.findByTestId('slide-count')).toHaveTextContent('2');
		expect(screen.getByTestId('presentation-name')).toHaveTextContent('quarterly-review.pptx');
	});

	it('derives the file name from the src when none is given', async () => {
		render(PptxViewer, { src: '/decks/sample.pptx?token=abc' });

		expect(await screen.findByTestId('slide-count')).toHaveTextContent('2');
		expect(screen.getByTestId('presentation-name')).toHaveTextContent('sample.pptx');
	});

	it('hides the toolbar when showToolbar is false but still renders slides', async () => {
		const { container } = render(PptxViewer, { src: '/sample.pptx', showToolbar: false });

		await vi.waitFor(() => {
			expect(slideCanvases(container)).toHaveLength(2);
		});
		expect(screen.queryByTestId('pptx-toolbar')).not.toBeInTheDocument();
	});

	it('reflects the parent-controlled dark mode', async () => {
		const { unmount } = render(PptxViewer, { src: '/sample.pptx', isDark: false });

		const viewer = await screen.findByTestId('pptx-viewer');
		expect(viewer).toHaveAttribute('data-dark', 'false');
		expect(viewer.classList.contains('dark')).toBe(false);
		unmount();

		render(PptxViewer, { src: '/sample.pptx', isDark: true });
		const darkViewer = await screen.findByTestId('pptx-viewer');
		expect(darkViewer).toHaveAttribute('data-dark', 'true');
		expect(darkViewer.classList.contains('dark')).toBe(true);
	});

	it('renders no theme toggle of its own, like upstream', async () => {
		const onIsDarkChange = vi.fn();
		render(PptxViewer, { src: '/sample.pptx', isDark: false, onIsDarkChange });

		expect(await screen.findByTestId('slide-count')).toHaveTextContent('2');
		expect(screen.queryByRole('switch')).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /dark mode/i })).not.toBeInTheDocument();
		expect(onIsDarkChange).not.toHaveBeenCalled();
	});

	it('accepts className as an alias of class on the root', async () => {
		render(PptxViewer, { class: 'from-class', className: 'from-class-name' });

		expect(await screen.findByTestId('pptx-viewer')).toHaveClass(
			'pptx-viewer',
			'from-class',
			'from-class-name'
		);
	});

	it('is exported under the upstream name PptxViewerPreview', () => {
		expect(PptxViewerPreview).toBe(PptxViewer);
	});

	it('renders upstream toolbarActions inside the toolbar', async () => {
		const toolbarActions = createRawSnippet(() => ({
			render: () => '<button type="button">Share deck</button>'
		}));
		render(PptxViewer, { src: '/sample.pptx', toolbarActions });

		const toolbar = await screen.findByTestId('pptx-toolbar');
		expect(toolbar).toContainElement(screen.getByRole('button', { name: 'Share deck' }));
	});

	it('downloads a URL source by fetching it as a blob, like upstream', async () => {
		const blob = new Blob(['pptx']);
		const fetchMock = vi.fn(async () => ({
			ok: true,
			status: 200,
			arrayBuffer: async () => new ArrayBuffer(8),
			blob: async () => blob
		}));
		vi.stubGlobal('fetch', fetchMock);
		vi.stubGlobal(
			'URL',
			Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:pptx'), revokeObjectURL: vi.fn() })
		);
		const clicked: string[] = [];
		const click = vi
			.spyOn(HTMLAnchorElement.prototype, 'click')
			.mockImplementation(function (this: HTMLAnchorElement) {
				clicked.push(`${this.href}|${this.download}`);
			});
		try {
			render(PptxViewer, { src: '/decks/quarterly' });
			expect(await screen.findByTestId('slide-count')).toHaveTextContent('2');

			await fireEvent.click(screen.getByRole('button', { name: 'Download' }));

			await vi.waitFor(() => expect(clicked).toEqual(['blob:pptx|quarterly.pptx']));
			expect(fetchMock).toHaveBeenLastCalledWith('/decks/quarterly');
		} finally {
			click.mockRestore();
		}
	});

	it('hides download and upload controls when disabled', async () => {
		render(PptxViewer, { src: '/sample.pptx', showDownload: false, showUpload: false });

		expect(await screen.findByTestId('slide-count')).toHaveTextContent('2');
		expect(screen.queryByRole('button', { name: 'Download' })).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Upload' })).not.toBeInTheDocument();
		expect(screen.queryByTestId('pptx-file-input')).not.toBeInTheDocument();
	});

	it('loads an uploaded presentation in place of the src', async () => {
		render(PptxViewer, { src: '/sample.pptx' });
		expect(await screen.findByTestId('slide-count')).toHaveTextContent('2');
		mockLoadDeck.mockResolvedValueOnce(fakeDeck(5));

		const input = screen.getByTestId('pptx-file-input') as HTMLInputElement;
		expect(input).toHaveAttribute('accept', expect.stringContaining('.pptx'));
		const file = new File([new Uint8Array([1, 2, 3])], 'board.pptx');
		await fireEvent.change(input, { target: { files: [file] } });

		await vi.waitFor(() => expect(screen.getByTestId('slide-count')).toHaveTextContent('5'));
		expect(screen.getByTestId('presentation-name')).toHaveTextContent('board.pptx');
		expect(Array.from(mockLoadDeck.mock.lastCall?.[0] as Uint8Array)).toEqual([1, 2, 3]);
	});

	it('a new src replaces an uploaded presentation, like upstream', async () => {
		const { rerender } = render(PptxViewer, { src: '/sample.pptx' });
		expect(await screen.findByTestId('slide-count')).toHaveTextContent('2');
		mockLoadDeck.mockResolvedValueOnce(fakeDeck(5));
		const input = screen.getByTestId('pptx-file-input') as HTMLInputElement;
		await fireEvent.change(input, { target: { files: [new File(['x'], 'board.pptx')] } });
		await vi.waitFor(() => expect(screen.getByTestId('slide-count')).toHaveTextContent('5'));

		mockLoadDeck.mockResolvedValueOnce(fakeDeck(3));
		await rerender({ src: '/other.pptx' });

		await vi.waitFor(() => expect(screen.getByTestId('slide-count')).toHaveTextContent('3'));
		expect(screen.getByTestId('presentation-name')).toHaveTextContent('other.pptx');
	});

	it('destroys the deck on unmount', async () => {
		const deck = fakeDeck(2);
		mockLoadDeck.mockResolvedValueOnce(deck);
		const { unmount } = render(PptxViewer, { src: '/sample.pptx' });

		expect(await screen.findByTestId('slide-count')).toHaveTextContent('2');
		unmount();

		expect(deck.destroy).toHaveBeenCalled();
	});
});
