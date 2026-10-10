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
	import type { Snippet } from 'svelte';
	import {
		computeVariableWindow,
		computeWindow,
		DEFAULT_OVERSCAN,
		prefixOffsets,
		totalHeight
	} from './window';

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
		/** Row content, called with the item and its index. */
		children?: Snippet<[T, number]>;
	}

	let {
		items,
		itemHeight = 0,
		estimateSize,
		height,
		overscan = DEFAULT_OVERSCAN,
		children
	}: Props = $props();

	let scrollTop = $state(0);
	let viewport: HTMLDivElement | undefined = $state();
	// Measured row heights by index; reset whenever the item list changes.
	let measured = $state.raw<Map<number, number>>(new Map());
	$effect.pre(() => {
		void items;
		measured = new Map();
	});

	const offsets = $derived(
		estimateSize
			? prefixOffsets(items.map((_, index) => measured.get(index) ?? estimateSize(index)))
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

	const observer =
		typeof ResizeObserver === 'undefined'
			? null
			: new ResizeObserver((entries) => {
					let next: Map<number, number> | null = null;
					let shiftAbove = 0;
					for (const entry of entries) {
						const row = entry.target as HTMLElement;
						const index = Number(row.dataset.virtualIndex);
						const size = row.offsetHeight;
						const previous = measured.get(index) ?? estimateSize?.(index) ?? size;
						if (size === previous && measured.has(index)) continue;
						next ??= new Map(measured);
						next.set(index, size);
						// Keep the visible content still when a row above it resizes.
						if (offsets && (offsets[index] ?? 0) < scrollTop) shiftAbove += size - previous;
					}
					if (!next) return;
					measured = next;
					if (shiftAbove && viewport) viewport.scrollTop += shiftAbove;
				});

	$effect(() => () => observer?.disconnect());

	function measure(row: HTMLElement) {
		if (!estimateSize || !observer) return;
		observer.observe(row);
		return { destroy: () => observer.unobserve(row) };
	}
</script>

<div
	bind:this={viewport}
	data-testid="virtual-viewport"
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
