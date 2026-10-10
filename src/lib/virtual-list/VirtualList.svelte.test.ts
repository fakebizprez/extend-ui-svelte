// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { tick } from 'svelte';
import { createRawSnippet } from 'svelte';
import { fireEvent, render } from '@testing-library/svelte';
import VirtualList from './VirtualList.svelte';

const ITEM_HEIGHT = 30;
const VIEWPORT_HEIGHT = 300;

function rowIndexes(container: HTMLElement): number[] {
	return Array.from(container.querySelectorAll('[data-virtual-index]')).map((row) =>
		Number(row.getAttribute('data-virtual-index'))
	);
}

function viewportOf(container: HTMLElement): HTMLElement {
	const viewport = container.querySelector('[data-testid="virtual-viewport"]');
	if (!(viewport instanceof HTMLElement)) throw new Error('virtual viewport not found');
	return viewport;
}

describe('VirtualList', () => {
	it('renders only the windowed subset of a large list', () => {
		const items = Array.from({ length: 1000 }, (_, i) => `item-${i}`);
		const { container } = render(VirtualList, {
			items,
			itemHeight: ITEM_HEIGHT,
			height: VIEWPORT_HEIGHT,
			overscan: 2
		});

		// 10 visible rows plus 2 overscan rows below; nothing above at the top.
		expect(rowIndexes(container)).toEqual(Array.from({ length: 12 }, (_, i) => i));
	});

	it('positions each row at its index times the item height', () => {
		const items = Array.from({ length: 100 }, (_, i) => `item-${i}`);
		const { container } = render(VirtualList, {
			items,
			itemHeight: ITEM_HEIGHT,
			height: VIEWPORT_HEIGHT,
			overscan: 0
		});

		const rows = container.querySelectorAll('[data-virtual-index]');
		expect(rows).toHaveLength(10);
		expect((rows[0] as HTMLElement).style.top).toBe('0px');
		expect((rows[9] as HTMLElement).style.top).toBe(`${9 * ITEM_HEIGHT}px`);
	});

	it('sizes the spacer to the full list height', () => {
		const items = Array.from({ length: 100 }, (_, i) => `item-${i}`);
		const { container } = render(VirtualList, {
			items,
			itemHeight: ITEM_HEIGHT,
			height: VIEWPORT_HEIGHT
		});

		const spacer = container.querySelector('[data-testid="virtual-spacer"]');
		expect((spacer as HTMLElement).style.height).toBe(`${100 * ITEM_HEIGHT}px`);
	});

	it('renders snippet content for the visible rows', () => {
		const items = ['a', 'b', 'c'];
		const children = createRawSnippet<[string, number]>((getItem, getIndex) => {
			return { render: () => `<span>row-${getIndex()}-${getItem()}</span>` };
		});
		const { container } = render(VirtualList, {
			items,
			itemHeight: ITEM_HEIGHT,
			height: VIEWPORT_HEIGHT,
			children
		});

		expect(container.textContent).toContain('row-0-a');
		expect(container.textContent).toContain('row-2-c');
	});

	it('renders no rows for an empty list', () => {
		const { container } = render(VirtualList, {
			items: [],
			itemHeight: ITEM_HEIGHT,
			height: VIEWPORT_HEIGHT
		});

		expect(rowIndexes(container)).toEqual([]);
	});

	it('renders the single row of a one-item list', () => {
		const { container } = render(VirtualList, {
			items: ['only'],
			itemHeight: ITEM_HEIGHT,
			height: VIEWPORT_HEIGHT
		});

		expect(rowIndexes(container)).toEqual([0]);
	});

	it('shows the last item when scrolled to the end', async () => {
		const items = Array.from({ length: 100 }, (_, i) => `item-${i}`);
		const { container } = render(VirtualList, {
			items,
			itemHeight: ITEM_HEIGHT,
			height: VIEWPORT_HEIGHT,
			overscan: 2
		});

		const viewport = viewportOf(container);
		viewport.scrollTop = items.length * ITEM_HEIGHT - VIEWPORT_HEIGHT;
		await fireEvent.scroll(viewport);
		await tick();

		const indexes = rowIndexes(container);
		expect(indexes.at(-1)).toBe(99);
		expect(indexes).toEqual(Array.from({ length: 12 }, (_, i) => 88 + i));
	});

	it('slides the window when scrolled to the middle', async () => {
		const items = Array.from({ length: 100 }, (_, i) => `item-${i}`);
		const { container } = render(VirtualList, {
			items,
			itemHeight: ITEM_HEIGHT,
			height: VIEWPORT_HEIGHT,
			overscan: 2
		});

		const viewport = viewportOf(container);
		viewport.scrollTop = 1500;
		await fireEvent.scroll(viewport);
		await tick();

		expect(rowIndexes(container)).toEqual(Array.from({ length: 14 }, (_, i) => 48 + i));
	});
});

// jsdom has no layout or ResizeObserver: this fake lets a test report row heights.
class FakeResizeObserver {
	static instances: FakeResizeObserver[] = [];
	readonly targets = new Set<Element>();
	constructor(private readonly callback: ResizeObserverCallback) {
		FakeResizeObserver.instances.push(this);
	}
	observe(target: Element) {
		this.targets.add(target);
	}
	unobserve(target: Element) {
		this.targets.delete(target);
	}
	disconnect() {
		this.targets.clear();
	}
	report(heights: Record<number, number>) {
		const entries = [...this.targets]
			.filter((target) => Number(target.getAttribute('data-virtual-index')) in heights)
			.map((target) => {
				const height = heights[Number(target.getAttribute('data-virtual-index'))];
				Object.defineProperty(target, 'offsetHeight', { configurable: true, value: height });
				return { target } as unknown as ResizeObserverEntry;
			});
		this.callback(entries, this as unknown as ResizeObserver);
	}
}

describe('VirtualList measured rows', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		FakeResizeObserver.instances = [];
	});

	it('positions rows from estimateSize and leaves their height to the content', () => {
		const items = Array.from({ length: 100 }, (_, i) => `item-${i}`);
		const { container } = render(VirtualList, {
			items,
			estimateSize: (index: number) => (index % 2 === 0 ? 50 : 100),
			height: VIEWPORT_HEIGHT,
			overscan: 0
		});

		const rows = container.querySelectorAll<HTMLElement>('[data-virtual-index]');
		// 50 + 100 + 50 + 100 = 300 fills the viewport exactly.
		expect(rowIndexes(container)).toEqual([0, 1, 2, 3]);
		expect(rows[1]?.style.top).toBe('50px');
		expect(rows[3]?.style.top).toBe('200px');
		expect(rows[0]?.style.height).toBe('');
		const spacer = container.querySelector<HTMLElement>('[data-testid="virtual-spacer"]');
		expect(spacer?.style.height).toBe('7500px');
	});

	it('repositions later rows once a row reports its measured height', async () => {
		vi.stubGlobal('ResizeObserver', FakeResizeObserver);
		const items = Array.from({ length: 20 }, (_, i) => `item-${i}`);
		const { container } = render(VirtualList, {
			items,
			estimateSize: () => 100,
			height: VIEWPORT_HEIGHT,
			overscan: 0
		});
		await tick();

		const observer = FakeResizeObserver.instances[0];
		expect(observer).toBeDefined();
		observer?.report({ 0: 20, 1: 30 });
		await tick();

		const row = (index: number) =>
			container.querySelector<HTMLElement>(`[data-virtual-index="${index}"]`);
		expect(row(1)?.style.top).toBe('20px');
		expect(row(2)?.style.top).toBe('50px');
		// The freed space pulls another row into the window.
		expect(rowIndexes(container)).toEqual([0, 1, 2, 3, 4]);
	});
});
