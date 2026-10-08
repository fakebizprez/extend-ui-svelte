// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
import { describe, expect, it } from 'vitest';
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
