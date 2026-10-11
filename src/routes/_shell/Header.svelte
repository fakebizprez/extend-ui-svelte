<!-- MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT). -->
<script lang="ts">
	import ThemeToggle from './ThemeToggle.svelte';

	let { menuOpen = $bindable(false) }: { menuOpen?: boolean } = $props();
</script>

<header>
	<button
		type="button"
		class="menu"
		aria-label="Menu"
		aria-expanded={menuOpen}
		onclick={() => (menuOpen = !menuOpen)}
	>
		<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
			<path d="M4 6h16M4 12h16M4 18h16" />
		</svg>
	</button>
	<a class="brand" href="/">Extend UI Svelte</a>
	<div class="actions">
		<a
			class="gh"
			href="https://github.com/extend-hq/ui"
			target="_blank"
			rel="noopener noreferrer"
			aria-label="GitHub">GitHub</a
		>
		<ThemeToggle />
	</div>
</header>

<style>
	header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.5rem 1rem;
		border-bottom: 1px solid var(--lh-border);
		background: var(--lh-bg);
		color: var(--lh-text);
	}
	.brand {
		font-family: var(--lh-display);
		font-weight: 700;
		letter-spacing: -0.02em;
		text-transform: uppercase;
		color: inherit;
		text-decoration: none;
	}
	.actions {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-left: auto;
	}
	.gh {
		color: var(--lh-muted);
		text-decoration: none;
		font-family: var(--lh-mono);
		font-size: 0.6875rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.gh:hover {
		color: var(--lh-text);
	}
	.menu {
		display: none;
		align-items: center;
		justify-content: center;
		min-width: 44px;
		min-height: 44px;
		border: 1px solid var(--lh-border);
		border-radius: 0;
		background: transparent;
		color: inherit;
		cursor: pointer;
	}
	@media (max-width: 768px) {
		.menu {
			display: inline-flex;
		}
	}
	a:focus-visible,
	.menu:focus-visible {
		outline: 2px solid var(--lh-blue);
		outline-offset: 2px;
	}
</style>
