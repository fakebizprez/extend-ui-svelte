// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
// Component tests: run in the Vitest client (jsdom) project.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { PDFDocument } from 'pdf-lib';
import ESignature from './ESignature.svelte';
import { ESignatureBlock } from './index.js';

const sigMock = vi.hoisted(() => ({ instances: [] as MockPad[] }));

interface MockPad {
	empty: boolean;
	options: unknown;
	emit(type: string): void;
}

vi.mock('signature_pad', () => {
	class MockSignaturePad {
		empty = true;
		options: unknown;
		private listeners = new Map<string, Set<() => void>>();

		constructor(
			public canvas: HTMLCanvasElement,
			options?: unknown
		) {
			this.options = options;
			sigMock.instances.push(this as unknown as MockPad);
		}

		isEmpty(): boolean {
			return this.empty;
		}

		clear(): void {
			this.empty = true;
		}

		toDataURL(): string {
			return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
		}

		on(): void {}

		off(): void {}

		addEventListener(type: string, listener: () => void): void {
			const set = this.listeners.get(type) ?? new Set<() => void>();
			set.add(listener);
			this.listeners.set(type, set);
		}

		removeEventListener(type: string, listener: () => void): void {
			this.listeners.get(type)?.delete(listener);
		}

		emit(type: string): void {
			for (const listener of this.listeners.get(type) ?? []) {
				listener();
			}
		}
	}

	return { default: MockSignaturePad };
});

const engineMock = vi.hoisted(() => ({ pageCount: 3, rendered: [] as number[] }));

vi.mock('#lib/engines/pdf/index.js', () => ({
	createPdfEngine: () => {
		const listeners = new Set<(page: number) => void>();
		const engine = {
			pageCount: 0,
			currentPage: 0,
			load: async () => {
				engine.pageCount = engineMock.pageCount;
				engine.currentPage = engineMock.pageCount > 0 ? 1 : 0;
				return engine.pageCount;
			},
			renderPage: async (pageNumber: number) => {
				engineMock.rendered.push(pageNumber);
				return { width: 612, height: 792 };
			},
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

const SRC = 'https://example.com/files/contract.pdf';

function lastPad(): (MockPad & { empty: boolean }) | undefined {
	return sigMock.instances.at(-1) as unknown as
		| (MockPad & { empty: boolean })
		| undefined;
}

function simulateStroke(): void {
	const pad = lastPad();
	if (!pad) throw new Error('signature pad was not constructed');
	pad.empty = false;
	pad.emit('endStroke');
}

async function blankPdfBytes(pages = 3): Promise<Uint8Array> {
	const doc = await PDFDocument.create();
	for (let i = 0; i < pages; i += 1) {
		doc.addPage([612, 792]);
	}
	return await doc.save();
}

async function stubPdfFetch(pages = 3): Promise<void> {
	const bytes = await blankPdfBytes(pages);
	const buffer = bytes.slice().buffer as ArrayBuffer;
	vi.stubGlobal(
		'fetch',
		vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => buffer.slice(0) })
	);
}

beforeEach(async () => {
	sigMock.instances.length = 0;
	engineMock.pageCount = 3;
	engineMock.rendered.length = 0;
	vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
		{} as CanvasRenderingContext2D
	);
	await stubPdfFetch();
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe('ESignature', () => {
	it('renders the pad and keeps placement disabled until the user draws', async () => {
		render(ESignature, { src: SRC });

		const pad = await screen.findByTestId('e-signature-pad');
		await waitFor(() => expect(pad).toHaveAttribute('data-pad-ready', 'true'));
		expect(await screen.findByText('Page 1 of 3')).toBeVisible();
		expect(screen.getByTestId('e-signature-status')).toHaveTextContent('Draw your signature');
		expect(screen.getByRole('button', { name: 'Place signature' })).toBeDisabled();
		expect(screen.getByRole('button', { name: 'Download signed PDF' })).toBeDisabled();
	});

	it('enables placement once the user draws and notifies the parent', async () => {
		const onSignatureChange = vi.fn();
		render(ESignature, { src: SRC, onSignatureChange });

		const pad = await screen.findByTestId('e-signature-pad');
		await waitFor(() => expect(pad).toHaveAttribute('data-pad-ready', 'true'));

		simulateStroke();

		await waitFor(() =>
			expect(screen.getByRole('button', { name: 'Place signature' })).toBeEnabled()
		);
		expect(screen.getByTestId('e-signature-status')).toHaveTextContent('Signature ready');
		expect(onSignatureChange).toHaveBeenCalledTimes(1);
		expect(onSignatureChange).toHaveBeenCalledWith(true);
	});

	it('clears the signature and disables placement again', async () => {
		const onSignatureChange = vi.fn();
		render(ESignature, { src: SRC, onSignatureChange });

		const pad = await screen.findByTestId('e-signature-pad');
		await waitFor(() => expect(pad).toHaveAttribute('data-pad-ready', 'true'));
		simulateStroke();
		await waitFor(() =>
			expect(screen.getByRole('button', { name: 'Place signature' })).toBeEnabled()
		);

		await fireEvent.click(screen.getByRole('button', { name: 'Clear signature' }));

		expect(screen.getByRole('button', { name: 'Place signature' })).toBeDisabled();
		expect(onSignatureChange).toHaveBeenLastCalledWith(false);
	});

	it('loads the document and reports the page count', async () => {
		const onDocumentLoadSuccess = vi.fn();
		render(ESignature, { src: SRC, onDocumentLoadSuccess });

		expect(await screen.findByText('Page 1 of 3')).toBeVisible();
		expect(screen.getByTestId('e-signature')).toHaveAttribute('data-pdf-ready', 'true');
		expect(onDocumentLoadSuccess).toHaveBeenCalledWith(3);
	});

	it('navigates pages and reports the active page', async () => {
		const onPageChange = vi.fn();
		render(ESignature, { src: SRC, onPageChange });

		expect(await screen.findByText('Page 1 of 3')).toBeVisible();

		await fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
		expect(screen.getByTestId('e-signature-page-indicator')).toHaveTextContent('Page 2 of 3');
		expect(onPageChange).toHaveBeenCalledWith(2);

		await fireEvent.click(screen.getByRole('button', { name: 'Previous page' }));
		expect(screen.getByTestId('e-signature-page-indicator')).toHaveTextContent('Page 1 of 3');
	});

	it('places the signature and downloads the signed PDF', async () => {
		const createObjectURL = vi.fn(() => 'blob:mock-signed');
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
		const onSignedDownload = vi.fn();
		render(ESignature, { src: SRC, fileName: 'contract', onSignedDownload });

		const pad = await screen.findByTestId('e-signature-pad');
		await waitFor(() => expect(pad).toHaveAttribute('data-pad-ready', 'true'));
		expect(await screen.findByText('Page 1 of 3')).toBeVisible();

		simulateStroke();
		const place = await screen.findByRole('button', { name: 'Place signature' });
		await waitFor(() => expect(place).toBeEnabled());
		await fireEvent.click(place);

		const download = screen.getByRole('button', { name: 'Download signed PDF' });
		await waitFor(() => expect(download).toBeEnabled());
		await fireEvent.click(download);

		expect(click).toHaveBeenCalled();
		expect(downloadAttr).toBe('contract-signed.pdf');
		expect(createObjectURL).toHaveBeenCalled();
		expect(onSignedDownload).toHaveBeenCalledWith('contract-signed.pdf');
	});

	it('applies position and scale changes to the placement controls', async () => {
		render(ESignature, { src: SRC });

		expect(await screen.findByText('Page 1 of 3')).toBeVisible();

		await fireEvent.input(screen.getByLabelText('Position X (pt)'), {
			target: { value: '120' }
		});
		await fireEvent.input(screen.getByLabelText(/Scale/), { target: { value: '2' } });

		expect(screen.getByLabelText('Position X (pt)')).toHaveValue(120);
		expect(screen.getByLabelText(/Scale/)).toHaveValue('2');
		expect(engineMock.rendered.length).toBeGreaterThan(0);
	});

	it('shows an empty state without a source', async () => {
		render(ESignature, {});

		expect(await screen.findByText('Choose a PDF to sign')).toBeVisible();
		expect(screen.queryByTestId('e-signature-preview')).not.toBeInTheDocument();
	});

	it('reflects the parent-controlled dark mode', async () => {
		const { unmount } = render(ESignature, { src: SRC, isDark: false });

		const viewer = await screen.findByTestId('e-signature');
		expect(viewer).toHaveAttribute('data-dark', 'false');
		expect(viewer.classList.contains('dark')).toBe(false);
		unmount();

		render(ESignature, { src: SRC, isDark: true });
		const darkViewer = await screen.findByTestId('e-signature');
		expect(darkViewer).toHaveAttribute('data-dark', 'true');
		expect(darkViewer.classList.contains('dark')).toBe(true);
	});

	it('renders no theme toggle of its own, like upstream', async () => {
		const onIsDarkChange = vi.fn();
		render(ESignature, { src: SRC, isDark: false, onIsDarkChange });

		expect(await screen.findByText('Page 1 of 3')).toBeVisible();
		expect(screen.queryByRole('switch')).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /dark mode/i })).not.toBeInTheDocument();
		expect(onIsDarkChange).not.toHaveBeenCalled();
	});

	it('accepts the upstream file prop as the PDF source', async () => {
		const onDocumentLoadSuccess = vi.fn();
		render(ESignature, { file: SRC, onDocumentLoadSuccess });

		expect(await screen.findByText('Page 1 of 3')).toBeVisible();
		expect(onDocumentLoadSuccess).toHaveBeenCalledWith(3);
		expect(vi.mocked(fetch)).toHaveBeenCalledWith(SRC);
	});

	it('accepts className as an alias of class on the root', async () => {
		render(ESignature, { class: 'from-class', className: 'from-class-name' });

		expect(await screen.findByTestId('e-signature')).toHaveClass(
			'e-signature',
			'from-class',
			'from-class-name'
		);
	});

	it('is exported under the upstream name ESignatureBlock', () => {
		expect(ESignatureBlock).toBe(ESignature);
	});
});
