<!-- MIT License — Svelte 5 port of Extend UI color-picker. Upstream: extend-hq/ui (MIT). -->
<script lang="ts">
	import { docsTheme } from '../_shell/theme.svelte.js';
	import { onMount } from 'svelte';
	import { ColorPicker, ColorPickerPanel } from '#lib/components/color-picker/index.js';

	let isDark = $derived(docsTheme.isDark);
	// Set once hydrated so tests know the controls are live.
	let ready = $state(false);
	onMount(() => (ready = true));
	let brand = $state('#2563EB');
	let highlight = $state('#F59E0B');
	let overlay = $state('#11182780');
	let fill = $state('#EF4444');
</script>

<h1>Color Picker</h1>
<p>
	Pick a color from an OKLCH plane, hue and opacity sliders, or typed values in Hex, RGB, HSL,
	or OKLCH. Dark mode is controlled by the parent through <code>isDark</code>; the toggle below
	lives outside the component.
</p>
<p data-ready={ready || undefined}>
	<label>
		<input type="checkbox" bind:checked={isDark} />
		Dark mode
	</label>
</p>

<div data-testid="color-picker-demos" style="display: grid; gap: 1.5rem; max-width: 40rem;">
	<section>
		<h2>Input</h2>
		<ColorPicker label="Brand color" value={brand} onChange={(next) => (brand = next)} {isDark} />
		<p data-testid="brand-value">Brand: {brand}</p>
	</section>

	<section>
		<h2>Swatch</h2>
		<ColorPicker
			label="Highlight color"
			color={highlight}
			onChange={(next) => (highlight = next)}
			{isDark}
		/>
		<p data-testid="highlight-value">Highlight: {highlight}</p>
	</section>

	<section>
		<h2>With opacity</h2>
		<ColorPicker
			label="Overlay color"
			value={overlay}
			showAlpha
			onChange={(next) => (overlay = next)}
			{isDark}
		/>
		<p data-testid="overlay-value">Overlay: {overlay}</p>
	</section>

	<section data-testid="panel-demo">
		<h2>Inline panel</h2>
		<ColorPickerPanel label="Fill" color={fill} onChange={(next) => (fill = next)} {isDark} />
		<p data-testid="panel-value">Fill: {fill}</p>
	</section>

	<section>
		<h2>Disabled</h2>
		<ColorPicker label="Disabled color" value="#6B7280" variant="swatch" disabled {isDark} />
		<p>
			A disabled panel locks only its channel and opacity fields, like upstream; the plane,
			sliders, value field, and format picker stay live.
		</p>
		<div data-testid="disabled-panel-demo">
			<ColorPicker label="Locked fill" value="#6B728080" variant="panel" showAlpha disabled {isDark} />
		</div>
	</section>
</div>

<section aria-labelledby="differences-from-upstream">
	<h2 id="differences-from-upstream">Differences from upstream</h2>
	<ul>
		<li>
			Exported as <code>ColorPicker</code> and <code>ColorPickerPanel</code>, like upstream.
			<code>className</code> and <code>class</code> are both accepted.
		</li>
		<li><code>icon</code> is a Svelte snippet instead of a React component type.</li>
		<li>
			The format picker is a native <code>select</code> (no Select or Tooltip primitives are
			ported).
		</li>
		<li>
			The popover opens inline below the trigger instead of floating in a portal. It behaves
			like upstream's Popover otherwise: the trigger reports <code>aria-expanded</code>, focus
			moves into the panel on open, Escape, a click outside, or tabbing out closes it, and focus
			returns to the trigger.
		</li>
		<li>
			The copy button beside each channel row, focus-reselect, and opacity scrub-dragging are
			not ported. Copying a fully selected value field copies the CSS color, like upstream.
		</li>
		<li>
			In containers narrower than the panel (phones), the fields column wraps under the plane;
			upstream keeps one row and overflows.
		</li>
		<li>
			Accepts <code>isDark</code> and <code>onIsDarkChange</code>; it reflects <code>isDark</code>
			and never calls <code>onIsDarkChange</code>.
		</li>
		<li>
			Port addition: <code>ColorPicker</code> passes any other attributes (for example
			<code>id</code>, <code>data-*</code>, <code>aria-*</code>) through to its root element;
			upstream's <code>ColorPickerProps</code> accepts no extra attributes.
		</li>
	</ul>
</section>

<p><a href="/">Back to overview</a></p>
