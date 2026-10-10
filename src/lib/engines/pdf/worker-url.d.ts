// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
// Ambient type for the Vite `?url` worker import. Kept local to this engine
// so library consumers without `vite/client` types still typecheck.
declare module 'pdfjs-dist/build/pdf.worker.mjs?url' {
	const url: string;
	export default url;
}
