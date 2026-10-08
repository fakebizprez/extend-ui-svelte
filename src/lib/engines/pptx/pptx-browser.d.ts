// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
// Minimal typings for the untyped `pptx-browser` engine. Covers only the
// surface the wrapper in ./pptx.ts uses.
declare module 'pptx-browser' {
	export class PptxRenderer {
		readonly slideCount: number;
		load(
			source: ArrayBuffer | Uint8Array,
			onProgress?: (progress: number, message: string) => void
		): Promise<void>;
		renderSlide(index: number, canvas: HTMLCanvasElement, width?: number): Promise<void>;
		destroy(): void;
	}
}
