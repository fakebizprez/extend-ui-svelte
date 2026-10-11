// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
// Regression: overlapping load() calls must be last-call-wins. A slow first
// load that resolves after a newer one used to replace the newer document.
import { describe, expect, it, vi } from 'vitest';

type FakeLoadingTask = {
	url: string;
	promise: Promise<unknown>;
	destroy: ReturnType<typeof vi.fn>;
	resolve: () => void;
};
const loadingTasks: FakeLoadingTask[] = [];
const renderedPages: Array<{ url: string; page: number }> = [];

vi.mock('pdfjs-dist', () => ({
	GlobalWorkerOptions: { workerSrc: '' },
	getDocument: ({ url }: { url: string }) => {
		const numPages = url === 'a.pdf' ? 3 : 5;
		const doc = {
			numPages,
			getPage: async (page: number) => ({
				rotate: 0,
				getViewport: ({ scale }: { scale: number }) => ({ width: 612 * scale, height: 792 * scale }),
				render: () => {
					renderedPages.push({ url, page });
					return { promise: Promise.resolve(), cancel: () => {} };
				}
			})
		};
		let resolve!: () => void;
		let reject!: (error: Error) => void;
		const promise = new Promise((done, fail) => {
			resolve = () => done(doc);
			reject = fail;
		});
		// Like PDF.js, destroying a pending task rejects its promise.
		const task: FakeLoadingTask = {
			url,
			promise,
			resolve,
			destroy: vi.fn(async () => reject(new Error('Worker was destroyed')))
		};
		loadingTasks.push(task);
		return task;
	}
}));

const { createPdfEngine, isPdfLoadSuperseded } = await import('./pdf-engine');

function fakeCanvas(): HTMLCanvasElement {
	return { width: 0, height: 0, getContext: () => ({}) } as unknown as HTMLCanvasElement;
}

async function flush(): Promise<void> {
	for (let i = 0; i < 10; i++) await Promise.resolve();
}

describe('pdf engine overlapping loads', () => {
	it('keeps the newest document when an older load resolves last', async () => {
		loadingTasks.length = 0;
		renderedPages.length = 0;
		const engine = createPdfEngine();

		const loadA = engine.load('a.pdf');
		const outcomeA = loadA.then(
			() => null,
			(error: unknown) => error
		);
		await vi.waitFor(() => expect(loadingTasks).toHaveLength(1));
		const loadB = engine.load('b.pdf');
		await vi.waitFor(() => expect(loadingTasks).toHaveLength(2));
		const [taskA, taskB] = loadingTasks;
		taskB!.resolve();
		await expect(loadB).resolves.toBe(5);
		taskA!.resolve();

		const failure = await outcomeA;
		expect(isPdfLoadSuperseded(failure)).toBe(true);
		expect(taskA!.destroy).toHaveBeenCalled();
		expect(taskB!.destroy).not.toHaveBeenCalled();
		expect(engine.pageCount).toBe(5);
		await expect(engine.getPageSizes()).resolves.toHaveLength(5);
		await engine.renderPage(5, fakeCanvas());
		expect(renderedPages).toEqual([{ url: 'b.pdf', page: 5 }]);
	});

	it('destroys the previous document when a newer one loads', async () => {
		loadingTasks.length = 0;
		const engine = createPdfEngine();

		const loadA = engine.load('a.pdf');
		await flush();
		loadingTasks[0]!.resolve();
		await expect(loadA).resolves.toBe(3);
		const loadB = engine.load('b.pdf');
		await flush();
		loadingTasks[1]!.resolve();
		await expect(loadB).resolves.toBe(5);

		expect(loadingTasks[0]!.destroy).toHaveBeenCalledOnce();
	});

	it('supersedes a pending load when the engine is destroyed', async () => {
		loadingTasks.length = 0;
		const engine = createPdfEngine();

		const loadA = engine.load('a.pdf');
		await vi.waitFor(() => expect(loadingTasks).toHaveLength(1));
		const outcomeA = loadA.then(
			() => null,
			(error: unknown) => error
		);
		await engine.destroy();
		loadingTasks[0]!.resolve();

		const failure = await outcomeA;
		expect(isPdfLoadSuperseded(failure)).toBe(true);
		expect(loadingTasks[0]!.destroy).toHaveBeenCalled();
		expect(engine.pageCount).toBe(0);
	});
});
