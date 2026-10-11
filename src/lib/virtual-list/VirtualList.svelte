<!--
	MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
	Shared virtual list: renders only the windowed subset of a large list so
	pages, sheet rows, and slide lists never render all at once.

	Two modes:
	- Fixed: pass `itemHeight`; every row gets that height.
	- Measured: pass `estimateSize`; rows size to their content and are
	  positioned from estimates until a ResizeObserver reports their real
	  height (like @tanstack/react-virtual's measureElement).
-->
<script lang="ts" generics="T">
	import { untrack, type Snippet } from 'svelte';
	import {
		computeVariableWindow,
		computeWindow,
		DEFAULT_OVERSCAN,
		prefixOffsets,
		totalHeight
	} from './window.js';

	interface Props {
		/** All items; only the visible window is rendered. */
		items: T[];
		/** Fixed height of one row in pixels. Ignored when `estimateSize` is given. */
		itemHeight?: number;
		/**
		 * Estimated height of the row at `index`. Turns on measured mode: rows
		 * size to their content and the estimate is replaced by the measured height.
		 */
		estimateSize?: (index: number) => number;
		/** Visible height of the scroll viewport in pixels. */
		height: number;
		/** Extra rows rendered above and below the visible range. */
		overscan?: number;
		/** Omit the extra Tab stop when the parent owns keyboard navigation. */
		tabindex?: number | null;
		/** Row content, called with the item and its index. */
		children?: Snippet<[T, number]>;
	}

	let {
		items,
		itemHeight = 0,
		estimateSize,
		height,
		overscan = DEFAULT_OVERSCAN,
		children,
		tabindex = 0
	}: Props = $props();

	let scrollTop = $state(0);
	let viewport: HTMLDivElement | undefined = $state();
	// Measured row heights keyed by item, so a reassigned array of the same
	// items keeps its measurements. Entries for items no longer present are
	// dropped when the list changes. ponytail: equal primitive items (two
	// identical strings) share one measurement; pass objects if that matters.
	let measured = $state.raw<Map<T, number>>(new Map());
	$effect.pre(() => {
		const present = new Set(items);
		const kept = new Map<T, number>();
		for (const [item, size] of untrack(() => measured)) {
			if (present.has(item)) kept.set(item, size);
		}
		measured = kept;
	});

	const offsets = $derived(
		estimateSize
			? prefixOffsets(items.map((item, index) => measured.get(item) ?? estimateSize(index)))
			: null
	);

	const range = $derived(
		offsets
			? computeVariableWindow({ offsets, viewportHeight: height, scrollTop, overscan })
			: computeWindow({
					itemCount: items.length,
					itemHeight,
					viewportHeight: height,
					scrollTop,
					overscan
				})
	);

	const visible = $derived(items.slice(range.start, range.end));
	const spacerHeight = $derived(
		offsets ? (offsets[offsets.length - 1] ?? 0) : totalHeight(items.length, itemHeight)
	);

	function handleScroll(event: Event): void {
		const target = event.currentTarget;
		if (target instanceof HTMLElement) scrollTop = target.scrollTop;
	}

	function measureRows(rows: Iterable<Element>): void {
		let next: Map<T, number> | null = null;
		let shiftAbove = 0;
		for (const element of rows) {
			const row = element as HTMLElement;
			const index = Number(row.dataset.virtualIndex);
			if (!(index in items)) continue;
			const item = items[index] as T;
			const size = row.offsetHeight;
			// A hidden list reports 0 for every row; keep the last good size.
			if (size === 0) continue;
			const previous = measured.get(item) ?? estimateSize?.(index) ?? size;
			if (size === previous && measured.has(item)) continue;
			next ??= new Map(measured);
			next.set(item, size);
			// Keep the visible content still when a row above it resizes.
			if (offsets && (offsets[index] ?? 0) < scrollTop) shiftAbove += size - previous;
		}
		if (!next) return;
		measured = next;
		if (shiftAbove && viewport) viewport.scrollTop += shiftAbove;
	}

	const observer =
		typeof ResizeObserver === 'undefined'
			? null
			: new ResizeObserver((entries) => measureRows(entries.map((entry) => entry.target)));

	$effect(() => () => observer?.disconnect());

	// Rows are keyed by index, so after a reassignment a mounted row can show a
	// new item at the same size, which the observer never reports. Measure the
	// mounted rows once the new items have rendered.
	$effect(() => {
		void items;
		if (!estimateSize || !observer || !viewport) return;
		const rows = viewport.querySelectorAll('[data-virtual-index]');
		untrack(() => measureRows(rows));
	});

	function measure(row: HTMLElement) {
		if (!estimateSize || !observer) return;
		observer.observe(row);
		return { destroy: () => observer.unobserve(row) };
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex (Scrollable regions need a keyboard focus target.) -->
<div
	bind:this={viewport}
	data-testid="virtual-viewport"
	{tabindex}
	onscroll={handleScroll}
	style="height: {height}px; overflow-y: auto; position: relative;"
>
	<div data-testid="virtual-spacer" style="height: {spacerHeight}px; position: relative;">
		{#each visible as item, offset (range.start + offset)}
			{@const index = range.start + offset}
			{#if offsets}
				<div
					use:measure
					data-virtual-index={index}
					style="position: absolute; top: {offsets[index]}px; left: 0; right: 0;"
				>
					{@render children?.(item, index)}
				</div>
			{:else}
				<div
					data-virtual-index={index}
					style="position: absolute; top: {index * itemHeight}px; height: {itemHeight}px; left: 0; right: 0;"
				>
					{@render children?.(item, index)}
				</div>
			{/if}
		{/each}
	</div>
</div>

<style>
	[data-testid="virtual-viewport"]:focus-visible {
		outline: 2px solid currentColor;
		outline-offset: -2px;
	}
</style>
