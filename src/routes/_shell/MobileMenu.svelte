<!-- MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT). -->
<script lang="ts">
	import Sidebar from './Sidebar.svelte';
	import type { NavGroup } from './nav';

	let {
		open = $bindable(false),
		groups,
		currentSlug
	}: { open?: boolean; groups: NavGroup[]; currentSlug: string | null } = $props();
</script>

<svelte:window onkeydown={(e) => open && e.key === 'Escape' && (open = false)} />

{#if open}
	<div class="backdrop" role="presentation" onclick={() => (open = false)}></div>
	<div class="panel">
		<Sidebar {groups} {currentSlug} onNavigate={() => (open = false)} />
	</div>
{/if}

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 40;
		background: color-mix(in srgb, var(--lh-dark) 60%, transparent);
	}
	.panel {
		position: fixed;
		inset: 0 auto 0 0;
		z-index: 50;
		width: min(20rem, 85vw);
		overflow-y: auto;
		border-right: 1px solid var(--lh-border);
		background: var(--lh-bg);
		color: var(--lh-text);
	}
</style>
