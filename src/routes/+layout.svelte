<!-- Docs site shell: sidebar nav plus preview content. -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { PREVIEW_COMPONENTS } from './components';

	let { children }: { children: Snippet } = $props();
</script>

<div style="display: flex; gap: 2rem; padding: 1.5rem; font-family: system-ui, sans-serif;">
	<nav aria-label="Components">
		<p><a href="/">Extend UI Svelte</a></p>
		<ul style="list-style: none; padding: 0; display: grid; gap: 0.25rem;">
			{#each PREVIEW_COMPONENTS as component (component.slug)}
				<li><a href="/{component.slug}">{component.slug}</a></li>
			{/each}
		</ul>
	</nav>
	<main style="flex: 1;">
		{@render children()}
	</main>
</div>
