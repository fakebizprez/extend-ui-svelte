<!-- MIT License — Svelte 5 port of Extend UI toggle. Upstream: extend-hq/ui (MIT). -->
<script lang="ts">
	import { onMount } from 'svelte';
	import {
		Toggle,
		ToggleGroup,
		ToggleGroupItem,
		type ToggleSize,
		type ToggleVariant
	} from '#lib/components/toggle/index.js';

	const VARIANTS: ToggleVariant[] = ['default', 'outline'];
	const SIZES: ToggleSize[] = ['sm', 'default', 'lg'];

	let isDark = $state(false);
	// Set once hydrated so tests know the controls are live.
	let ready = $state(false);
	onMount(() => (ready = true));
	let bold = $state(false);
	let alignment = $state(['left']);
	let formatting = $state(['bold']);
</script>

<h1>Toggle</h1>
<p>
	A two-state button, and a group of them with single or multiple selection. Dark mode is
	controlled by the parent through <code>isDark</code>; the toggle below lives outside the
	component.
</p>
<p data-ready={ready || undefined}>
	<label>
		<input type="checkbox" bind:checked={isDark} />
		Dark mode
	</label>
</p>

<h2>Variants and sizes</h2>
<div data-testid="toggle-variants" style="display: grid; gap: 0.5rem;">
	{#each VARIANTS as variant (variant)}
		<div style="display: flex; align-items: center; gap: 0.5rem;">
			{#each SIZES as size (size)}
				<Toggle {variant} {size} aria-label="{variant} {size}" {isDark}>{variant} {size}</Toggle>
			{/each}
		</div>
	{/each}
</div>

<h2>Controlled</h2>
<Toggle
	variant="outline"
	aria-label="Toggle bold"
	pressed={bold}
	onPressedChange={(next) => (bold = next)}
	{isDark}
>
	<strong>B</strong>
</Toggle>
<p data-testid="toggle-status">Bold is {bold ? 'on' : 'off'}</p>

<h2>Disabled</h2>
<Toggle variant="outline" aria-label="Disabled toggle" disabled {isDark}>Disabled</Toggle>

<h2>Single selection</h2>
<ToggleGroup
	aria-label="Text alignment"
	value={alignment}
	onValueChange={(next) => {
		// Like a radio group, keep one alignment pressed.
		if (next.length) alignment = next;
	}}
	{isDark}
>
	<ToggleGroupItem value="left" aria-label="Align left" variant="outline" {isDark}>Left</ToggleGroupItem>
	<ToggleGroupItem value="center" aria-label="Align center" variant="outline" {isDark}>
		Center
	</ToggleGroupItem>
	<ToggleGroupItem value="right" aria-label="Align right" variant="outline" {isDark}>Right</ToggleGroupItem>
</ToggleGroup>
<p data-testid="alignment-status">Alignment: {alignment.join(', ')}</p>

<h2>Multiple selection, joined</h2>
<ToggleGroup
	aria-label="Text formatting"
	multiple
	spacing="none"
	value={formatting}
	onValueChange={(next) => (formatting = next)}
	{isDark}
>
	{#each ['bold', 'italic', 'underline'] as format (format)}
		<ToggleGroupItem value={format} size="sm" variant="outline" {isDark}>
			{format[0]?.toUpperCase()}{format.slice(1)}
		</ToggleGroupItem>
	{/each}
</ToggleGroup>
<p data-testid="formatting-status">
	Formatting: {['bold', 'italic', 'underline'].filter((format) => formatting.includes(format)).join(', ') ||
		'none'}
</p>

<h2>Vertical</h2>
<ToggleGroup aria-label="View mode" orientation="vertical" defaultValue={['list']} {isDark}>
	<ToggleGroupItem value="list" aria-label="List view" {isDark}>List</ToggleGroupItem>
	<ToggleGroupItem value="grid" aria-label="Grid view" {isDark}>Grid</ToggleGroupItem>
</ToggleGroup>

<h2>Disabled group</h2>
<ToggleGroup aria-label="Disabled group" disabled defaultValue={['a']} {isDark}>
	<ToggleGroupItem value="a" {isDark}>A</ToggleGroupItem>
	<ToggleGroupItem value="b" {isDark}>B</ToggleGroupItem>
</ToggleGroup>

<section aria-labelledby="differences-from-upstream">
	<h2 id="differences-from-upstream">Differences from upstream</h2>
	<ul>
		<li>
			Built on plain buttons instead of the Base UI <code>Toggle</code> and
			<code>ToggleGroup</code> primitives (React-only), so <code>TogglePrimitive</code> and
			<code>ToggleGroupPrimitive</code> are not exported. Props follow Base UI:
			<code>pressed</code>, <code>defaultPressed</code>, <code>onPressedChange</code>,
			<code>value</code>, <code>defaultValue</code>, <code>onValueChange</code>,
			<code>multiple</code> (default <code>false</code>), <code>loopFocus</code>,
			<code>disabled</code>, <code>orientation</code>, plus upstream's <code>spacing</code>.
		</li>
		<li>
			<code>onValueChange</code> receives only the new value, without Base UI's event details.
		</li>
		<li>
			<code>className</code> and <code>class</code> are both accepted; <code>children</code> is
			a Svelte snippet.
		</li>
		<li>
			The before-pseudo shadow, touch hit-area, and icon sizing utilities from upstream's class
			list are not ported; variants and sizes are.
		</li>
		<li>
			Accepts <code>isDark</code> and <code>onIsDarkChange</code>; it reflects <code>isDark</code>
			and never calls <code>onIsDarkChange</code>.
		</li>
	</ul>
</section>

<p><a href="/">Back to all components</a></p>
