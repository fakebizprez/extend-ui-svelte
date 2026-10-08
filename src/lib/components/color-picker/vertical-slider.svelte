<!--
	MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
	Internal vertical slider ported from the VerticalSlider helper in
	apps/v4/components/ui/color-picker.tsx. Not part of the public API.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { clamp } from './color-utils.js';

	interface VerticalSliderProps {
		ariaLabel: string;
		ariaValueMax: number;
		ariaValueNow: number;
		ariaValueText?: string;
		fraction: number;
		onFraction: (fraction: number) => void;
		onStep: (direction: 1 | -1, big: boolean) => void;
		track: Snippet;
		disabled?: boolean;
	}

	let {
		ariaLabel,
		ariaValueMax,
		ariaValueNow,
		ariaValueText,
		fraction,
		onFraction,
		onStep,
		track,
		disabled = false
	}: VerticalSliderProps = $props();

	function update(event: PointerEvent) {
		const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
		const inset = 2.5;
		onFraction(clamp((event.clientY - rect.top - inset) / (rect.height - inset * 2), 0, 1));
	}
</script>

<button
	type="button"
	role="slider"
	aria-label={ariaLabel}
	aria-orientation="vertical"
	aria-valuemin={0}
	aria-valuemax={ariaValueMax}
	aria-valuenow={ariaValueNow}
	aria-valuetext={ariaValueText}
	class="relative w-3 shrink-0 touch-none self-stretch rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
	{disabled}
	onpointerdown={(event) => {
		if (disabled) return;
		event.preventDefault();
		event.currentTarget.setPointerCapture?.(event.pointerId);
		event.currentTarget.focus();
		update(event);
	}}
	onpointermove={(event) => {
		if (disabled || (event.buttons & 1) === 0) return;
		update(event);
	}}
	onkeydown={(event) => {
		if (disabled) return;
		let direction: 1 | -1 | null = null;
		if (event.key === 'ArrowUp' || event.key === 'ArrowRight') direction = 1;
		if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') direction = -1;
		if (direction) {
			event.preventDefault();
			onStep(direction, event.shiftKey);
		}
	}}
>
	<span
		class="absolute inset-0 overflow-hidden rounded-full ring-1 ring-black/8 ring-inset dark:ring-white/12"
	>
		{@render track()}
	</span>
	<span
		class="pointer-events-none absolute left-1/2 h-[5px] w-[calc(100%+3px)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_0_1px_rgb(0_0_0/20%),0_1px_2px_rgb(0_0_0/24%)]"
		style="top: calc(2.5px + (100% - 5px) * {clamp(fraction, 0, 1)})"
	></span>
</button>
