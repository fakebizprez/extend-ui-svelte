// MIT License — Svelte 5 port of Extend UI pdf-editor. Upstream: extend-hq/ui (MIT).
// Component tests: run in the Vitest client (jsdom) project.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { PDFDocument } from 'pdf-lib';
import PdfEditor from './PdfEditor.svelte';

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
		expect(onDocumentLoadSuccess).toHaveBeenCalledWith(3);
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
		await fireEvent.click(screen.getByRole('button', { name: 'Export edited PDF' }));

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

		expect(screen.getByRole('button', { name: 'Export edited PDF' })).toBeDisabled();
		expect(screen.getByTestId('pdf-editor-page-indicator')).toHaveTextContent('Page 0 of 0');
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

	it('reflects parent-controlled dark mode and notifies on toggle', async () => {
		const onIsDarkChange = vi.fn();
		const { unmount } = render(PdfEditor, { src: SRC, isDark: false, onIsDarkChange });

		const editor = await screen.findByTestId('pdf-editor');
		expect(editor).toHaveAttribute('data-dark', 'false');
		expect(editor.classList.contains('dark')).toBe(false);

		await fireEvent.click(screen.getByRole('switch', { name: 'Toggle dark mode' }));
		expect(onIsDarkChange).toHaveBeenCalledTimes(1);
		expect(onIsDarkChange).toHaveBeenCalledWith(true);
		unmount();

		render(PdfEditor, { src: SRC, isDark: true });
		const darkEditor = await screen.findByTestId('pdf-editor');
		expect(darkEditor).toHaveAttribute('data-dark', 'true');
		expect(darkEditor.classList.contains('dark')).toBe(true);
	});
});
