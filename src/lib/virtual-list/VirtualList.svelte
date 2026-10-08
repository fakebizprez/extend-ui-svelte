<!--
	MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
	Shared virtual list: renders only the windowed subset of a large list so
	pages, sheet rows, and slide lists never render all at once.
-->
<script lang="ts" generics="T">
	import type { Snippet } from 'svelte';
	import { computeWindow, DEFAULT_OVERSCAN, totalHeight } from './window';

	interface Props {
		/** All items; only the visible window is rendered. */
		items: T[];
		/** Fixed height of one row in pixels. */
		itemHeight: number;
		/** Visible height of the scroll viewport in pixels. */
		height: number;
		/** Extra rows rendered above and below the visible range. */
		overscan?: number;
		/** Row content, called with the item and its index. */
		children?: Snippet<[T, number]>;
	}

	let {
		items,
		itemHeight,
		height,
		overscan = DEFAULT_OVERSCAN,
		children
	}: Props = $props();

	let scrollTop = $state(0);

	const range = $derived(
		computeWindow({
			itemCount: items.length,
			itemHeight,
			viewportHeight: height,
			scrollTop,
			overscan
		})
	);

	const visible = $derived(items.slice(range.start, range.end));
	const spacerHeight = $derived(totalHeight(items.length, itemHeight));

	function handleScroll(event: Event): void {
		const target = event.currentTarget;
		if (target instanceof HTMLElement) scrollTop = target.scrollTop;
	}
</script>

<div
	data-testid="virtual-viewport"
	onscroll={handleScroll}
	style="height: {height}px; overflow-y: auto; position: relative;"
>
	<div data-testid="virtual-spacer" style="height: {spacerHeight}px; position: relative;">
		{#each visible as item, offset (range.start + offset)}
			{@const index = range.start + offset}
			<div
				data-virtual-index={index}
				style="position: absolute; top: {index * itemHeight}px; height: {itemHeight}px; left: 0; right: 0;"
			>
				{@render children?.(item, index)}
			</div>
		{/each}
	</div>
</div>
