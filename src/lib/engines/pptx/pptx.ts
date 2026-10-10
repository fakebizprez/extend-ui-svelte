// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
// PPTX engine wrapper. The `pptx-browser` engine (see DECISION.md) is loaded
// lazily with a dynamic import so it only ever loads on the client, and the
// wrapper exposes a small API: load a deck, read the slide count, render a
// slide onto a canvas. Rendering must run in the browser (canvas 2D).

/** Default render width in pixels; height follows the slide aspect ratio. */
export const DEFAULT_RENDER_WIDTH = 1280;

/** Progress callback invoked while a deck loads. */
export type PptxProgressCallback = (progress: number, message: string) => void;

/** A loaded presentation deck. */
export interface PptxDeck {
	/** Total number of slides. Available once `loadDeck` resolves. */
	readonly slideCount: number;
	/**
	 * Render one slide onto `canvas`. Rejects with a `RangeError` when
	 * `index` is outside `[0, slideCount)`. Must run in the browser.
	 */
	renderSlide(index: number, canvas: HTMLCanvasElement, width?: number): Promise<void>;
	/** Release engine resources (blob URLs). Safe to call more than once. */
	destroy(): void;
}

/**
 * Load a `.pptx` deck from raw bytes. The engine is imported dynamically so
 * this module stays SSR-safe; only the import runs on demand.
 */
export async function loadDeck(
	data: ArrayBuffer | Uint8Array,
	onProgress: PptxProgressCallback = () => {}
): Promise<PptxDeck> {
	const { PptxRenderer } = await import('pptx-browser');
	const renderer = new PptxRenderer();
	await renderer.load(data, onProgress);

	const slideCount = renderer.slideCount;
	let destroyed = false;

	return {
		slideCount,
		async renderSlide(index: number, canvas: HTMLCanvasElement, width = DEFAULT_RENDER_WIDTH) {
			if (!Number.isInteger(index) || index < 0 || index >= slideCount) {
				throw new RangeError(`Slide index ${index} out of range for ${slideCount} slides`);
			}
			if (destroyed) {
				throw new Error('Cannot render: deck has been destroyed');
			}
			await renderer.renderSlide(index, canvas, width);
		},
		destroy() {
			if (destroyed) return;
			destroyed = true;
			renderer.destroy();
		}
	};
}
