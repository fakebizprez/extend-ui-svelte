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
		border: 1px solid var(--border, #e5e5e5);
		border-radius: 0.5rem;
		color: var(--foreground, #0a0a0a);
		text-decoration: none;
		overflow-wrap: anywhere;
	}
	a:hover {
		background: var(--accent, #f5f5f5);
	}
	a:focus-visible {
		outline: 2px solid var(--foreground, #0a0a0a);
		outline-offset: 2px;
	}
	small {
		color: var(--muted-foreground, #737373);
	}
	.next {
		margin-left: auto;
		text-align: right;
	}
</style>
