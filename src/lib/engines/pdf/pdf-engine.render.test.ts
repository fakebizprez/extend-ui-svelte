// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
// Regression: concurrent renders into different canvases must not cancel each
// other (the viewer, editor and citations draw several pages at once).
import { describe, expect, it, vi } from 'vitest';

type FakeTask = { promise: Promise<void>; cancel: ReturnType<typeof vi.fn>; finish: () => void };
const tasks: FakeTask[] = [];

vi.mock('pdfjs-dist', () => {
	const page = {
		getViewport: ({ scale }: { scale: number }) => ({ width: 612 * scale, height: 792 * scale }),
		render: () => {
			let finish!: () => void;
			const promise = new Promise<void>((resolve) => (finish = resolve));
			const task: FakeTask = { promise, cancel: vi.fn(), finish };
			tasks.push(task);
			return task;
		}
	};
	const doc = { numPages: 3, getPage: async () => page };
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
