<!-- MIT License — Svelte 5 port of Extend UI toggle. Upstream: extend-hq/ui (MIT). -->
<script lang="ts">
	import { docsTheme } from '../_shell/theme.svelte.js';
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

	let isDark = $derived(docsTheme.isDark);
	// Set once hydrated so tests know the controls are live.
	let ready = $state(false);
	onMount(() => (ready = true));
	let bold = $state(false);
	let alignment = $state(['left']);
	let formatting = $state(['bold']);
	let consumerClicks = $state(0);
	let lastKey = $state('none');
	let largePressed = $state('not reported');
	let sizes = $state(['s', 'm', 'l']);
	let submits = $state(0);
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
<p>Grid starts pressed, but Tab enters the group on its first item, like Base UI.</p>
<ToggleGroup aria-label="View mode" orientation="vertical" defaultValue={['grid']} {isDark}>
	<ToggleGroupItem value="list" aria-label="List view" {isDark}>List</ToggleGroupItem>
	<ToggleGroupItem value="grid" aria-label="Grid view" {isDark}>Grid</ToggleGroupItem>
</ToggleGroup>

<h2>Consumer handlers</h2>
<p>
	Your own <code>onclick</code> or <code>onkeydown</code> runs first and the built-in behavior
	still runs.
</p>
<Toggle
	variant="outline"
	aria-label="Toggle italic"
	onclick={() => consumerClicks++}
	{isDark}
>
	<em>I</em>
</Toggle>
<p data-testid="consumer-clicks">Consumer clicks: {consumerClicks}</p>
<ToggleGroup
	aria-label="Font size"
	defaultValue={['small']}
	onkeydown={(event: KeyboardEvent) => (lastKey = event.key)}
	{isDark}
>
	<ToggleGroupItem value="small" aria-label="Small text" onclick={() => consumerClicks++} {isDark}>
		Small
	</ToggleGroupItem>
	<ToggleGroupItem
		value="large"
		aria-label="Large text"
		onPressedChange={(pressed, details) => (largePressed = `${pressed} (${details.reason})`)}
		{isDark}
	>
		Large
	</ToggleGroupItem>
	<!-- No value: the item gets a generated id, like Base UI. -->
	<ToggleGroupItem aria-label="Auto size" {isDark}>Auto</ToggleGroupItem>
</ToggleGroup>
<p data-testid="font-size-key">Last key: {lastKey}</p>
<p data-testid="large-pressed">Large pressed: {largePressed}</p>

<h2>Items added later</h2>
<button type="button" onclick={() => (sizes = ['xs', ...sizes])} disabled={sizes[0] === 'xs'}>
	Add XS at the front
</button>
<ToggleGroup aria-label="Sizes" {isDark}>
	{#each sizes as size (size)}
		<ToggleGroupItem value={size} {isDark}>{size.toUpperCase()}</ToggleGroupItem>
	{/each}
</ToggleGroup>

<h2>Inside a form</h2>
<p>
	<code>type</code> and <code>form</code> are ignored, like Base UI, so a toggle never submits
	a form.
</p>
<form
	id="toggle-demo-form"
	onsubmit={(event) => {
		event.preventDefault();
		submits++;
	}}
>
	<Toggle
		variant="outline"
		aria-label="Toggle in form"
		type="submit"
		form="toggle-demo-form"
		{isDark}
	>
		Pin
	</Toggle>
</form>
<p data-testid="form-submits">Form submits: {submits}</p>

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
			A consumer <code>onclick</code> or <code>onkeydown</code> runs before the built-in
			handler, like Base UI. To skip the built-in behavior, call
			<code>event.preventDefault()</code>; Base UI's <code>event.preventBaseUIHandler()</code>
			does not exist on DOM events.
		</li>
		<li>
			The Tab stop starts on the first item in DOM order and then follows focus, like Base UI
			1.4.1. Two deliberate changes: when the first item is disabled the stop moves to the next
			enabled item (Base UI leaves the group with no Tab stop), and the remembered stop follows
			the focused item rather than its position when items are added or removed.
		</li>
		<li>
			Like Base UI, <code>type</code> and <code>form</code> are ignored: a toggle always renders
			<code>type="button"</code> and never joins a form.
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
		<li>
			<code>ToggleGroup</code> renders <code>data-orientation</code> but not Base UI's
			<code>aria-orientation</code>, which ARIA does not allow on <code>role="group"</code>.
		</li>
	</ul>
</section>

<p><a href="/">Back to overview</a></p>
