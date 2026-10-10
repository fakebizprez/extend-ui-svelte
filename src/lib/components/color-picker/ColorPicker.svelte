<!--
	MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
	Ported from apps/v4/components/ui/color-picker.tsx (ColorPicker).
	Deliberate API changes vs React:
	- `class` and `className` are both accepted and merged onto the root.
	- `icon` is a Svelte snippet instead of a React component type.
	- The format picker is a native `select` (no Select primitive ported yet).
	- The popover is an inline disclosure panel (no Popover/floating port yet);
	  it toggles from the trigger and closes on Escape.
	- Copy buttons, focus-reselect, and alpha scrub-dragging are omitted.
	- The panel wraps its fields column under the plane when its container is
	  narrower than the panel (upstream keeps one row and overflows).
	- Accepts the shared dark-mode contract (`isDark`, `onIsDarkChange`); the
	  parent controls the theme, so `onIsDarkChange` is never invoked here.
-->
<script lang="ts" module>
	import { cuspColorForHue, rgbaToHex } from './color-utils.js';

	export type ColorPickerVariant = 'input' | 'swatch' | 'panel';
	export type { ColorFormat } from './color-utils.js';

	// Upstream renders the swatch trigger (and the eyedropper) as <Button size="icon-sm"> with the
	// outline variant (ghost when an icon or rainbow trigger is shown). These
	// are the layout, size, and variant classes of that Button; `p-0` stands in
	// for the preflight reset so native button padding never shrinks it.
	const SWATCH_TRIGGER_BASE =
		'relative inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border p-0 outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-64 sm:size-7';
	const SWATCH_TRIGGER_OUTLINE =
		'border-input bg-popover text-foreground shadow-xs/5 hover:bg-accent/50 dark:bg-input/32 dark:hover:bg-input/64';
	const SWATCH_TRIGGER_GHOST = 'border-transparent bg-transparent text-foreground hover:bg-accent';

	const OK_HUE_TRACK = `linear-gradient(to bottom, ${Array.from(
		{ length: 25 },
		(_, i) => rgbaToHex(cuspColorForHue(i * 15))
	).join(', ')})`;
</script>

<script lang="ts">
	import { type Snippet } from 'svelte';
	import {
		clamp,
		formatColorValue,
		getOklchPlanePixels,
		hslToRgb,
		hsvToHsl,
		normalizeHue,
		oklchPlaneToRgb,
		oklchToRgb,
		parseColorInput,
		rgbToHsv,
		rgbToOklch,
		rgbToOklchPlane,
		type ColorFormat,
		type ColorParts,
		type HslColor,
		type HsvColor,
		type OklchColor,
		type RgbColor
	} from './color-utils.js';
	import type { DarkModeProps } from '../../dark-mode.js';
	import { cn } from '../../utils.js';
	import DraftInput from './draft-input.svelte';
	import VerticalSlider from './vertical-slider.svelte';

	export interface ColorPickerProps extends DarkModeProps {
		value?: string;
		color?: string;
		onChange?: (value: string) => void;
		label?: string;
		disabled?: boolean;
		showAlpha?: boolean;
		defaultFormat?: ColorFormat;
		variant?: ColorPickerVariant;
		class?: string;
		/** Alias of `class`, matching the upstream React prop name. Both are merged. */
		className?: string;
		icon?: Snippet;
		rainbowTrigger?: boolean;
		onTriggerMouseDown?: (event: MouseEvent) => void;
		onTriggerPointerDown?: (event: PointerEvent) => void;
		[key: string]: unknown;
	}

	interface HsvaColor {
		h: number;
		s: number;
		v: number;
		a: number;
	}

	interface PickerState {
		plane: HsvColor;
		rgb: RgbColor;
		a: number;
	}

	interface ChannelSpec {
		key: string;
		label: string;
		ariaLabel: string;
		value: string;
		numericValue: number;
		step: number;
		bigStep: number;
		commit: (next: number) => void;
	}

	let {
		value: valueProp,
		color,
		onChange,
		label = 'Choose color',
		disabled = false,
		showAlpha = false,
		defaultFormat = 'hex',
		variant,
		class: className = '',
		className: classNameAlias = '',
		icon,
		rainbowTrigger = false,
		onTriggerMouseDown,
		onTriggerPointerDown,
		isDark = false,
		// Shared-contract parity; intentionally unused, the parent owns the theme.
		onIsDarkChange: _onIsDarkChange,
		...rest
	}: ColorPickerProps = $props();

	const COLOR_FORMAT_OPTIONS: Array<{ value: ColorFormat; label: string }> = [
		{ value: 'oklch', label: 'OKLCH' },
		{ value: 'hsl', label: 'HSL' },
		{ value: 'rgb', label: 'RGB' },
		{ value: 'hex', label: 'Hex' }
	];

	const externalValue = $derived(valueProp ?? color ?? '#111827');
	const resolvedVariant = $derived(variant ?? (color !== undefined ? 'swatch' : 'input'));

	let open = $state(false);
	// Initial capture is intended: the format default applies at mount.
	let format = $state<ColorFormat>(defaultFormat);

	function parseInitialPicker(): PickerState {
		// Initial capture is intended: uncontrolled state starts from the mount value.
		const parsed = parseColorInput(externalValue, 'hex');
		if (!parsed)
			return { plane: { h: 0, s: 0, v: 0 }, rgb: { r: 0, g: 0, b: 0 }, a: 1 };
		return {
			plane: rgbToOklchPlane(parsed.rgb),
			rgb: parsed.rgb,
			a: showAlpha ? (parsed.alpha ?? 1) : 1
		};
	}

	let picker = $state<PickerState>(parseInitialPicker());
	let pending = $state<string[]>([]);
	let prevExternal = $state({ value: externalValue, showAlpha });

	// Ignore hue noise from RGB round trips.
	function withHueContinuity<T extends { h: number }>(
		next: T,
		previousHue: number,
		chromaFraction: number
	): T {
		const delta = Math.abs(next.h - previousHue) % 360;
		const angular = Math.min(delta, 360 - delta);
		const tolerance = Math.min(10, 1.5 / Math.max(chromaFraction, 0.15));
		return angular < tolerance ? { ...next, h: previousHue } : next;
	}

	// Sync controlled updates from the parent, ignoring echoes of our own commits.
	$effect(() => {
		const nextValue = externalValue;
		const nextShowAlpha = showAlpha;
		const prev = prevExternal;
		if (nextValue === prev.value && nextShowAlpha === prev.showAlpha) return;
		prevExternal = { value: nextValue, showAlpha: nextShowAlpha };
		const parsed = nextValue ? parseColorInput(nextValue, 'hex') : null;
		const alpha = nextShowAlpha ? (parsed?.alpha ?? picker.a) : 1;
		const incoming = parsed ? rgbaToHex(parsed.rgb, alpha) : null;
		const echoIndex = incoming === null ? -1 : pending.lastIndexOf(incoming);
		const wasLast = echoIndex === pending.length - 1;
		pending = echoIndex < 0 ? [] : pending.slice(echoIndex + 1);
		if (parsed && (echoIndex < 0 || wasLast || prev.showAlpha !== nextShowAlpha)) {
			if (rgbaToHex(picker.rgb, picker.a) !== incoming) {
				const derivedPlane = rgbToOklchPlane(parsed.rgb, picker.plane.h);
				picker = {
					plane: withHueContinuity(derivedPlane, picker.plane.h, derivedPlane.s / 100),
					rgb: parsed.rgb,
					a: alpha
				};
			}
		}
	});

	function applyState(next: PickerState) {
		picker = next;
		const hex = rgbaToHex(next.rgb, next.a);
		if ((valueProp !== undefined || color !== undefined) && onChange) {
			pending = [...pending, hex];
		}
		onChange?.(hex);
	}

	function commitHsva(next: HsvaColor) {
		const plane: HsvColor = {
			h: clamp(next.h, 0, 360),
			s: clamp(next.s, 0, 100),
			v: clamp(next.v, 0, 100)
		};
		applyState({
			plane,
			rgb: oklchPlaneToRgb(plane),
			a: showAlpha ? clamp(next.a, 0, 1) : 1
		});
	}

	function commitRgb(nextRgb: RgbColor, alpha?: number | null, intendedHue?: number) {
		const exact: RgbColor = {
			r: clamp(nextRgb.r, 0, 255),
			g: clamp(nextRgb.g, 0, 255),
			b: clamp(nextRgb.b, 0, 255)
		};
		const targetHue = intendedHue ?? picker.plane.h;
		const derivedPlane = rgbToOklchPlane(exact, targetHue);
		applyState({
			plane: withHueContinuity(derivedPlane, targetHue, derivedPlane.s / 100),
			rgb: exact,
			a: showAlpha ? clamp(alpha ?? picker.a, 0, 1) : 1
		});
	}

	function commitHsl(nextHsl: HslColor) {
		commitRgb(hslToRgb(nextHsl));
	}

	function commitOklch(nextOklch: OklchColor) {
		commitRgb(oklchToRgb(nextOklch), undefined, normalizeHue(nextOklch.h));
	}

	function commitText(text: string) {
		const parsed = parseColorInput(text, format);
		if (!parsed) return;
		if (parsed.format && parsed.format !== format) format = parsed.format;
		commitRgb(parsed.rgb, parsed.alpha);
	}

	function parseChannelText(text: string): number | null {
		const numeric = Number.parseFloat(text.replace(/[%°]/g, '').trim());
		return Number.isFinite(numeric) ? numeric : null;
	}

	function commitAlphaPercent(percent: number) {
		commitHsva({ ...hsva, a: clamp(percent, 0, 100) / 100 });
	}

	const hsva = $derived({ ...picker.plane, a: picker.a });
	const displayHsv = $derived(rgbToHsv(picker.rgb, picker.plane.h));
	const hsl = $derived(hsvToHsl(displayHsv));
	const rawOklch = $derived(rgbToOklch(picker.rgb, hsva.h));
	const oklch = $derived(withHueContinuity(rawOklch, hsva.h, rawOklch.c / 0.33));
	const parts = $derived<ColorParts>({ rgb: picker.rgb, hsl, oklch, alpha: hsva.a });
	const opaqueColor = $derived(
		`rgb(${Math.round(picker.rgb.r)} ${Math.round(picker.rgb.g)} ${Math.round(picker.rgb.b)})`
	);
	const currentColor = $derived(
		`rgb(${Math.round(picker.rgb.r)} ${Math.round(picker.rgb.g)} ${Math.round(picker.rgb.b)} / ${hsva.a})`
	);

	const oklchChannels = $derived<ChannelSpec[]>([
		{
			key: 'l',
			label: 'L',
			ariaLabel: 'OKLCH lightness',
			value: (oklch.l * 100).toFixed(1),
			numericValue: oklch.l * 100,
			step: 1,
			bigStep: 10,
			commit: (next) => commitOklch({ ...oklch, l: clamp(next, 0, 100) / 100 })
		},
		{
			key: 'c',
			label: 'C',
			ariaLabel: 'OKLCH chroma',
			value: oklch.c.toFixed(3),
			numericValue: oklch.c,
			step: 0.01,
			bigStep: 0.05,
			commit: (next) => commitOklch({ ...oklch, c: Math.max(0, next) })
		},
		{
			key: 'h',
			label: 'H',
			ariaLabel: 'OKLCH hue',
			value: oklch.h.toFixed(1),
			numericValue: oklch.h,
			step: 1,
			bigStep: 10,
			commit: (next) => commitOklch({ ...oklch, h: normalizeHue(next) })
		}
	]);

	const hslChannels = $derived<ChannelSpec[]>([
		{
			key: 'h',
			label: 'H',
			ariaLabel: 'HSL hue',
			value: hsl.h.toFixed(1),
			numericValue: hsl.h,
			step: 1,
			bigStep: 10,
			commit: (next) => commitHsl({ ...hsl, h: normalizeHue(next) })
		},
		{
			key: 's',
			label: 'S',
			ariaLabel: 'HSL saturation',
			value: hsl.s.toFixed(1),
			numericValue: hsl.s,
			step: 1,
			bigStep: 10,
			commit: (next) => commitHsl({ ...hsl, s: clamp(next, 0, 100) })
		},
		{
			key: 'l',
			label: 'L',
			ariaLabel: 'HSL lightness',
			value: hsl.l.toFixed(1),
			numericValue: hsl.l,
			step: 1,
			bigStep: 10,
			commit: (next) => commitHsl({ ...hsl, l: clamp(next, 0, 100) })
		}
	]);

	const rgbChannels = $derived<ChannelSpec[]>(
		(['r', 'g', 'b'] as const).map((channel) => ({
			key: channel,
			label: channel.toUpperCase(),
			ariaLabel: { r: 'Red', g: 'Green', b: 'Blue' }[channel],
			value: String(Math.round(picker.rgb[channel])),
			numericValue: picker.rgb[channel],
			step: 1,
			bigStep: 10,
			commit: (next) => commitRgb({ ...picker.rgb, [channel]: clamp(next, 0, 255) })
		}))
	);

	const allChannelGroups = $derived([oklchChannels, hslChannels, rgbChannels]);

	const supportsEyeDropper =
		typeof window !== 'undefined' &&
		(window as unknown as { EyeDropper?: unknown }).EyeDropper !== undefined;

	function handleEyeDropper() {
		const ctor = (window as unknown as { EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> } })
			.EyeDropper;
		if (!ctor) return;
		new ctor()
			.open()
			.then((result) => {
				const parsed = parseColorInput(result.sRGBHex, 'hex');
				if (parsed) commitRgb(parsed.rgb);
			})
			.catch(() => {});
	}

	function toggleOpen() {
		if (!disabled) open = !open;
	}

	function closeOnEscape(event: KeyboardEvent) {
		if (event.key === 'Escape') open = false;
	}

	function handleFormatChange(event: Event) {
		const next = (event.currentTarget as HTMLSelectElement).value;
		if (COLOR_FORMAT_OPTIONS.some((option) => option.value === next)) {
			format = next as ColorFormat;
		}
	}

	// Picker-plane canvas: drawn on the client, guarded for SSR and canvas-less jsdom.
	let planeCanvas = $state<HTMLCanvasElement | undefined>(undefined);
	const quantizedHue = $derived(Math.round(normalizeHue(hsva.h) * 2) / 2);
	$effect(() => {
		const canvas = planeCanvas;
		if (!canvas) return;
		const context = canvas.getContext('2d');
		if (!context) return;
		const image = context.createImageData(canvas.width, canvas.height);
		image.data.set(getOklchPlanePixels(canvas.width, canvas.height, quantizedHue));
		context.putImageData(image, 0, 0);
	});

	function movePlane(s: number, v: number) {
		commitHsva({ ...hsva, s, v });
	}

	function updatePlaneFromPointer(event: PointerEvent) {
		const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
		const inset = 7;
		movePlane(
			clamp(((event.clientX - rect.left - inset) / (rect.width - inset * 2)) * 100, 0, 100),
			clamp(100 - ((event.clientY - rect.top - inset) / (rect.height - inset * 2)) * 100, 0, 100)
		);
	}
</script>

{#snippet checkerboard(size: number)}
	<span
		aria-hidden="true"
		class="pointer-events-none absolute inset-0 bg-white [--checker:#00000024] dark:bg-neutral-700 dark:[--checker:#ffffff2e]"
		style="background-image: conic-gradient(var(--checker) 0 25%, transparent 0 50%, var(--checker) 0 75%, transparent 0); background-size: {size}px {size}px;"
	></span>
{/snippet}

{#snippet channelGroup(channels: ChannelSpec[])}
	<div class="flex items-start gap-1.5">
		<div class="min-w-0 flex-1">
			<div class="relative grid h-8 grid-cols-3 rounded-md border border-input bg-popover">
				{#each channels as channel (channel.key)}
					<DraftInput
						aria-label={channel.ariaLabel}
						class="h-full w-full min-w-0 border-0 bg-transparent px-1 py-0 text-center text-sm leading-none tabular-nums outline-none"
						{disabled}
						inputMode="decimal"
						value={channel.value}
						onCommitText={(text) => {
							const numeric = parseChannelText(text);
							if (numeric !== null) channel.commit(numeric);
						}}
						onStep={(direction, big) =>
							channel.commit(channel.numericValue + direction * (big ? channel.bigStep : channel.step))}
					/>
				{/each}
			</div>
			<div class="mt-1 grid h-4 grid-cols-3 items-center text-center text-xs font-medium">
				{#each channels as channel (channel.key)}
					<span>{channel.label}</span>
				{/each}
			</div>
		</div>
	</div>
{/snippet}

{#snippet panel()}
	<!-- flex-wrap: in containers narrower than the panel (phones) the fields
	     column drops under the plane instead of overflowing. Upstream never wraps. -->
	<div class="flex flex-wrap items-stretch gap-3">
		<button
			type="button"
			aria-label="Chroma and lightness"
			class="relative size-53 shrink-0 cursor-crosshair touch-none rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
			{disabled}
			onpointerdown={(event) => {
				if (disabled) return;
				event.preventDefault();
				event.currentTarget.setPointerCapture?.(event.pointerId);
				event.currentTarget.focus();
				updatePlaneFromPointer(event);
			}}
			onpointermove={(event) => {
				if (disabled || (event.buttons & 1) === 0) return;
				updatePlaneFromPointer(event);
			}}
			onkeydown={(event) => {
				if (disabled) return;
				const delta = event.shiftKey ? 10 : 1;
				let next: [number, number] | null = null;
				if (event.key === 'ArrowLeft') next = [hsva.s - delta, hsva.v];
				if (event.key === 'ArrowRight') next = [hsva.s + delta, hsva.v];
				if (event.key === 'ArrowUp') next = [hsva.s, hsva.v + delta];
				if (event.key === 'ArrowDown') next = [hsva.s, hsva.v - delta];
				if (next) {
					event.preventDefault();
					movePlane(clamp(next[0], 0, 100), clamp(next[1], 0, 100));
				}
			}}
		>
			<canvas
				bind:this={planeCanvas}
				aria-hidden="true"
				width={168}
				height={168}
				class="pointer-events-none absolute inset-0 size-full rounded-[inherit]"
			></canvas>
			<span
				class="pointer-events-none absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-white"
				style="left: calc(7px + (100% - 14px) * {clamp(hsva.s, 0, 100) / 100}); top: calc(7px + (100% - 14px) * {clamp(100 - hsva.v, 0, 100) / 100}); background-color: {opaqueColor};"
			></span>
		</button>

		<div class="flex shrink-0 flex-col items-center gap-1.5 self-stretch">
			<div class="flex min-h-0 flex-1 items-stretch gap-2">
				{#if showAlpha}
					<VerticalSlider
						ariaLabel="Opacity"
						ariaValueMax={100}
						ariaValueNow={Math.round(hsva.a * 100)}
						ariaValueText="{Math.round(hsva.a * 100)}%"
						fraction={1 - hsva.a}
						onFraction={(fraction) => commitHsva({ ...hsva, a: 1 - fraction })}
						onStep={(direction, big) =>
							commitHsva({ ...hsva, a: clamp(hsva.a + direction * (big ? 0.1 : 0.01), 0, 1) })}
						{disabled}
					>
						{#snippet track()}
							{@render checkerboard(6)}
							<span
								class="absolute inset-0"
								style="background: linear-gradient(to bottom, {opaqueColor}, transparent);"
							></span>
						{/snippet}
					</VerticalSlider>
				{/if}

				<VerticalSlider
					ariaLabel="Hue"
					ariaValueMax={360}
					ariaValueNow={Math.round(hsva.h)}
					fraction={clamp(hsva.h, 0, 360) / 360}
					onFraction={(fraction) => commitHsva({ ...hsva, h: fraction * 360 })}
					onStep={(direction, big) =>
						commitHsva({ ...hsva, h: clamp(hsva.h - direction * (big ? 10 : 1), 0, 360) })}
					{disabled}
				>
					{#snippet track()}
						<span class="absolute inset-0" style="background: {OK_HUE_TRACK};"></span>
					{/snippet}
				</VerticalSlider>
			</div>
			{#if supportsEyeDropper}
				<button
					type="button"
					aria-label="Pick color from screen"
					title="Pick color from screen"
					class={cn(SWATCH_TRIGGER_BASE, SWATCH_TRIGGER_OUTLINE, 'size-8! shrink-0')}
					{disabled}
					onclick={handleEyeDropper}
				>
					<!-- Lucide "pipette", the upstream IconPlaceholder default. -->
					<svg
						aria-hidden="true"
						class="size-4"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d="m2 22 1-1h3l9-9" />
						<path d="M3 21v-3l9-9" />
						<path
							d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z"
						/>
					</svg>
				</button>
			{/if}
		</div>

		<div class="flex w-64 shrink-0 flex-col gap-2">
			{#each allChannelGroups as channels, index (index)}
				{@render channelGroup(channels)}
			{/each}

			<div class="flex items-center gap-1.5">
				<div class="flex h-8 min-w-0 flex-1 items-center rounded-md border border-input bg-popover">
					<DraftInput
						aria-label="Color value"
						class="h-full min-w-0 flex-1 rounded-[inherit] border-0 bg-transparent px-2 py-0 text-center text-sm leading-none tabular-nums outline-none"
						value={formatColorValue(format, parts)}
						onCommitText={commitText}
						{disabled}
					/>
					{#if showAlpha}
						<div class="flex h-full shrink-0 items-center gap-0.5 pr-2 pl-0.5">
							<DraftInput
								aria-label="Panel opacity"
								class="w-8 border-0 bg-transparent p-0 text-right text-sm tabular-nums outline-none"
								{disabled}
								inputMode="decimal"
								value={String(Math.round(hsva.a * 100))}
								onCommitText={(text) => {
									const numeric = parseChannelText(text);
									if (numeric !== null) commitAlphaPercent(clamp(numeric, 0, 100));
								}}
								onStep={(direction, big) =>
									commitAlphaPercent(clamp(hsva.a * 100 + direction * (big ? 10 : 1), 0, 100))}
							/>
							<span class="text-sm">%</span>
						</div>
					{/if}
				</div>
				<select
					aria-label="Color format"
					class="size-8 shrink-0"
					value={format}
					{disabled}
					onchange={handleFormatChange}
				>
					{#each COLOR_FORMAT_OPTIONS as option (option.value)}
						<option value={option.value}>{option.label}</option>
					{/each}
				</select>
			</div>
		</div>
	</div>
{/snippet}

{#if resolvedVariant === 'panel'}
	<div class={cn('flex items-stretch gap-3', className, classNameAlias, isDark && 'dark')} {...rest}>
		{@render panel()}
	</div>
{:else}
	<div class={cn(isDark && 'dark')} {...rest}>
		{#if resolvedVariant === 'swatch'}
			<button
				type="button"
				aria-label={label}
				disabled={disabled}
				data-color-picker-trigger=""
				class={cn(
					SWATCH_TRIGGER_BASE,
					icon || rainbowTrigger ? SWATCH_TRIGGER_GHOST : SWATCH_TRIGGER_OUTLINE,
					className,
					classNameAlias
				)}
				onclick={toggleOpen}
				onmousedown={(event) => onTriggerMouseDown?.(event)}
				onpointerdown={(event) => onTriggerPointerDown?.(event)}
			>
				{#if rainbowTrigger}
					<span
						aria-hidden="true"
						class="size-5 shrink-0 rounded-full"
						style="background: conic-gradient(from 90deg,#ff3b30,#ffcc00,#34c759,#00c7be,#007aff,#af52de,#ff2d55,#ff3b30);"
					></span>
				{:else if icon}
					{@render icon()}
					<span
						aria-hidden="true"
						class="absolute right-1 bottom-1 h-1 w-4 rounded-full border"
						style="background-color: {currentColor};"
					></span>
				{:else}
					<span
						data-slot="color-picker-swatch"
						class="relative size-4 shrink-0 overflow-hidden rounded-[4px]"
					>
						{@render checkerboard(4)}
						<span
							aria-hidden="true"
							data-slot="color-picker-swatch-fill"
							class="absolute inset-0"
							style="background-color: {currentColor};"
						></span>
						<span
							aria-hidden="true"
							class="absolute inset-0 rounded-[inherit] ring-1 ring-black/12 ring-inset dark:ring-white/16"
						></span>
					</span>
				{/if}
			</button>
		{:else}
			<div
				data-color-picker-trigger=""
				data-slot="color-picker"
				class={cn(
					'relative flex h-10 w-full min-w-0 items-center rounded-md border border-input bg-popover text-base',
					className,
					classNameAlias
				)}
			>
				<button
					type="button"
					aria-label={label}
					disabled={disabled}
					class="relative ml-2 size-6 shrink-0 overflow-hidden rounded-[calc(var(--radius-md)-2px)]"
					onclick={toggleOpen}
				>
					{@render checkerboard(6)}
					<span aria-hidden="true" class="absolute inset-0" style="background-color: {currentColor};"></span>
				</button>
				<DraftInput
					aria-label="{label} value"
					class="h-full w-full min-w-0 grow border-0 bg-transparent px-[calc(--spacing(2.5)-1px)] text-base tabular-nums outline-none"
					{disabled}
					value={formatColorValue(format, parts)}
					onCommitText={commitText}
				/>
				{#if showAlpha}
					<div class="flex h-full shrink-0 items-center gap-0.5 pr-[calc(--spacing(3)-1px)] pl-1">
						<DraftInput
							aria-label="Opacity"
							class="w-8 border-0 bg-transparent p-0 text-right text-base tabular-nums outline-none"
							{disabled}
							inputMode="decimal"
							value={String(Math.round(hsva.a * 100))}
							onCommitText={(text) => {
								const numeric = parseChannelText(text);
								if (numeric !== null) commitAlphaPercent(clamp(numeric, 0, 100));
							}}
							onStep={(direction, big) =>
								commitAlphaPercent(clamp(hsva.a * 100 + direction * (big ? 10 : 1), 0, 100))}
						/>
						<span class="text-base">%</span>
					</div>
				{/if}
			</div>
		{/if}
		{#if open}
			<div role="dialog" aria-label="{label} panel" tabindex={-1} onkeydown={closeOnEscape}>
				{@render panel()}
			</div>
		{/if}
	</div>
{/if}
