// MIT License — Svelte 5 port of Extend UI pdf-viewer. Upstream: extend-hq/ui (MIT).
// Component tests: run in the Vitest client (jsdom) project.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { PDFDocument } from 'pdf-lib';
import PdfViewer from './PdfViewer.svelte';
import * as barrel from './index.js';
import PdfViewerOverlayHarness from './PdfViewerOverlayHarness.svelte';

type Size = { width: number; height: number };
const mockState = vi.hoisted(() => ({
	pageCount: 3,
	// Page sizes reported by the engine; null leaves getPageSizes off the mock.
	sizes: null as Size[] | null,
	loads: [] as unknown[],
	loadError: null as Error | null
}));

vi.mock('../../engines/pdf/index.js', () => ({
	createPdfEngine: () => {
		const listeners = new Set<(page: number) => void>();
		const engine = {
			pageCount: 0,
			currentPage: 0,
			load: async (source: unknown) => {
				mockState.loads.push(source);
				if (mockState.loadError) throw mockState.loadError;
				engine.pageCount = mockState.pageCount;
				engine.currentPage = mockState.pageCount > 0 ? 1 : 0;
				for (const listener of listeners) listener(engine.currentPage);
				return engine.pageCount;
			},
			renderPage: async () => ({ width: 612, height: 792 }),
			...(mockState.sizes ? { getPageSizes: async () => mockState.sizes } : {}),
			setCurrentPage: (page: number) => {
				const clamped = Math.min(Math.max(Math.floor(page), 1), engine.pageCount);
				if (engine.currentPage !== clamped) {
					engine.currentPage = clamped;
					for (const listener of listeners) listener(clamped);
				}
			},
			onPageChange: (handler: (page: number) => void) => {
				listeners.add(handler);
				return () => {
					listeners.delete(handler);
				};
			},
			destroy: async () => {
				engine.pageCount = 0;
				engine.currentPage = 0;
			}
		};
		return engine;
	}
}));

const SRC = 'https://example.com/files/bank.pdf';

beforeEach(() => {
	mockState.pageCount = 3;
	mockState.sizes = null;
	mockState.loads = [];
	mockState.loadError = null;
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
	delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
	delete (HTMLElement.prototype as { clientHeight?: number }).clientHeight;
});

const LETTER = { width: 612, height: 792 };
const LANDSCAPE = { width: 792, height: 612 };

/** Give the scroll viewport a measured size (jsdom has no layout). */
function stubViewportSize(size: { width: number; height: number }): void {
	for (const [key, axis] of [
		['clientWidth', 'width'],
		['clientHeight', 'height']
	] as const) {
		Object.defineProperty(HTMLElement.prototype, key, {
			configurable: true,
			get(this: HTMLElement) {
				return this.dataset.testid === 'pdf-viewport' ? size[axis] : 0;
			}
		});
	}
}

/** Capture ResizeObserver callbacks so tests can simulate a resize. */
function stubResizeObserver(): () => void {
	const callbacks: Array<() => void> = [];
	vi.stubGlobal(
		'ResizeObserver',
		class {
			constructor(callback: () => void) {
				callbacks.push(callback);
			}
			observe(): void {}
			disconnect(): void {}
		}
	);
	return () => callbacks.forEach((callback) => callback());
}

function pageBox(container: HTMLElement, pageNumber: number): HTMLElement {
	const page = container.querySelector<HTMLElement>(`[data-page-number="${pageNumber}"]`);
	if (!page) throw new Error(`Page ${pageNumber} is not rendered`);
	return page;
}

function stubDownload(response: { blob?: () => Promise<Blob>; arrayBuffer?: () => Promise<ArrayBuffer> }) {
	vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, ...response }));
	const saved: { blob: Blob | null; name: string } = { blob: null, name: '' };
	Object.defineProperty(URL, 'createObjectURL', {
		value: vi.fn((blob: Blob) => {
			saved.blob = blob;
			return 'blob:mock-pdf';
		}),
		writable: true
	});
	Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), writable: true });
	vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
		this: HTMLAnchorElement
	) {
		saved.name = this.download;
	});
	return saved;
}

function pages(container: HTMLElement): NodeListOf<HTMLElement> {
	return container.querySelectorAll('[data-testid="pdf-page"]');
}

describe('PdfViewer', () => {
	it('renders the toolbar with a page indicator after the document loads', async () => {
		const onDocumentLoadSuccess = vi.fn();
		render(PdfViewer, { src: SRC, onDocumentLoadSuccess });

		expect(await screen.findByRole('toolbar', { name: 'PDF viewer toolbar' })).toBeVisible();
		expect(await screen.findByText('Page 1 of 3')).toBeVisible();
		expect(onDocumentLoadSuccess).toHaveBeenCalledTimes(1);
		expect(onDocumentLoadSuccess).toHaveBeenCalledWith(3);
	});

	it('changes the zoom label through the zoom controls', async () => {
		render(PdfViewer, { src: SRC });

		// Zoom resets to defaultZoom when the document loads, so wait for it first.
		expect(await screen.findByText('Page 1 of 3')).toBeVisible();
		expect(screen.getByTestId('pdf-zoom-label')).toHaveTextContent('100%');

		await fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
		expect(screen.getByTestId('pdf-zoom-label')).toHaveTextContent('125%');

		await fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
		expect(screen.getByTestId('pdf-zoom-label')).toHaveTextContent('75%');
	});

	it('rotates the active page with the upstream rotate controls', async () => {
		mockState.sizes = [LETTER, LETTER, LETTER];
		const { container } = render(PdfViewer, { src: SRC });

		expect(await screen.findByText('Page 1 of 3')).toBeVisible();
		await fireEvent.click(screen.getByRole('button', { name: 'Rotate clockwise' }));

		expect(pageBox(container, 1)).toHaveAttribute('data-rotation', '90');
		expect(pageBox(container, 1).style.width).toBe('792px');
		expect(pageBox(container, 1).style.height).toBe('612px');
		expect(pageBox(container, 2)).toHaveAttribute('data-rotation', '0');

		await fireEvent.click(screen.getByRole('button', { name: 'Rotate counterclockwise' }));
		expect(pageBox(container, 1)).toHaveAttribute('data-rotation', '0');
		expect(pageBox(container, 1).style.width).toBe('612px');
	});

	it('hides the rotate controls when showRotateControls is false', async () => {
		render(PdfViewer, { src: SRC, showRotateControls: false });

		expect(await screen.findByRole('toolbar', { name: 'PDF viewer toolbar' })).toBeVisible();
		expect(screen.queryByRole('button', { name: 'Rotate clockwise' })).not.toBeInTheDocument();
		expect(
			screen.queryByRole('button', { name: 'Rotate counterclockwise' })
		).not.toBeInTheDocument();
	});

	it('lays pages out at their real sizes from the engine', async () => {
		mockState.sizes = [LETTER, LANDSCAPE, LETTER];
		const { container } = render(PdfViewer, { src: SRC, pageGap: 10 });

		expect(await screen.findByText('Page 1 of 3')).toBeVisible();
		await vi.waitFor(() => expect(pageBox(container, 2).style.width).toBe('792px'));
		expect(pageBox(container, 2).style.height).toBe('612px');
		expect(pageBox(container, 1).style.height).toBe('792px');
		const slots = [...container.querySelectorAll<HTMLElement>('.pdf-slot')];
		expect(slots.map((slot) => slot.style.top)).toEqual(['10px', '812px', '1434px']);
	});

	it('falls back to pageWidth and pageHeight when sizes cannot be read', async () => {
		const { container } = render(PdfViewer, { src: SRC, pageWidth: 500, pageHeight: 700 });

		expect(await screen.findByText('Page 1 of 3')).toBeVisible();
		expect(pageBox(container, 1).style.width).toBe('500px');
		expect(pageBox(container, 1).style.height).toBe('700px');
	});

	it('keeps the point at the viewport centre fixed when zooming, like EmbedPDF', async () => {
		mockState.sizes = [LETTER, LETTER, LETTER];
		render(PdfViewer, { src: SRC, pageGap: 0, height: 600 });

		expect(await screen.findByText('Page 1 of 3')).toBeVisible();
		const viewport = screen.getByTestId('pdf-viewport');
		viewport.scrollTop = 792;
		await fireEvent.scroll(viewport);
		expect(screen.getByTestId('pdf-page-indicator')).toHaveTextContent('Page 2 of 3');

		await fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
		// Centre was 300px into page 2 (top 792); at 125% page 2 starts at 990 and that
		// point sits 375px in, so the new scroll top is 990 + 375 - 300.
		await vi.waitFor(() => expect(viewport.scrollTop).toBe(1065));
		await fireEvent.scroll(viewport);
		expect(screen.getByTestId('pdf-page-indicator')).toHaveTextContent('Page 2 of 3');
	});

	it('keeps the active page centre fixed when rotating, like upstream', async () => {
		mockState.sizes = [LETTER, LETTER, LETTER];
		render(PdfViewer, { src: SRC, pageGap: 0, height: 600 });

		expect(await screen.findByText('Page 1 of 3')).toBeVisible();
		const viewport = screen.getByTestId('pdf-viewport');
		viewport.scrollTop = 900;
		await fireEvent.scroll(viewport);
		expect(screen.getByTestId('pdf-page-indicator')).toHaveTextContent('Page 2 of 3');

		await fireEvent.click(screen.getByRole('button', { name: 'Rotate clockwise' }));
		// Page 2 shrinks from 792 to 612 tall; upstream scrolls by half the change.
		await vi.waitFor(() => expect(viewport.scrollTop).toBe(810));
	});

	it('offers the upstream zoom modes and steps in the zoom dropdown', async () => {
		render(PdfViewer, { src: SRC });

		const select = await screen.findByRole('combobox', { name: 'Zoom level' });
		const labels = within(select)
			.getAllByRole('option')
			.map((option) => option.textContent);
		expect(labels).toEqual([
			'Fit page',
			'Fit width',
			'Automatic',
			'10%',
			'25%',
			'50%',
			'75%',
			'100%',
			'125%',
			'150%',
			'200%'
		]);
	});

	it('computes fit width from the viewport and page size and follows resizes', async () => {
		mockState.sizes = [LETTER, LETTER, LETTER];
		stubViewportSize({ width: 800, height: 600 });
		const resize = stubResizeObserver();
		const { container } = render(PdfViewer, { src: SRC, defaultZoom: 'fit-width', pageGap: 24 });

		expect(await screen.findByText('Page 1 of 3')).toBeVisible();
		// (800 - 2 * 24) / 612 = 1.228
		await vi.waitFor(() => expect(screen.getByTestId('pdf-zoom-label')).toHaveTextContent('123%'));
		expect(pageBox(container, 1).style.width).toBe(`${612 * 1.228}px`);
		expect(screen.getByRole('combobox', { name: 'Zoom level' })).toHaveValue('fit-width');

		stubViewportSize({ width: 400, height: 600 });
		resize();
		// (400 - 48) / 612 = 0.575, which upstream's Math.round shows as 57%
		await vi.waitFor(() => expect(screen.getByTestId('pdf-zoom-label')).toHaveTextContent('57%'));
	});

	it('switches zoom mode from the dropdown', async () => {
		mockState.sizes = [LETTER, LETTER, LETTER];
		stubViewportSize({ width: 800, height: 600 });
		render(PdfViewer, { src: SRC });

		const select = await screen.findByRole('combobox', { name: 'Zoom level' });
		expect(await screen.findByText('Page 1 of 3')).toBeVisible();
		expect(screen.getByTestId('pdf-zoom-label')).toHaveTextContent('100%');

		await fireEvent.change(select, { target: { value: 'fit-page' } });
		// min(752 / 612, 552 / 792) = 0.696
		expect(screen.getByTestId('pdf-zoom-label')).toHaveTextContent('70%');

		await fireEvent.change(select, { target: { value: 'automatic' } });
		expect(screen.getByTestId('pdf-zoom-label')).toHaveTextContent('100%');

		await fireEvent.change(select, { target: { value: '1.5' } });
		expect(screen.getByTestId('pdf-zoom-label')).toHaveTextContent('150%');
	});

	it('navigates pages and reports the active page', async () => {
		const onActivePageChange = vi.fn();
		render(PdfViewer, { src: SRC, onActivePageChange });

		expect(await screen.findByText('Page 1 of 3')).toBeVisible();

		await fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
		expect(screen.getByTestId('pdf-page-indicator')).toHaveTextContent('Page 2 of 3');
		expect(onActivePageChange).toHaveBeenCalledWith(2);

		await fireEvent.click(screen.getByRole('button', { name: 'Previous page' }));
		expect(screen.getByTestId('pdf-page-indicator')).toHaveTextContent('Page 1 of 3');
		expect(onActivePageChange).toHaveBeenCalledWith(1);
	});

	it('reports the active page when the user scrolls', async () => {
		const onActivePageChange = vi.fn();
		render(PdfViewer, { src: SRC, onActivePageChange, pageHeight: 800, pageGap: 0 });

		expect(await screen.findByText('Page 1 of 3')).toBeVisible();

		const viewport = screen.getByTestId('pdf-viewport');
		viewport.scrollTop = 1600;
		await fireEvent.scroll(viewport);

		expect(screen.getByTestId('pdf-page-indicator')).toHaveTextContent('Page 3 of 3');
		expect(onActivePageChange).toHaveBeenCalledWith(3);
	});

	it('renders the page overlay snippet for visible pages', async () => {
		render(PdfViewerOverlayHarness, { src: SRC });

		const overlays = await screen.findAllByTestId('test-overlay');
		expect(overlays.length).toBeGreaterThan(0);
		expect(overlays[0]).toHaveTextContent('Overlay page 1 @ 1x');
	});

	it('keeps overlays in unrotated page space and rotates them with the page, like upstream', async () => {
		mockState.sizes = [LETTER, LETTER, LETTER];
		const { container } = render(PdfViewerOverlayHarness, { src: SRC });

		expect(await screen.findByText('Page 1 of 3')).toBeVisible();
		expect((await screen.findAllByTestId('test-overlay'))[0]).toHaveTextContent('612x792 r0');
		await fireEvent.click(screen.getByRole('button', { name: 'Rotate clockwise' }));

		const overlay = screen.getAllByTestId('test-overlay')[0]!;
		expect(overlay).toHaveTextContent('Overlay page 1 @ 1x, 612x792 r90');
		const layer = pageBox(container, 1).querySelector<HTMLElement>('.pdf-page-overlay')!;
		expect(layer.style.width).toBe('612px');
		expect(layer.style.height).toBe('792px');
		expect(layer.style.transform).toContain('rotate(90deg)');
	});

	it('reports the most visible page as active, like EmbedPDF', async () => {
		mockState.sizes = [LETTER, LETTER, LETTER];
		render(PdfViewer, { src: SRC, pageGap: 0, height: 600 });

		expect(await screen.findByText('Page 1 of 3')).toBeVisible();
		const viewport = screen.getByTestId('pdf-viewport');
		// 700..1300 shows 12% of page 1 and 64% of page 2.
		viewport.scrollTop = 700;
		await fireEvent.scroll(viewport);
		expect(screen.getByTestId('pdf-page-indicator')).toHaveTextContent('Page 2 of 3');
	});

	it('keeps a requested page active while its own scroll lands, like EmbedPDF', async () => {
		// Three 100px pages all fit in view, so scrolling alone would pick page 1.
		mockState.sizes = [
			{ width: 100, height: 100 },
			{ width: 100, height: 100 },
			{ width: 100, height: 100 }
		];
		render(PdfViewer, { src: SRC, pageGap: 0, height: 600 });

		expect(await screen.findByText('Page 1 of 3')).toBeVisible();
		await fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
		const viewport = screen.getByTestId('pdf-viewport');
		await fireEvent.scroll(viewport);
		expect(screen.getByTestId('pdf-page-indicator')).toHaveTextContent('Page 2 of 3');

		viewport.scrollTop = 0;
		await fireEvent.scroll(viewport);
		expect(screen.getByTestId('pdf-page-indicator')).toHaveTextContent('Page 1 of 3');
	});

	it('shows upstream\'s load error message instead of the raw PDF.js text', async () => {
		mockState.loadError = new Error('Missing PDF "https://example.com/files/secret.pdf".');
		render(PdfViewer, { src: SRC });

		const alert = await screen.findByRole('alert');
		expect(alert).toHaveTextContent(/^Unable to load the PDF preview\.$/);
		expect(alert.textContent).not.toContain('secret.pdf');
	});

	it('applies pageClassName to the matching page wrapper', async () => {
		const { container } = render(PdfViewer, {
			src: SRC,
			pageClassName: (pageNumber: number) => (pageNumber === 2 ? 'custom-page' : undefined)
		});

		expect(await screen.findByText('Page 1 of 3')).toBeVisible();
		const pageTwo = container.querySelector('[data-page-number="2"]');
		expect(pageTwo?.classList.contains('custom-page')).toBe(true);
	});

	it('downloads the original file when no page is rotated', async () => {
		const blob = new Blob(['fake-pdf'], { type: 'application/pdf' });
		const saved = stubDownload({ blob: async () => blob });

		render(PdfViewer, { src: SRC, fileName: 'invoice' });
		expect(await screen.findByText('Page 1 of 3')).toBeVisible();

		await fireEvent.click(screen.getByRole('button', { name: 'Download PDF' }));

		await vi.waitFor(() => expect(saved.name).toBe('invoice.pdf'));
		expect(fetch).toHaveBeenCalledWith(SRC);
		expect(saved.blob).toBe(blob);
	});

	it('saves page rotations into the download with pdf-lib, like upstream', async () => {
		const source = await PDFDocument.create();
		source.addPage([100, 100]);
		source.addPage([200, 200]);
		source.addPage([300, 300]);
		const bytes = await source.save();
		const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
		const saved = stubDownload({ arrayBuffer: async () => buffer as ArrayBuffer });

		render(PdfViewer, { src: SRC, fileName: 'invoice' });
		expect(await screen.findByText('Page 1 of 3')).toBeVisible();
		await fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Rotate clockwise' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Download PDF' }));

		await vi.waitFor(() => expect(saved.name).toBe('invoice-rotated.pdf'));
		const exported = await PDFDocument.load(new Uint8Array(await saved.blob!.arrayBuffer()));
		expect(exported.getPages().map((page) => page.getRotation().angle)).toEqual([0, 90, 0]);
	});

	it('notifies the parent on upload and loads the chosen file', async () => {
		const onPdfUpload = vi.fn();
		Object.defineProperty(URL, 'createObjectURL', {
			value: vi.fn(() => 'blob:mock-upload'),
			writable: true
		});
		render(PdfViewer, { onPdfUpload });

		expect(await screen.findByText('Upload a PDF to preview')).toBeVisible();

		const file = new File(['fake-pdf'], 'upload.pdf', { type: 'application/pdf' });
		const input = screen.getByLabelText('Upload PDF');
		await fireEvent.change(input, { target: { files: [file] } });

		expect(onPdfUpload).toHaveBeenCalledTimes(1);
		expect(onPdfUpload).toHaveBeenCalledWith(file);
		expect(await screen.findByText('Page 1 of 3')).toBeVisible();
	});

	it('lets a new src replace an uploaded file, like upstream', async () => {
		Object.defineProperty(URL, 'createObjectURL', {
			value: vi.fn(() => 'blob:mock-upload'),
			writable: true
		});
		Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), writable: true });
		const { rerender } = render(PdfViewer, { src: SRC });
		expect(await screen.findByText('Page 1 of 3')).toBeVisible();

		const file = new File(['fake-pdf'], 'upload.pdf', { type: 'application/pdf' });
		await fireEvent.change(screen.getByLabelText('Upload PDF'), { target: { files: [file] } });
		await vi.waitFor(() => expect(mockState.loads.at(-1)).toBe('blob:mock-upload'));

		await rerender({ src: 'https://example.com/files/next.pdf' });
		await vi.waitFor(() => expect(mockState.loads.at(-1)).toBe('https://example.com/files/next.pdf'));
		expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-upload');
	});

	it('resets zoom to defaultZoom when a new document loads, like upstream', async () => {
		const { rerender } = render(PdfViewer, { src: SRC, defaultZoom: 1 });
		expect(await screen.findByText('Page 1 of 3')).toBeVisible();
		await fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
		expect(screen.getByTestId('pdf-zoom-label')).toHaveTextContent('125%');

		await rerender({ src: 'https://example.com/files/next.pdf', defaultZoom: 1 });
		await vi.waitFor(() => expect(mockState.loads).toHaveLength(2));
		await vi.waitFor(() => expect(screen.getByTestId('pdf-zoom-label')).toHaveTextContent('100%'));
	});

	it('virtualizes many pages instead of rendering them all', async () => {
		mockState.pageCount = 100;
		const { container } = render(PdfViewer, { src: SRC, height: 600, pageHeight: 800 });

		expect(await screen.findByText('Page 1 of 100')).toBeVisible();
		const rendered = pages(container).length;
		expect(rendered).toBeGreaterThan(0);
		expect(rendered).toBeLessThan(20);
		expect(container.querySelector('[data-page-number="100"]')).not.toBeInTheDocument();

		const viewport = screen.getByTestId('pdf-viewport');
		viewport.scrollTop = 100 * 824;
		await fireEvent.scroll(viewport);

		expect(container.querySelector('[data-page-number="100"]')).toBeInTheDocument();
		expect(pages(container).length).toBeLessThan(20);
	});

	it('shows the upstream empty state without a source', async () => {
		render(PdfViewer, {});

		expect(await screen.findByText('Upload a PDF to preview')).toBeVisible();
		expect(screen.getByTestId('pdf-page-indicator')).toHaveTextContent('Page 1 of –');
		expect(screen.queryByTestId('pdf-viewport')).not.toBeInTheDocument();
		expect(screen.getByRole('combobox', { name: 'Zoom level' })).toBeDisabled();
	});

	it('exports the upstream PDFViewer name as an alias', () => {
		expect(barrel.PDFViewer).toBe(PdfViewer);
		expect(barrel.PdfViewer).toBe(PdfViewer);
	});

	it('accepts className as an alias of class', async () => {
		render(PdfViewer, { src: SRC, class: 'from-class', className: 'from-classname' });

		const viewer = await screen.findByTestId('pdf-viewer');
		expect(viewer).toHaveClass('from-class', 'from-classname');
	});

	it('hides the toolbar when showToolbar is false', async () => {
		render(PdfViewer, { src: SRC, showToolbar: false });

		expect(await screen.findByTestId('pdf-viewer')).toBeInTheDocument();
		expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
	});

	it('reflects the parent-controlled dark mode', async () => {
		const { unmount } = render(PdfViewer, { src: SRC, isDark: false });

		const viewer = await screen.findByTestId('pdf-viewer');
		expect(viewer).toHaveAttribute('data-dark', 'false');
		expect(viewer.classList.contains('dark')).toBe(false);
		unmount();

		render(PdfViewer, { src: SRC, isDark: true });
		const darkViewer = await screen.findByTestId('pdf-viewer');
		expect(darkViewer).toHaveAttribute('data-dark', 'true');
		expect(darkViewer.classList.contains('dark')).toBe(true);
	});

	it('does not render its own dark-mode toggle', async () => {
		render(PdfViewer, { src: SRC, isDark: false, onIsDarkChange: vi.fn() });

		expect(await screen.findByText('Page 1 of 3')).toBeVisible();
		expect(screen.queryByRole('switch', { name: 'Toggle dark mode' })).not.toBeInTheDocument();
	});
});

describe('pdf-viewer docs', () => {
	it('lists every port-only export under Differences from upstream', async () => {
		const exports = Object.keys(await import('./index.js'));
		const page = (await import('../../../routes/pdf-viewer/+page.svelte?raw')).default as string;
		const differences = page.slice(page.indexOf('Differences from upstream'));
		// Runtime exports of upstream components/extend/pdf-viewer.tsx.
		const upstream = new Set(['default', 'PDFViewer']);
		const missing = exports.filter(
			(name) => !upstream.has(name) && !differences.includes(`<code>${name}</code>`)
		);
		expect(missing).toEqual([]);
	});
});

it('lets keyboard users focus the document scroll viewport', async () => {
	render(PdfViewer, { src: SRC, isDark: false, onIsDarkChange: () => {} });
	expect(await screen.findByTestId('pdf-viewport')).toHaveAttribute('tabindex', '0');
});
