// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
export { createPdfEngine, isPdfLoadSuperseded, setPdfWorkerSrc } from './pdf-engine.js';
export type {
	PdfEngine,
	PdfPageChangeHandler,
	PdfPageSize,
	PdfRenderOptions,
	PdfSource
} from './pdf-engine.js';
