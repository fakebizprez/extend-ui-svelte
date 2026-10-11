<!-- MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT). -->
<script lang="ts">
	import type { PreviewComponent } from '../components';

	let { prev, next }: { prev: PreviewComponent | null; next: PreviewComponent | null } = $props();
</script>

{#if prev || next}
	<nav aria-label="Pagination">
		{#if prev}
			<a class="prev" href="/{prev.slug}" aria-label="Previous: {prev.title}">
				<small>Previous</small>{prev.title}
			</a>
		{/if}
		{#if next}
			<a class="next" href="/{next.slug}" aria-label="Next: {next.title}">
				<small>Next</small>{next.title}
			</a>
		{/if}
	</nav>
{/if}

<style>
	nav {
		display: flex;
		gap: 1rem;
		margin-top: 3rem;
	}
	a {
		display: flex;
		flex-direction: column;
		flex: 1;
		padding: 0.75rem 1rem;
		border: 1px solid var(--lh-border);
		border-radius: 0;
		background: var(--lh-surface);
		font-family: var(--lh-mono);
		font-size: 0.75rem;
		color: var(--lh-text);
		text-decoration: none;
		overflow-wrap: anywhere;
	}
	a:hover {
		background: var(--lh-hover);
		border-color: var(--lh-blue);
	}
	a:focus-visible {
		outline: 2px solid var(--lh-blue);
		outline-offset: 2px;
	}
	small {
		color: var(--lh-muted);
	}
	.next {
		margin-left: auto;
		text-align: right;
	}
</style>
