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
	<dialog
		class="panel"
		aria-label="Component navigation"
		closedby="any"
		oncancel={() => (open = false)}
		onclose={() => (open = false)}
		{@attach (dialog) => {
			dialog.showModal();
			return () => dialog.close();
		}}
	>
		<button class="close" type="button" onclick={() => (open = false)}>Close menu</button>
		<Sidebar {groups} {currentSlug} onNavigate={() => (open = false)} />
	</dialog>
{/if}

<style>
	.panel::backdrop {
		background: color-mix(in srgb, var(--lh-dark) 60%, transparent);
	}
	.panel {
		position: fixed;
		inset: 0 auto 0 0;
		z-index: 50;
		width: min(20rem, 85vw);
		max-width: none;
		height: 100dvh;
		max-height: none;
		margin: 0;
		padding: 0;
		box-sizing: border-box;
		overflow-y: auto;
		border: 0;
		border-right: 1px solid var(--lh-border);
		background: var(--lh-bg);
		color: var(--lh-text);
	}
	.close {
		min-height: 44px;
		margin: 1rem 1rem 0;
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--lh-border);
		background: var(--lh-surface);
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	.close:focus-visible {
		outline: 2px solid var(--lh-blue);
		outline-offset: 2px;
	}
</style>
