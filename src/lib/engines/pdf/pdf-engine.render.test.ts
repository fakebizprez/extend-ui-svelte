// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
// Regression: concurrent renders into different canvases must not cancel each
// other (the viewer, editor and citations draw several pages at once).
import { describe, expect, it, vi } from 'vitest';

type FakeTask = { promise: Promise<void>; cancel: ReturnType<typeof vi.fn>; finish: () => void };
const tasks: FakeTask[] = [];

const viewportCalls: Array<{ page: number; scale: number; rotation: number }> = [];

vi.mock('pdfjs-dist', () => {
	// Page 1 portrait, page 2 landscape, page 3 portrait stored with /Rotate 90.
	const shapes = [
		{ width: 612, height: 792, rotate: 0 },
		{ width: 792, height: 612, rotate: 0 },
		{ width: 612, height: 792, rotate: 90 }
	];
	const pages = shapes.map((shape, index) => ({
		rotate: shape.rotate,
		// Mirrors PDF.js: `rotation` replaces the page's own /Rotate when passed.
		getViewport: ({ scale, rotation = shape.rotate }: { scale: number; rotation?: number }) => {
			viewportCalls.push({ page: index + 1, scale, rotation });
			const quarter = rotation % 180 !== 0;
			return {
				width: (quarter ? shape.height : shape.width) * scale,
				height: (quarter ? shape.width : shape.height) * scale
			};
		},
		render: () => {
			let finish!: () => void;
			const promise = new Promise<void>((resolve) => (finish = resolve));
			const task: FakeTask = { promise, cancel: vi.fn(), finish };
			tasks.push(task);
			return task;
		}
	}));
	const doc = { numPages: 3, getPage: async (n: number) => pages[n - 1] };
	return {
		GlobalWorkerOptions: { workerSrc: '' },
		getDocument: () => ({ promise: Promise.resolve(doc), destroy: async () => {} })
	};
});

const { createPdfEngine } = await import('./pdf-engine');

function fakeCanvas(): HTMLCanvasElement {
	return { width: 0, height: 0, getContext: () => ({}) } as unknown as HTMLCanvasElement;
}

async function flush(): Promise<void> {
	for (let i = 0; i < 5; i++) await Promise.resolve();
}

describe('pdf engine concurrent rendering', () => {
	it('renders different canvases at the same time without cancelling either', async () => {
		tasks.length = 0;
		const engine = createPdfEngine();
		await engine.load('fixture.pdf');

		const first = engine.renderPage(1, fakeCanvas());
		const second = engine.renderPage(2, fakeCanvas());
		await flush();

		expect(tasks).toHaveLength(2);
		expect(tasks[0].cancel).not.toHaveBeenCalled();
		tasks.forEach((task) => task.finish());
		await expect(Promise.all([first, second])).resolves.toHaveLength(2);
	});

	it('cancels the earlier render when the same canvas is redrawn', async () => {
		tasks.length = 0;
		const engine = createPdfEngine();
		await engine.load('fixture.pdf');
		const canvas = fakeCanvas();

		void engine.renderPage(1, canvas, { scale: 1 });
		await flush();
		const redraw = engine.renderPage(1, canvas, { scale: 2 });
		await flush();

		expect(tasks[0].cancel).toHaveBeenCalledOnce();
		tasks[1].finish();
		await expect(redraw).resolves.toEqual({ width: 1224, height: 1584 });
	});

	it('destroy cancels every in-flight render', async () => {
		tasks.length = 0;
		const engine = createPdfEngine();
		await engine.load('fixture.pdf');

		void engine.renderPage(1, fakeCanvas());
		void engine.renderPage(2, fakeCanvas());
		await flush();
		await engine.destroy();

		expect(tasks.every((task) => task.cancel.mock.calls.length === 1)).toBe(true);
	});
});

describe('pdf engine page sizes and rotation', () => {
	it('reads every page size at scale 1, including the page\'s own rotation', async () => {
		const engine = createPdfEngine();
		await engine.load('fixture.pdf');

		await expect(engine.getPageSizes()).resolves.toEqual([
			{ width: 612, height: 792 },
			{ width: 792, height: 612 },
			{ width: 792, height: 612 }
		]);
	});

	it('getPageSizes rejects while no document is loaded', async () => {
		await expect(createPdfEngine().getPageSizes()).rejects.toThrow(/no document loaded/i);
	});

	it('adds the requested rotation to the page\'s own rotation when rendering', async () => {
		tasks.length = 0;
		viewportCalls.length = 0;
		const engine = createPdfEngine();
		await engine.load('fixture.pdf');

		const rendered = engine.renderPage(3, fakeCanvas(), { rotation: 90 });
		await flush();
		tasks.forEach((task) => task.finish());

		await expect(rendered).resolves.toEqual({ width: 612, height: 792 });
		expect(viewportCalls.at(-1)).toEqual({ page: 3, scale: 1, rotation: 180 });
	});
});
