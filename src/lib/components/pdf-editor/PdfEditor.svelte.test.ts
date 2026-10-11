// MIT License — Svelte 5 port of Extend UI pdf-editor. Upstream: extend-hq/ui (MIT).
// Component tests: run in the Vitest client (jsdom) project.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { PDFDocument } from 'pdf-lib';
import PdfEditor from './PdfEditor.svelte';
import * as barrel from './index.js';

type Size = { width: number; height: number };
const mockState = vi.hoisted(() => ({
	pageCount: 3,
	sizes: null as Size[] | null,
	loads: [] as unknown[]
}));

vi.mock('../../engines/pdf/index.js', () => ({
	createPdfEngine: () => {
		const listeners = new Set<(page: number) => void>();
		const engine = {
			pageCount: 0,
			currentPage: 0,
			load: async (source: unknown) => {
				mockState.loads.push(source);
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
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
	delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
	delete (HTMLElement.prototype as { clientHeight?: number }).clientHeight;
});

const LETTER = { width: 612, height: 792 };
const LANDSCAPE = { width: 792, height: 612 };

/** Give the preview pane a measured size (jsdom has no layout). */
function stubPreviewSize(size: { width: number; height: number }): void {
	for (const [key, axis] of [
		['clientWidth', 'width'],
		['clientHeight', 'height']
	] as const) {
		Object.defineProperty(HTMLElement.prototype, key, {
			configurable: true,
			get(this: HTMLElement) {
				return this.dataset.testid === 'pdf-editor-preview' ? size[axis] : 0;
			}
		});
	}
}

function previewPage(): HTMLElement {
	const page = screen
		.getByTestId('pdf-editor-preview')
		.querySelector<HTMLElement>('[data-testid="pdf-page"]');
	if (!page) throw new Error('No preview page rendered');
	return page;
}

function sourceOrder(container: HTMLElement): number[] {
	return [...container.querySelectorAll('[data-testid="pdf-editor-page"]')].map((entry) =>
		Number((entry as HTMLElement).dataset.sourcePage)
	);
}

async function sourcePdfBytes(): Promise<Uint8Array> {
	const doc = await PDFDocument.create();
	doc.addPage([100, 100]);
	doc.addPage([200, 200]);
	doc.addPage([300, 300]);
	return await doc.save();
}

describe('PdfEditor', () => {
	it('loads the document and lists one entry per page', async () => {
		const onDocumentLoadSuccess = vi.fn();
		const { container } = render(PdfEditor, { src: SRC, onDocumentLoadSuccess });

		expect(await screen.findByText('Page 1 of 3')).toBeVisible();
		expect(sourceOrder(container)).toEqual([1, 2, 3]);
		expect(onDocumentLoadSuccess).toHaveBeenCalledTimes(1);
		expect(onDocumentLoadSuccess).toHaveBeenCalledWith({
			numPages: 3,
			documentId: expect.any(String),
			fileName: 'bank.pdf'
		});
	});

	it('loads ArrayBuffer, Uint8Array and Blob sources like upstream', async () => {
		const bytes = await sourcePdfBytes();
		const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
		const cases: Array<{ src: ArrayBuffer | Uint8Array | Blob; fileName?: string; name: string }> = [
			{ src: buffer as ArrayBuffer, name: 'document.pdf' },
			{ src: bytes, fileName: 'contract', name: 'contract.pdf' },
			{ src: new File([bytes as BlobPart], 'scan.pdf', { type: 'application/pdf' }), name: 'scan.pdf' }
		];
		for (const { src, fileName, name } of cases) {
			mockState.loads = [];
			const onDocumentLoadSuccess = vi.fn();
			const { unmount } = render(PdfEditor, { src, fileName, onDocumentLoadSuccess });

			expect(await screen.findByText('Page 1 of 3')).toBeVisible();
			const loaded = mockState.loads.at(-1);
			expect(loaded).toBeInstanceOf(Uint8Array);
			expect([...(loaded as Uint8Array).subarray(0, 5)]).toEqual([...bytes.subarray(0, 5)]);
			expect(onDocumentLoadSuccess).toHaveBeenCalledWith({
				numPages: 3,
				documentId: expect.any(String),
				fileName: name
			});
			unmount();
		}
	});

	it('gives each loaded document its own id', async () => {
		const ids: string[] = [];
		const first = render(PdfEditor, { src: SRC, onDocumentLoadSuccess: (info) => ids.push(info.documentId) });
		expect(await screen.findByText('Page 1 of 3')).toBeVisible();
		first.unmount();
		render(PdfEditor, { src: SRC, onDocumentLoadSuccess: (info) => ids.push(info.documentId) });
		expect(await screen.findByText('Page 1 of 3')).toBeVisible();

		expect(ids).toHaveLength(2);
		expect(ids[0]).not.toBe(ids[1]);
	});

	it('starts at fit width by default, like upstream', async () => {
		mockState.sizes = [LETTER, LETTER, LETTER];
		stubPreviewSize({ width: 800, height: 600 });
		render(PdfEditor, { src: SRC });

		expect(await screen.findByText('Page 1 of 3')).toBeVisible();
		// (800 - 2 * 24) / 612 = 1.228
		await vi.waitFor(() =>
			expect(screen.getByTestId('pdf-editor-zoom-label')).toHaveTextContent('123%')
		);
		expect(screen.getByRole('combobox', { name: 'Zoom level' })).toHaveValue('fit-width');
	});

	it('offers the upstream editor zoom modes and presets, stepping by range', async () => {
		render(PdfEditor, { src: SRC, defaultZoom: 1 });

		const select = await screen.findByRole('combobox', { name: 'Zoom level' });
		expect(await screen.findByText('Page 1 of 3')).toBeVisible();
		expect(within(select).getAllByRole('option').map((option) => option.textContent)).toEqual([
			'Fit page',
			'Fit width',
			'Automatic',
			'25%',
			'50%',
			'75%',
			'100%',
			'125%',
			'150%',
			'200%',
			'300%',
			'400%'
		]);

		await fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
		expect(screen.getByTestId('pdf-editor-zoom-label')).toHaveTextContent('120%');
		await fireEvent.change(select, { target: { value: '3' } });
		expect(screen.getByTestId('pdf-editor-zoom-label')).toHaveTextContent('300%');
	});

	it('resets zoom to defaultZoom when a new document loads, like upstream', async () => {
		const { rerender } = render(PdfEditor, { src: SRC, defaultZoom: 1 });
		expect(await screen.findByText('Page 1 of 3')).toBeVisible();
		await fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
		expect(screen.getByTestId('pdf-editor-zoom-label')).toHaveTextContent('120%');

		await rerender({ src: 'https://example.com/files/next.pdf', defaultZoom: 1 });
		await vi.waitFor(() => expect(mockState.loads).toHaveLength(2));
		await vi.waitFor(() =>
			expect(screen.getByTestId('pdf-editor-zoom-label')).toHaveTextContent('100%')
		);
	});

	it('reports the active page when delete or move changes the selection', async () => {
		const onActivePageChange = vi.fn();
		render(PdfEditor, { src: SRC, onActivePageChange });
		expect(await screen.findByText('Page 1 of 3')).toBeVisible();

		await fireEvent.click(screen.getByRole('button', { name: 'Select page 3' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Delete page 3' }));
		expect(screen.getByTestId('pdf-editor-page-indicator')).toHaveTextContent('Page 2 of 2');
		expect(onActivePageChange.mock.calls).toEqual([[1], [3], [2]]);

		// The selection follows its page: page 2 moves up to position 1.
		await fireEvent.click(screen.getByRole('button', { name: 'Move page 2 up' }));
		expect(screen.getByTestId('pdf-editor-page-indicator')).toHaveTextContent('Page 1 of 2');
		expect(onActivePageChange).toHaveBeenLastCalledWith(1);

		// Deleting a page above the selection shifts it up too.
		await fireEvent.click(screen.getByRole('button', { name: 'Select page 1' }));
		expect(onActivePageChange).toHaveBeenLastCalledWith(2);
		await fireEvent.click(screen.getByRole('button', { name: 'Delete page 2' }));
		expect(screen.getByTestId('pdf-editor-page-indicator')).toHaveTextContent('Page 1 of 1');
		expect(onActivePageChange).toHaveBeenLastCalledWith(1);
	});

	it('handles upstream\'s keyboard shortcuts inside the editor', async () => {
		const bytes = await sourcePdfBytes();
		Object.defineProperty(URL, 'createObjectURL', { value: vi.fn(() => 'blob:x'), writable: true });
		Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), writable: true });
		vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
		const onSave = vi.fn();
		render(PdfEditor, { src: bytes, defaultZoom: 1, onSave });
		expect(await screen.findByText('Page 1 of 3')).toBeVisible();
		const editor = screen.getByTestId('pdf-editor');
		const label = screen.getByTestId('pdf-editor-zoom-label');

		expect(await fireEvent.keyDown(editor, { key: '=', metaKey: true })).toBe(false);
		expect(label).toHaveTextContent('120%');
		await fireEvent.keyDown(editor, { key: '-', ctrlKey: true });
		expect(label).toHaveTextContent('100%');
		await fireEvent.keyDown(editor, { key: '0', metaKey: true });
		expect(screen.getByRole('combobox', { name: 'Zoom level' })).toHaveValue('fit-page');

		// Typing targets keep their own keys.
		await fireEvent.keyDown(screen.getByRole('combobox', { name: 'Zoom level' }), {
			key: '=',
			metaKey: true
		});
		expect(screen.getByRole('combobox', { name: 'Zoom level' })).toHaveValue('fit-page');

		await fireEvent.keyDown(editor, { key: 's', metaKey: true });
		await vi.waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
	});

	it('previews the selected page at its real size', async () => {
		mockState.sizes = [LETTER, LANDSCAPE, LETTER];
		render(PdfEditor, { src: SRC, defaultZoom: 1 });

		expect(await screen.findByText('Page 1 of 3')).toBeVisible();
		await fireEvent.click(screen.getByRole('button', { name: 'Select page 2' }));

		await vi.waitFor(() => expect(previewPage().style.width).toBe('792px'));
		expect(previewPage().style.height).toBe('612px');
		await fireEvent.click(screen.getByRole('button', { name: 'Rotate page 2 clockwise' }));
		expect(previewPage().style.width).toBe('612px');
		expect(previewPage().style.height).toBe('792px');
	});

	it('rotates a page and reports the edited state', async () => {
		const onPagesChange = vi.fn();
		const { container } = render(PdfEditor, { src: SRC, onPagesChange });

		expect(await screen.findByText('Page 1 of 3')).toBeVisible();
		await fireEvent.click(screen.getByRole('button', { name: 'Rotate page 1 clockwise' }));

		const entries = container.querySelectorAll('[data-testid="pdf-editor-page"]');
		expect(entries[0]).toHaveAttribute('data-rotation', '90');
		expect(onPagesChange).toHaveBeenCalledTimes(1);
		expect(onPagesChange).toHaveBeenLastCalledWith([
			{ sourcePage: 1, rotation: 90 },
			{ sourcePage: 2, rotation: 0 },
			{ sourcePage: 3, rotation: 0 }
		]);
	});

	it('deletes a page and updates the indicator', async () => {
		const onPagesChange = vi.fn();
		const { container } = render(PdfEditor, { src: SRC, onPagesChange });

		expect(await screen.findByText('Page 1 of 3')).toBeVisible();
		await fireEvent.click(screen.getByRole('button', { name: 'Delete page 2' }));

		expect(screen.getByTestId('pdf-editor-page-indicator')).toHaveTextContent('Page 1 of 2');
		expect(sourceOrder(container)).toEqual([1, 3]);
		expect(onPagesChange).toHaveBeenLastCalledWith([
			{ sourcePage: 1, rotation: 0 },
			{ sourcePage: 3, rotation: 0 }
		]);
	});

	it('reorders pages with the move controls', async () => {
		const onPagesChange = vi.fn();
		const { container } = render(PdfEditor, { src: SRC, onPagesChange });

		expect(await screen.findByText('Page 1 of 3')).toBeVisible();
		await fireEvent.click(screen.getByRole('button', { name: 'Move page 1 down' }));

		expect(sourceOrder(container)).toEqual([2, 1, 3]);
		expect(onPagesChange).toHaveBeenLastCalledWith([
			{ sourcePage: 2, rotation: 0 },
			{ sourcePage: 1, rotation: 0 },
			{ sourcePage: 3, rotation: 0 }
		]);

		await fireEvent.click(screen.getByRole('button', { name: 'Move page 1 up' }));
		expect(sourceOrder(container)).toEqual([1, 2, 3]);
	});

	it('resets every edit back to the original document', async () => {
		const { container } = render(PdfEditor, { src: SRC });

		expect(await screen.findByText('Page 1 of 3')).toBeVisible();
		await fireEvent.click(screen.getByRole('button', { name: 'Delete page 2' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Rotate page 1 clockwise' }));
		expect(sourceOrder(container)).toEqual([1, 3]);

		await fireEvent.click(screen.getByRole('button', { name: 'Reset edits' }));
		expect(screen.getByTestId('pdf-editor-page-indicator')).toHaveTextContent('Page 1 of 3');
		expect(sourceOrder(container)).toEqual([1, 2, 3]);
		const entries = container.querySelectorAll('[data-testid="pdf-editor-page"]');
		expect(entries[0]).toHaveAttribute('data-rotation', '0');
	});

	it('selects a page and reports the active page', async () => {
		const onActivePageChange = vi.fn();
		render(PdfEditor, { src: SRC, onActivePageChange });

		expect(await screen.findByText('Page 1 of 3')).toBeVisible();
		const entries = screen.getAllByTestId('pdf-editor-page');
		await fireEvent.click(within(entries[1] as HTMLElement).getByRole('button', { name: 'Select page 2' }));

		expect(screen.getByTestId('pdf-editor-page-indicator')).toHaveTextContent('Page 2 of 3');
		expect(onActivePageChange).toHaveBeenCalledWith(2);
	});

	it('exports the edited document and triggers a download', async () => {
		const bytes = await sourcePdfBytes();
		const sourceBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => sourceBuffer })
		);
		let capturedBlob: Blob | null = null;
		Object.defineProperty(URL, 'createObjectURL', {
			value: vi.fn((blob: Blob) => {
				capturedBlob = blob;
				return 'blob:mock-edited';
			}),
			writable: true
		});
		Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), writable: true });
		const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
		let downloadAttr = '';
		vi.spyOn(HTMLAnchorElement.prototype, 'setAttribute').mockImplementation(function (
			this: HTMLAnchorElement,
			name: string,
			value: string
		) {
			if (name === 'download') downloadAttr = value;
		});
		const onSave = vi.fn();

		render(PdfEditor, { src: SRC, fileName: 'edited-bank', onSave });
		expect(await screen.findByText('Page 1 of 3')).toBeVisible();

		await fireEvent.click(screen.getByRole('button', { name: 'Delete page 3' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Rotate page 1 clockwise' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Download' }));

		expect(fetch).toHaveBeenCalledWith(SRC);
		await vi.waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
		expect(onSave).toHaveBeenCalledWith(
			expect.objectContaining({ fileName: 'edited-bank.pdf' })
		);
		expect(onSave.mock.calls[0][0].buffer).toBeInstanceOf(ArrayBuffer);
		expect(click).toHaveBeenCalled();
		expect(downloadAttr).toBe('edited-bank.pdf');
		expect(capturedBlob).not.toBeNull();
		const exported = await PDFDocument.load(
			new Uint8Array(await (capturedBlob as unknown as Blob).arrayBuffer())
		);
		expect(exported.getPageCount()).toBe(2);
		expect(exported.getPage(0).getRotation().angle).toBe(90);
		expect(exported.getPage(1).getSize().width).toBe(200);
	});

	it('disables export once every page is deleted', async () => {
		render(PdfEditor, { src: SRC });

		expect(await screen.findByText('Page 1 of 3')).toBeVisible();
		await fireEvent.click(screen.getByRole('button', { name: 'Delete page 1' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Delete page 2' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Delete page 3' }));

		expect(screen.getByRole('button', { name: 'Download' })).toBeDisabled();
		expect(screen.getByTestId('pdf-editor-page-indicator')).toHaveTextContent('Page 1 of –');
	});

	it('virtualizes a long page list instead of rendering every entry', async () => {
		mockState.pageCount = 100;
		const { container } = render(PdfEditor, { src: SRC });

		expect(await screen.findByText('Page 1 of 100')).toBeVisible();
		const rendered = container.querySelectorAll('[data-testid="pdf-editor-page"]').length;
		expect(rendered).toBeGreaterThan(0);
		expect(rendered).toBeLessThan(30);
	});

	it('shows an empty state without a source', async () => {
		render(PdfEditor, {});

		expect(await screen.findByText('Upload a PDF to edit')).toBeVisible();
		expect(screen.queryByTestId('pdf-editor-page-list')).not.toBeInTheDocument();
	});

	it('downloads edits of a byte source without fetching', async () => {
		const bytes = await sourcePdfBytes();
		vi.stubGlobal('fetch', vi.fn());
		Object.defineProperty(URL, 'createObjectURL', { value: vi.fn(() => 'blob:x'), writable: true });
		Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), writable: true });
		vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
		const onSave = vi.fn();

		render(PdfEditor, { src: bytes, onSave });
		expect(await screen.findByText('Page 1 of 3')).toBeVisible();
		await fireEvent.click(screen.getByRole('button', { name: 'Delete page 1' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Download' }));

		await vi.waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
		expect(fetch).not.toHaveBeenCalled();
		expect(onSave.mock.calls[0][0].fileName).toBe('document.pdf');
		const exported = await PDFDocument.load(new Uint8Array(onSave.mock.calls[0][0].buffer));
		expect(exported.getPageCount()).toBe(2);
	});

	it('reflects parent-controlled dark mode without its own toggle', async () => {
		const { unmount } = render(PdfEditor, { src: SRC, isDark: false, onIsDarkChange: vi.fn() });

		const editor = await screen.findByTestId('pdf-editor');
		expect(editor).toHaveAttribute('data-dark', 'false');
		expect(editor.classList.contains('dark')).toBe(false);
		expect(screen.queryByRole('switch', { name: 'Toggle dark mode' })).not.toBeInTheDocument();
		unmount();

		render(PdfEditor, { src: SRC, isDark: true });
		const darkEditor = await screen.findByTestId('pdf-editor');
		expect(darkEditor).toHaveAttribute('data-dark', 'true');
		expect(darkEditor.classList.contains('dark')).toBe(true);
	});

	it('accepts className as an alias of class', async () => {
		render(PdfEditor, { src: SRC, class: 'from-class', className: 'from-classname' });

		expect(await screen.findByTestId('pdf-editor')).toHaveClass('from-class', 'from-classname');
	});

	it('exports the upstream PDFEditor name as an alias', () => {
		expect(barrel.PDFEditor).toBe(PdfEditor);
		expect(barrel.PdfEditor).toBe(PdfEditor);
	});
});
