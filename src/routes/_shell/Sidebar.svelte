<!-- MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT). -->
<script lang="ts">
	import type { NavGroup } from './nav';

	let {
		groups,
		currentSlug,
		onNavigate
	}: { groups: NavGroup[]; currentSlug: string | null; onNavigate?: () => void } = $props();
</script>

<nav aria-label="Components">
	{#each groups as group (group.id)}
		<section>
			<h2>{group.title}</h2>
			<ul>
				{#each group.items as item (item.slug)}
					<li>
						<a
							href="/{item.slug}"
							aria-current={item.slug === currentSlug ? 'page' : undefined}
							onclick={() => onNavigate?.()}>{item.title}</a
						>
					</li>
				{/each}
			</ul>
		</section>
	{/each}
</nav>

<style>
	nav {
		padding: 1rem;
		overflow-y: auto;
	}
	h2 {
		margin: 1rem 0 0.375rem;
		font-family: var(--lh-mono);
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--lh-muted);
	}
	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	a {
		display: block;
		padding: 0.375rem 0.5rem;
		border-radius: 0;
		font-family: var(--lh-mono);
		font-size: 0.75rem;
		color: var(--lh-text);
		text-decoration: none;
		overflow-wrap: anywhere;
	}
	a:hover,
	a[aria-current='page'] {
		background: var(--lh-hover);
	}
	a[aria-current='page'] {
		background: var(--lh-surface);
		color: var(--lh-blue);
		font-weight: 700;
		outline: 1px solid var(--lh-border);
	}
	a:focus-visible {
		outline: 2px solid var(--lh-blue);
		outline-offset: 2px;
	}
</style>
