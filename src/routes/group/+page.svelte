<!-- MIT License — Svelte 5 port of Extend UI group. Upstream: extend-hq/ui (MIT). -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { Group, GroupSeparator, GroupText } from '#lib/components/group/index.js';

	let isDark = $state(false);
	// Set once hydrated so tests know the controls are live.
	let ready = $state(false);
	onMount(() => (ready = true));
	let lastAction = $state('none');

	// Demo buttons use upstream Button's outline variant at the default size, so
	// the group's joining (square inner corners, shared edges) is visible.
	const buttonClass =
		'relative inline-flex h-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-input bg-popover px-[calc(--spacing(3)-1px)] text-base font-medium whitespace-nowrap text-foreground shadow-xs/5 outline-none hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring sm:h-8 sm:text-sm dark:bg-input/32 dark:hover:bg-input/64';
</script>

<h1>Group</h1>
<p>
	Joins related controls into one unit: adjacent items share edges, and separators or static
	text can sit between them. Dark mode is controlled by the parent through <code>isDark</code>;
	the toggle below lives outside the component.
</p>
<p data-ready={ready || undefined}>
	<label>
		<input type="checkbox" bind:checked={isDark} />
		Dark mode
	</label>
</p>

<h2>Horizontal with separators</h2>
<Group aria-label="Clipboard actions" {isDark}>
	{#each ['Copy', 'Paste', 'Cut'] as action, index (action)}
		{#if index > 0}
			<GroupSeparator {isDark} />
		{/if}
		<button type="button" data-slot="button" class={buttonClass} onclick={() => (lastAction = action)}>
			{action}
		</button>
	{/each}
</Group>
<p data-testid="group-last-action">Last action: {lastAction}</p>

<h2>Vertical</h2>
<Group aria-label="Vertical actions" orientation="vertical" {isDark}>
	<button type="button" data-slot="button" class={buttonClass}>Move up</button>
	<GroupSeparator orientation="horizontal" {isDark} />
	<button type="button" data-slot="button" class={buttonClass}>Move down</button>
</Group>

<h2>With text</h2>
<Group aria-label="Amount" {isDark}>
	<GroupText {isDark}>$</GroupText>
	<input
		data-slot="input-control"
		aria-label="Amount value"
		value="250.00"
		class="h-9 w-32 min-w-0 border border-input bg-background px-[calc(--spacing(3)-1px)] text-base text-foreground outline-none sm:h-8 sm:text-sm dark:bg-input/32"
	/>
	<GroupText {isDark}>USD</GroupText>
</Group>

<h2>Nested groups</h2>
<Group aria-label="Toolbar" {isDark}>
	<Group aria-label="History" {isDark}>
		<button type="button" data-slot="button" class={buttonClass}>Undo</button>
		<button type="button" data-slot="button" class={buttonClass}>Redo</button>
	</Group>
	<Group aria-label="Zoom" {isDark}>
		<button type="button" data-slot="button" class={buttonClass}>Zoom out</button>
		<button type="button" data-slot="button" class={buttonClass}>Zoom in</button>
	</Group>
</Group>

<section aria-labelledby="differences-from-upstream">
	<h2 id="differences-from-upstream">Differences from upstream</h2>
	<ul>
		<li>
			Exported as <code>Group</code>, <code>GroupText</code>, <code>GroupSeparator</code> and the
			upstream aliases <code>ButtonGroup</code>, <code>ButtonGroupText</code>,
			<code>ButtonGroupSeparator</code>. <code>className</code> and <code>class</code> are both
			accepted.
		</li>
		<li><code>children</code> is a Svelte snippet instead of a React node.</li>
		<li>
			<code>GroupText</code> has no <code>render</code> prop (Base UI <code>useRender</code> is
			React-only); it always renders a <code>div</code>.
		</li>
		<li>
			<code>GroupSeparator</code> renders its own separator element instead of wrapping the
			shadcn <code>Separator</code>.
		</li>
		<li>
			The dark-mode hover and pressed separator tints and the focus-ring separator shifts from
			upstream's class list are not ported; edge joining and orientation are.
		</li>
		<li>
			Accepts <code>isDark</code> and <code>onIsDarkChange</code>; it reflects <code>isDark</code>
			and never calls <code>onIsDarkChange</code>.
		</li>
	</ul>
</section>

<p><a href="/">Back to all components</a></p>
