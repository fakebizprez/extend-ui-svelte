// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
// Framework-free PDF engine wrapper around PDF.js (pdfjs-dist).
//
// Browser-only: PDF.js is loaded lazily with dynamic `import()` the first
// time a document is loaded or rendered, so this module is safe to import
// during SSR. The worker URL is always set explicitly before `getDocument`.
import workerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';
import type {
	PDFDocumentLoadingTask,
	PDFDocumentProxy,
	PDFPageProxy,
	RenderParameters
} from 'pdfjs-dist/types/src/display/api.js';

export type PdfSource = string | URL | ArrayBuffer | Uint8Array;

export type PdfPageChangeHandler = (page: number) => void;

export interface PdfRenderOptions {
	/** Render scale. Defaults to 1. */
	scale?: number;
	/** Extra rotation in degrees, added to the page's own rotation. Defaults to 0. */
	rotation?: number;
}

export interface PdfPageSize {
	width: number;
	height: number;
}

export interface PdfEngine {
	/** Number of pages in the loaded document, or 0 when unloaded. */
	readonly pageCount: number;
	/** Current page (1-based), or 0 when no document is loaded. */
	readonly currentPage: number;
	/**
	 * Load a document from a URL or raw bytes. Resolves with the page count.
	 * Last call wins: a load that a newer load() or destroy() supersedes
	 * destroys its own loading task, leaves the engine state alone, and rejects
	 * with an error for which isPdfLoadSuperseded() is true.
	 */
	load(source: PdfSource): Promise<number>;
	/**
	 * Size of every page at scale 1, in CSS pixels, with each page's own
	 * rotation applied. Used to lay out pages before they render.
	 */
	getPageSizes(): Promise<PdfPageSize[]>;
	/** Render a page (1-based) into a canvas. Resolves with the page size in CSS pixels. */
	renderPage(pageNumber: number, canvas: HTMLCanvasElement, options?: PdfRenderOptions): Promise<PdfPageSize>;
	/** Set the current page, clamped to [1, pageCount]; notifies page-change listeners. */
	setCurrentPage(page: number): void;
	/** Subscribe to page changes. Returns an unsubscribe function. */
	onPageChange(handler: PdfPageChangeHandler): () => void;
	/** Release the loaded document and reset to the unloaded state. */
	destroy(): Promise<void>;
}

type PdfjsModule = typeof import('pdfjs-dist');

/** Error name of a load() that a newer load() or destroy() superseded. */
const SUPERSEDED = 'AbortError';

function supersededError(): Error {
	const error = new Error('PdfEngine.load: superseded by a newer load or destroy.');
	error.name = SUPERSEDED;
	return error;
}

/** True when a load() rejected only because a newer load() or destroy() replaced it. */
export function isPdfLoadSuperseded(error: unknown): boolean {
	return error instanceof Error && error.name === SUPERSEDED;
}

let workerSrcOverride: string | null = null;
let pdfjsPromise: Promise<PdfjsModule> | null = null;

/**
 * Override the PDF.js worker URL. When unset, the worker bundled with the
 * installed pdfjs-dist version is used, keeping the worker version-locked
 * to the API by construction.
 */
export function setPdfWorkerSrc(url: string): void {
	workerSrcOverride = url;
	if (pdfjsPromise) {
		void pdfjsPromise.then((pdfjs) => {
			pdfjs.GlobalWorkerOptions.workerSrc = url;
		});
	}
}

function workerSrc(): string {
	return workerSrcOverride ?? workerUrl;
}

async function loadPdfjs(): Promise<PdfjsModule> {
	if (!pdfjsPromise) {
		pdfjsPromise = import('pdfjs-dist').then((pdfjs) => {
			pdfjs.GlobalWorkerOptions.workerSrc = workerSrc();
			return pdfjs;
		});
	}
	return pdfjsPromise;
}

function toDocumentSource(source: PdfSource): { url: string } | { data: Uint8Array } {
	if (typeof source === 'string') {
		return { url: source };
	}
	if (source instanceof URL) {
		return { url: source.toString() };
	}
	if (source instanceof ArrayBuffer) {
		return { data: new Uint8Array(source.slice(0)) };
	}
	if (source instanceof Uint8Array) {
		// Copy: PDF.js may detach the buffer it is given.
		return { data: new Uint8Array(source) };
	}
	throw new TypeError(
		'PdfEngine.load: expected a URL string, URL, ArrayBuffer, or Uint8Array.'
	);
}

export function createPdfEngine(): PdfEngine {
	let doc: PDFDocumentProxy | null = null;
	let loadingTask: PDFDocumentLoadingTask | null = null;
	let pageCount = 0;
	let currentPage = 0;
	// One in-flight render per canvas: redrawing a canvas cancels its previous
	// render, while different canvases (several pages in view) render in parallel.
	const renderTasks = new Map<HTMLCanvasElement, { cancel(): void }>();
	const listeners = new Set<PdfPageChangeHandler>();
	let loadGeneration = 0;
	let pendingTask: PDFDocumentLoadingTask | null = null;

	/** Drop the loaded document and any load still in flight, destroying their tasks. */
	function releaseDocument(): Promise<unknown> {
		for (const task of renderTasks.values()) {
			task.cancel();
		}
		renderTasks.clear();
		const tasks = [loadingTask, pendingTask];
		loadingTask = null;
		pendingTask = null;
		doc = null;
		pageCount = 0;
		return Promise.all(tasks.map((task) => task?.destroy()));
	}

	function notify(page: number): void {
		for (const handler of listeners) {
			handler(page);
		}
	}

	function setPage(page: number): void {
		if (currentPage !== page) {
			currentPage = page;
			notify(page);
		}
	}

	return {
		get pageCount(): number {
			return pageCount;
		},

		get currentPage(): number {
			return currentPage;
		},

		async load(source: PdfSource): Promise<number> {
			const params = toDocumentSource(source);
			// Last call wins: a newer load() or destroy() supersedes this one.
			const generation = ++loadGeneration;
			void releaseDocument();
			const pdfjs = await loadPdfjs();
			if (generation !== loadGeneration) throw supersededError();
			const task = pdfjs.getDocument(params);
			pendingTask = task;
			let loaded: PDFDocumentProxy;
			try {
				loaded = await task.promise;
			} catch (failure) {
				if (generation !== loadGeneration) throw supersededError();
				throw failure;
			} finally {
				if (pendingTask === task) pendingTask = null;
			}
			if (generation !== loadGeneration) {
				void task.destroy();
				throw supersededError();
			}
			loadingTask = task;
			doc = loaded;
			pageCount = loaded.numPages;
			setPage(pageCount > 0 ? 1 : 0);
			return pageCount;
		},

		async getPageSizes(): Promise<PdfPageSize[]> {
			const loaded = doc;
			if (!loaded) {
				throw new Error('PdfEngine.getPageSizes: no document loaded.');
			}
			const pages = await Promise.all(
				Array.from({ length: loaded.numPages }, (_, index) => loaded.getPage(index + 1))
			);
			return pages.map((page) => {
				const { width, height } = page.getViewport({ scale: 1 });
				return { width, height };
			});
		},

		async renderPage(
			pageNumber: number,
			canvas: HTMLCanvasElement,
			options: PdfRenderOptions = {}
		): Promise<PdfPageSize> {
			if (!doc) {
				throw new Error('PdfEngine.renderPage: no document loaded.');
			}
			if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > pageCount) {
				throw new RangeError(
					`PdfEngine.renderPage: page ${pageNumber} out of range (1..${pageCount}).`
				);
			}
			const context = canvas.getContext('2d');
			if (!context) {
				throw new Error('PdfEngine.renderPage: canvas 2d context unavailable.');
			}
			const page: PDFPageProxy = await doc.getPage(pageNumber);
			// PDF.js replaces the page's own /Rotate when `rotation` is passed, so add it back.
			const viewport = page.getViewport({
				scale: options.scale ?? 1,
				rotation: (((page.rotate + (options.rotation ?? 0)) % 360) + 360) % 360
			});
			// Stop the canvas's previous render before resizing it under that render.
			renderTasks.get(canvas)?.cancel();
			canvas.width = Math.ceil(viewport.width);
			canvas.height = Math.ceil(viewport.height);
			const task = page.render({
				canvasContext: context,
				viewport
			} as RenderParameters);
			renderTasks.set(canvas, task);
			try {
				await task.promise;
			} finally {
				if (renderTasks.get(canvas) === task) {
					renderTasks.delete(canvas);
				}
			}
			return { width: viewport.width, height: viewport.height };
		},

		setCurrentPage(page: number): void {
			if (!doc || pageCount === 0) {
				return;
			}
			const clamped = Math.min(Math.max(Math.floor(page), 1), pageCount);
			setPage(clamped);
		},

		onPageChange(handler: PdfPageChangeHandler): () => void {
			listeners.add(handler);
			return () => {
				listeners.delete(handler);
			};
		},

		async destroy(): Promise<void> {
			loadGeneration += 1;
			await releaseDocument();
			currentPage = 0;
		}

	};
}
