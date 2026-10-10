// MIT License — Svelte 5 port of Extend UI pdf-viewer. Upstream: extend-hq/ui (MIT).
// Component tests: run in the Vitest client (jsdom) project.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import PdfViewer from './PdfViewer.svelte';
import PdfViewerOverlayHarness from './PdfViewerOverlayHarness.svelte';

const mockState = vi.hoisted(() => ({ pageCount: 3 }));

vi.mock('#lib/engines/pdf/index.js', () => ({
	createPdfEngine: () => {
		const listeners = new Set<(page: number) => void>();
		const engine = {
			pageCount: 0,
			currentPage: 0,
			load: async () => {
				engine.pageCount = mockState.pageCount;
				engine.currentPage = mockState.pageCount > 0 ? 1 : 0;
				for (const listener of listeners) listener(engine.currentPage);
				return engine.pageCount;
			},
			renderPage: async () => ({ width: 612, height: 792 }),
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
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

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

		expect(await screen.findByTestId('pdf-zoom-label')).toHaveTextContent('100%');

		await fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
		expect(screen.getByTestId('pdf-zoom-label')).toHaveTextContent('125%');

		await fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
		expect(screen.getByTestId('pdf-zoom-label')).toHaveTextContent('75%');
	});

	it('rotates pages through the rotate controls', async () => {
		render(PdfViewer, { src: SRC });

		const viewer = await screen.findByTestId('pdf-viewer');
		expect(viewer).toHaveAttribute('data-rotation', '0');

		await fireEvent.click(screen.getByRole('button', { name: 'Rotate clockwise' }));
		expect(viewer).toHaveAttribute('data-rotation', '90');

		await fireEvent.click(screen.getByRole('button', { name: 'Rotate counter-clockwise' }));
		expect(viewer).toHaveAttribute('data-rotation', '0');
	});

	it('hides the rotate controls when showRotateControls is false', async () => {
		render(PdfViewer, { src: SRC, showRotateControls: false });

		expect(await screen.findByRole('toolbar', { name: 'PDF viewer toolbar' })).toBeVisible();
		expect(screen.queryByRole('button', { name: 'Rotate clockwise' })).not.toBeInTheDocument();
		expect(
			screen.queryByRole('button', { name: 'Rotate counter-clockwise' })
		).not.toBeInTheDocument();
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

	it('applies pageClassName to the matching page wrapper', async () => {
		const { container } = render(PdfViewer, {
			src: SRC,
			pageClassName: (pageNumber: number) => (pageNumber === 2 ? 'custom-page' : undefined)
		});

		expect(await screen.findByText('Page 1 of 3')).toBeVisible();
		const pageTwo = container.querySelector('[data-page-number="2"]');
		expect(pageTwo?.classList.contains('custom-page')).toBe(true);
	});

	it('downloads the document with the resolved file name', async () => {
		const blob = new Blob(['fake-pdf'], { type: 'application/pdf' });
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, blob: async () => blob }));
		const createObjectURL = vi.fn(() => 'blob:mock-pdf');
		const revokeObjectURL = vi.fn();
		Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, writable: true });
		Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURL, writable: true });
		const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
		let downloadAttr = '';
		vi.spyOn(HTMLAnchorElement.prototype, 'setAttribute').mockImplementation(function (
			this: HTMLAnchorElement,
			name: string,
			value: string
		) {
			if (name === 'download') downloadAttr = value;
		});

		render(PdfViewer, { src: SRC, fileName: 'invoice' });
		expect(await screen.findByText('Page 1 of 3')).toBeVisible();

		await fireEvent.click(screen.getByRole('button', { name: 'Download PDF' }));

		expect(fetch).toHaveBeenCalledWith(SRC);
		expect(createObjectURL).toHaveBeenCalledWith(blob);
		expect(click).toHaveBeenCalled();
		expect(downloadAttr).toBe('invoice.pdf');
		expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-pdf');
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

	it('shows an empty state without a source', async () => {
		render(PdfViewer, {});

		expect(await screen.findByText('Upload a PDF to preview')).toBeVisible();
		expect(screen.queryByTestId('pdf-viewport')).not.toBeInTheDocument();
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

	it('notifies the parent when the dark-mode toggle is clicked', async () => {
		const onIsDarkChange = vi.fn();
		render(PdfViewer, { src: SRC, isDark: false, onIsDarkChange });

		const toggle = await screen.findByRole('switch', { name: 'Toggle dark mode' });
		expect(toggle).toHaveAttribute('aria-checked', 'false');
		await fireEvent.click(toggle);

		expect(onIsDarkChange).toHaveBeenCalledTimes(1);
		expect(onIsDarkChange).toHaveBeenCalledWith(true);
	});
});
