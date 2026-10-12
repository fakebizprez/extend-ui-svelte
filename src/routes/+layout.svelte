<!-- Docs site shell: header, grouped sidebar, preview content, on-this-page list. -->
<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import type { Snippet } from 'svelte';
	import Header from './_shell/Header.svelte';
	import MobileMenu from './_shell/MobileMenu.svelte';
	import PageNav from './_shell/PageNav.svelte';
	import Sidebar from './_shell/Sidebar.svelte';
	import Toc from './_shell/Toc.svelte';
	import { NAV_GROUPS, findComponent, groupOf, prevNext } from './_shell/nav';
	import { SITE_TAGLINE } from './components';

	let { children }: { children: Snippet } = $props();

	let menuOpen = $state(false);
	let main = $state<HTMLElement | null>(null);

	const slug = $derived(page.url.pathname.split('/')[1] || null);
	const current = $derived(slug ? findComponent(slug) : null);
	const group = $derived(slug ? groupOf(slug) : null);
	const neighbors = $derived(slug ? prevNext(slug) : { prev: null, next: null });

	const title = $derived(current ? `${current.title} | Extend UI Svelte` : 'Extend UI Svelte');
	const description = $derived(current?.description ?? SITE_TAGLINE);
	const canonical = $derived(page.url.href);

	// Close the phone menu whenever the route changes.
	$effect(() => {
		void page.url.pathname;
		menuOpen = false;
	});
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
	<link rel="canonical" href={canonical} />
	<meta property="og:site_name" content="Extend UI Svelte" />
	<meta property="og:type" content="website" />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:url" content={canonical} />
	<meta name="twitter:card" content="summary" />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={description} />
</svelte:head>

<Header bind:menuOpen />
<MobileMenu bind:open={menuOpen} groups={NAV_GROUPS} currentSlug={slug} />

<div class="docs-shell">
	<aside class="side">
		<Sidebar groups={NAV_GROUPS} currentSlug={slug} />
	</aside>
	<main id="main-content" tabindex="-1" bind:this={main}>
		{#if current && group}
			<p class="crumbs">Docs / {group.title} / {current.title}</p>
		{/if}
		{@render children()}
		<PageNav prev={neighbors.prev} next={neighbors.next} />
	</main>
	<aside class="toc">
		<Toc container={main} refreshKey={page.url.pathname} />
	</aside>
</div>

<footer class="site-footer">
	Built for Svelte by <a href="https://github.com/fakebizprez">Anthony Fecarotta</a> of
	<a href="https://linehaul.ai">linehaul.ai</a>
</footer>

<style>
	:global(body) {
		margin: 0;
		background: var(--lh-bg);
		color: var(--lh-text);
		font-family: var(--lh-mono);
	}

	.docs-shell {
		display: grid;
		grid-template-columns: var(--docs-sidebar-width) minmax(0, 1fr) 14rem;
		gap: 2rem;
		max-width: 90rem;
		margin: 0 auto;
		padding: 1.5rem;
	}

	.site-footer {
		max-width: 90rem;
		margin: 0 auto;
		padding: 0 1.5rem 1rem;
		color: var(--lh-muted);
		font-size: 0.625rem;
		text-align: right;
	}

	.site-footer a {
		color: inherit;
	}

	.side,
	.toc {
		position: sticky;
		top: calc(var(--docs-header-height) + 1rem);
		align-self: start;
		max-height: calc(100vh - var(--docs-header-height) - 2rem);
		overflow-y: auto;
	}
	.side {
		border-right: 1px solid var(--lh-border);
	}
	.toc {
		border-left: 1px solid var(--lh-border);
		padding-left: 1rem;
	}

	main {
		min-width: 0;
	}

	.crumbs {
		margin: 0 0 1rem;
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--lh-muted);
	}

	/*
	 * Preview pages are plain headings and text straight under <main>. Only direct
	 * children are styled, so the components inside the previews keep their own look.
	 */
	main > :global(h1) {
		font-family: var(--lh-display);
		font-size: clamp(2rem, 4.5vw, 3.5rem);
		font-weight: 700;
		line-height: 0.94;
		letter-spacing: -0.025em;
		text-transform: uppercase;
	}
	main > :global(h2),
	main > :global(section > h2) {
		font-family: var(--lh-display);
		font-weight: 700;
		letter-spacing: -0.02em;
	}
	main > :global(p) {
		font-size: 0.8125rem;
		line-height: 1.8;
	}

	/* Long prop and file names in the docs text wrap instead of widening the page. */
	main :global(code) {
		overflow-wrap: anywhere;
	}

	/* No room for the on-this-page list below laptop width. */
	@media (max-width: 1100px) {
		.docs-shell {
			grid-template-columns: var(--docs-sidebar-width) minmax(0, 1fr);
		}
		.toc {
			display: none;
		}
	}

	/* Phones and tablets: the menu button replaces the sidebar, 16px gutter. */
	@media (max-width: 768px) {
		.docs-shell {
			grid-template-columns: minmax(0, 1fr);
			padding: 1rem;
		}
		.site-footer {
			padding: 0 1rem 1rem;
		}
		.side {
			display: none;
		}
	}
</style>
