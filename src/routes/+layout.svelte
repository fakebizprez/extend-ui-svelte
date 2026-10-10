<!-- Docs site shell: sidebar nav plus preview content. -->
<script lang="ts">
	import '../app.css';
	import type { Snippet } from 'svelte';
	import { PREVIEW_COMPONENTS } from './components';

	let { children }: { children: Snippet } = $props();
</script>

<div class="docs-shell">
	<nav aria-label="Components">
		<p><a href="/">Extend UI Svelte</a></p>
		<ul>
			{#each PREVIEW_COMPONENTS as component (component.slug)}
				<li><a href="/{component.slug}">{component.slug}</a></li>
			{/each}
		</ul>
	</nav>
	<main>
		{@render children()}
	</main>
</div>

<style>
	.docs-shell {
		display: flex;
		gap: 2rem;
		padding: 1.5rem;
		font-family: system-ui, sans-serif;
	}

	ul {
		list-style: none;
		padding: 0;
		display: grid;
		gap: 0.25rem;
	}

	main {
		flex: 1;
		/* Let wide previews shrink instead of pushing the page sideways. */
		min-width: 0;
	}

	/* Long prop and file names in the docs text wrap instead of widening the page. */
	main :global(code) {
		overflow-wrap: anywhere;
	}

	/* Phones: menu above the preview, links wrapped, 16px gutter. */
	@media (max-width: 640px) {
		.docs-shell {
			flex-direction: column;
			gap: 1rem;
			padding: 1rem;
		}

		ul {
			display: flex;
			flex-wrap: wrap;
			gap: 0.25rem 0.75rem;
		}
	}
</style>
