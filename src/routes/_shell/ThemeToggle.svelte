<!-- MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT). -->
<script lang="ts">
	import { onMount } from 'svelte';

	let theme = $state<'light' | 'dark'>('light');

	function apply(next: 'light' | 'dark') {
		theme = next;
		document.documentElement.dataset.theme = next;
		document.documentElement.classList.toggle('dark', next === 'dark');
		try {
			localStorage.setItem('docs-theme', next);
		} catch {
			// storage unavailable; theme still applies for this visit
		}
	}

	onMount(() => {
		let stored: string | null = null;
		try {
			stored = localStorage.getItem('docs-theme');
		} catch {
			// ignore
		}
		apply(
			stored === 'dark' || stored === 'light'
				? stored
				: window.matchMedia?.('(prefers-color-scheme: dark)').matches
					? 'dark'
					: 'light'
		);
	});
</script>

<button type="button" aria-label="Toggle theme" onclick={() => apply(theme === 'dark' ? 'light' : 'dark')}>
	<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
		{#if theme === 'dark'}
			<circle cx="12" cy="12" r="4" />
			<path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
		{:else}
			<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
		{/if}
	</svg>
</button>

<style>
	button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.5rem;
		height: 2.5rem;
		border: 1px solid var(--lh-border);
		border-radius: 0;
		background: transparent;
		color: var(--lh-text);
		cursor: pointer;
	}
	button:hover {
		background: var(--lh-hover);
	}
	button:focus-visible {
		outline: 2px solid var(--lh-blue);
		outline-offset: 2px;
	}
</style>
