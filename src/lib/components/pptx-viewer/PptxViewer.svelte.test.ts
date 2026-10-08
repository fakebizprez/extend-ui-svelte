// MIT License — Svelte 5 port of Extend UI pptx-viewer. Upstream: extend-hq/ui (MIT).
// Component tests: run in the Vitest client (jsdom) project. The engine is
// mocked because jsdom has no canvas 2D context; real rendering is covered by
// tests/pptx-viewer.e2e.ts against the sample fixture.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import PptxViewer from './PptxViewer.svelte';

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

	it('notifies the parent when the dark-mode toggle is clicked', async () => {
		const onIsDarkChange = vi.fn();
		render(PptxViewer, { src: '/sample.pptx', isDark: false, onIsDarkChange });

		const toggle = await screen.findByRole('switch', { name: 'Toggle dark mode' });
		expect(toggle).toHaveAttribute('aria-checked', 'false');
		await fireEvent.click(toggle);

		expect(onIsDarkChange).toHaveBeenCalledTimes(1);
		expect(onIsDarkChange).toHaveBeenCalledWith(true);
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
