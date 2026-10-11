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
	data: unknown[];
	restored: unknown[][];
	emit(type: string): void;
}

vi.mock('signature_pad', () => {
	class MockSignaturePad {
		empty = true;
		options: unknown;
		data: unknown[] = [];
		restored: unknown[][] = [];
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

		toData(): unknown[] {
			return this.data;
		}

		fromData(data: unknown[]): void {
			this.restored.push(data);
			this.data = data;
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

const engineMock = vi.hoisted(() => ({
	pageCount: 3,
	rendered: [] as number[],
	loads: 0,
	// Like PDF.js on one canvas: a new render cancels the one still in flight.
	cancelSuperseded: false,
	// Like PdfEngine: load() drops the open document at once and reopens it later.
	slowLoad: false,
	hasDocument: true,
	pageSize: { width: 612, height: 792 },
	inFlight: null as ((reason: Error) => void) | null
}));

// Lets a test hold a placement mid-flight; null passes through to pdf-lib.
const embedGate = vi.hoisted(() => ({
	wait: null as Promise<void> | null,
	placements: [] as unknown[]
}));

vi.mock('./sign-pdf.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./sign-pdf.js')>();
	return {
		...actual,
		embedSignaturePng: async (...args: Parameters<typeof actual.embedSignaturePng>) => {
			embedGate.placements.push(args[2]);
			const stamped = await actual.embedSignaturePng(...args);
			if (embedGate.wait) await embedGate.wait;
			return stamped;
		}
	};
});

vi.mock('../../engines/pdf/index.js', () => ({
	createPdfEngine: () => {
		const listeners = new Set<(page: number) => void>();
		const engine = {
			pageCount: 0,
			currentPage: 0,
			load: async () => {
				engineMock.loads += 1;
				if (engineMock.slowLoad) {
					engineMock.hasDocument = false;
					await new Promise((resolve) => setTimeout(resolve, 20));
					engineMock.hasDocument = true;
				}
				engine.pageCount = engineMock.pageCount;
				engine.currentPage = engineMock.pageCount > 0 ? 1 : 0;
				return engine.pageCount;
			},
			renderPage: async (pageNumber: number) => {
				if (!engineMock.hasDocument) throw new Error('PdfEngine.renderPage: no document loaded.');
				engineMock.rendered.push(pageNumber);
				if (engineMock.cancelSuperseded) {
					const cancelled = new Error(`Rendering cancelled, page ${pageNumber}`);
					cancelled.name = 'RenderingCancelledException';
					engineMock.inFlight?.(cancelled);
					await new Promise<void>((resolve, reject) => {
						engineMock.inFlight = reject;
						setTimeout(resolve, 5);
					});
					engineMock.inFlight = null;
				}
				return { ...engineMock.pageSize };
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
	engineMock.loads = 0;
	engineMock.cancelSuperseded = false;
	engineMock.slowLoad = false;
	engineMock.pageSize = { width: 612, height: 792 };
	embedGate.placements.length = 0;
	engineMock.hasDocument = true;
	engineMock.inFlight = null;
	embedGate.wait = null;
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

	it('ignores a render superseded by a quick second page change', async () => {
		engineMock.cancelSuperseded = true;
		render(ESignature, { src: SRC });
		expect(await screen.findByText('Page 1 of 3')).toBeVisible();
		await new Promise((resolve) => setTimeout(resolve, 20));

		const next = screen.getByRole('button', { name: 'Next page' });
		await fireEvent.click(next);
		await fireEvent.click(next);
		await new Promise((resolve) => setTimeout(resolve, 30));

		expect(screen.queryByRole('alert')).not.toBeInTheDocument();
		expect(screen.getByTestId('e-signature-preview')).toBeInTheDocument();
		expect(screen.getByTestId('e-signature-page-indicator')).toHaveTextContent('Page 3 of 3');
		expect(engineMock.rendered.slice(-2)).toEqual([2, 3]);
	});

	it('paging while the signed PDF reloads waits and renders the current page', async () => {
		render(ESignature, { src: SRC });
		const pad = await screen.findByTestId('e-signature-pad');
		await waitFor(() => expect(pad).toHaveAttribute('data-pad-ready', 'true'));
		expect(await screen.findByText('Page 1 of 3')).toBeVisible();
		engineMock.slowLoad = true;
		simulateStroke();
		const place = await screen.findByRole('button', { name: 'Place signature' });
		await waitFor(() => expect(place).toBeEnabled());

		await fireEvent.click(place);
		// Page while the stamped document is being reloaded.
		await waitFor(() => expect(engineMock.hasDocument).toBe(false));
		await fireEvent.click(screen.getByRole('button', { name: 'Next page' }));

		await waitFor(() => expect(screen.getByTestId('e-signature')).toHaveAttribute('data-signed', 'true'));
		await new Promise((resolve) => setTimeout(resolve, 40));
		expect(screen.queryByRole('alert')).not.toBeInTheDocument();
		expect(screen.getByTestId('e-signature-page-indicator')).toHaveTextContent('Page 2 of 3');
		expect(engineMock.rendered.at(-1)).toBe(2);
	});

	it('still shows a real error from the latest render', async () => {
		render(ESignature, { src: SRC });
		expect(await screen.findByText('Page 1 of 3')).toBeVisible();
		// Make the next render fail for real.
		const original = engineMock.rendered.push.bind(engineMock.rendered);
		engineMock.rendered.push = (page: number) => {
			if (page === 2) throw new Error('Corrupt page 2');
			return original(page);
		};

		await fireEvent.click(screen.getByRole('button', { name: 'Next page' }));

		expect(await screen.findByRole('alert')).toHaveTextContent('Corrupt page 2');
		engineMock.rendered.push = original;
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

	it('drops a placement still in flight when the file changes', async () => {
		let release!: () => void;
		embedGate.wait = new Promise<void>((resolve) => (release = resolve));
		const { rerender } = render(ESignature, { file: SRC });

		const pad = await screen.findByTestId('e-signature-pad');
		await waitFor(() => expect(pad).toHaveAttribute('data-pad-ready', 'true'));
		expect(await screen.findByText('Page 1 of 3')).toBeVisible();
		simulateStroke();
		const place = await screen.findByRole('button', { name: 'Place signature' });
		await waitFor(() => expect(place).toBeEnabled());
		await fireEvent.click(place);

		// A new five-page document replaces the old one while the stamp is pending.
		engineMock.pageCount = 5;
		await rerender({ file: 'https://example.com/files/other.pdf' });
		expect(await screen.findByText('Page 1 of 5')).toBeVisible();
		const loadsAfterSwitch = engineMock.loads;

		release();
		await waitFor(() =>
			expect(screen.getByRole('button', { name: 'Place signature' })).toBeEnabled()
		);
		expect(engineMock.loads).toBe(loadsAfterSwitch);
		expect(screen.getByTestId('e-signature')).toHaveAttribute('data-signed', 'false');
		expect(screen.getByTestId('e-signature-page-indicator')).toHaveTextContent('Page 1 of 5');
		expect(screen.getByRole('button', { name: 'Download signed PDF' })).toBeDisabled();
	});

	for (const [label, size, expected] of [
		['Letter', { width: 612, height: 792 }, { x: 300, y: 230, width: 250, height: 58 }],
		['A4', { width: 595.28, height: 841.89 }, { x: 291.8, y: 244.5, width: 243.2, height: 61.7 }]
	] as const) {
		it(`places upstream's default field scaled to a ${label} page`, async () => {
			engineMock.pageSize = { ...size };
			render(ESignature, { src: SRC });
			const pad = await screen.findByTestId('e-signature-pad');
			await waitFor(() => expect(pad).toHaveAttribute('data-pad-ready', 'true'));
			await waitFor(() =>
				expect(screen.getByLabelText('Position X (pt)')).toHaveValue(expected.x)
			);
			expect(screen.getByLabelText('Position Y (pt)')).toHaveValue(expected.y);
			expect(screen.getByLabelText('Width (pt)')).toHaveValue(expected.width);
			expect(screen.getByLabelText('Height (pt)')).toHaveValue(expected.height);

			simulateStroke();
			const place = screen.getByRole('button', { name: 'Place signature' });
			await waitFor(() => expect(place).toBeEnabled());
			await fireEvent.click(place);
			await waitFor(() => expect(embedGate.placements).toHaveLength(1));
			const placed = embedGate.placements[0] as Record<string, number>;
			for (const key of ['x', 'y', 'width', 'height'] as const) {
				expect(placed[key]).toBeCloseTo(expected[key], 0);
			}
		});
	}

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

	it('sizes the pad backing store to its displayed size times devicePixelRatio', async () => {
		vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(318);
		vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(200);
		vi.stubGlobal('devicePixelRatio', 2);
		const scaleCalls: number[][] = [];
		vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue({
			setTransform: () => {},
			scale: (x: number, y: number) => scaleCalls.push([x, y])
		} as unknown as CanvasRenderingContext2D);
		render(ESignature, { src: SRC });

		const pad = (await screen.findByTestId('e-signature-pad')) as HTMLCanvasElement;
		await waitFor(() => expect(pad).toHaveAttribute('data-pad-ready', 'true'));
		expect(pad.width).toBe(636);
		expect(pad.height).toBe(400);
		expect(scaleCalls.at(-1)).toEqual([2, 2]);
	});

	it('resizes the pad on layout changes and keeps the drawn signature', async () => {
		let width = 478;
		vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(() => width);
		vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(200);
		vi.stubGlobal('devicePixelRatio', 1);
		const observers: Array<() => void> = [];
		vi.stubGlobal(
			'ResizeObserver',
			class {
				constructor(callback: () => void) {
					observers.push(callback);
				}
				observe(): void {}
				disconnect(): void {}
			}
		);
		render(ESignature, { src: SRC });

		const pad = (await screen.findByTestId('e-signature-pad')) as HTMLCanvasElement;
		await waitFor(() => expect(pad).toHaveAttribute('data-pad-ready', 'true'));
		expect(pad.width).toBe(478);
		const instance = lastPad();
		if (!instance) throw new Error('signature pad was not constructed');
		const strokes = [{ points: [{ x: 10, y: 10 }] }];
		instance.data = strokes;
		simulateStroke();

		width = 318;
		for (const callback of observers) callback();

		expect(pad.width).toBe(318);
		expect(instance.restored.at(-1)).toEqual(strokes);
	});

	it('draws with the upstream black pen by default', async () => {
		render(ESignature, { src: SRC, isDark: true });

		const pad = await screen.findByTestId('e-signature-pad');
		await waitFor(() => expect(pad).toHaveAttribute('data-pad-ready', 'true'));
		expect(lastPad()?.options).toMatchObject({ penColor: '#000000' });
	});

	it('adds no duplicate landmarks when several instances share a page (axe landmark-unique)', async () => {
		render(ESignature, { src: SRC });
		render(ESignature, { src: SRC });

		const roots = await screen.findAllByTestId('e-signature');
		expect(roots).toHaveLength(2);
		const landmarks = roots.flatMap((root) => [
			...root.querySelectorAll('section[aria-label], section[aria-labelledby], aside, nav, main, [role="region"]')
		]);
		expect(landmarks).toHaveLength(0);
		// The two panels keep their accessible names as groups.
		expect(screen.getAllByRole('group', { name: 'Draw your signature' })).toHaveLength(2);
		expect(screen.getAllByRole('group', { name: 'Place the signature on the PDF' })).toHaveLength(2);
	});

	it('is exported under the upstream name ESignatureBlock', () => {
		expect(ESignatureBlock).toBe(ESignature);
	});
});

describe('e-signature docs', () => {
	it('lists every port-only export under Differences from upstream', async () => {
		const exports = Object.keys(await import('./index.js'));
		const page = (await import('../../../routes/e-signature/+page.svelte?raw')).default as string;
		const differences = page.slice(page.indexOf('Differences from upstream'));
		const upstream = new Set(['default', 'ESignatureBlock']);
		const missing = exports.filter(
			(name) => !upstream.has(name) && !differences.includes(`<code>${name}</code>`)
		);
		expect(missing).toEqual([]);
	});
});
