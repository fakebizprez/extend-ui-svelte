<!--
	MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
	Ported from apps/v4/components/extend/document-viewer-sidebar.tsx
	(DocumentViewerThumbnailSidebar): a 10rem thumbnail rail that sits inline
	beside wide viewers and slides over narrow ones. Upstream Tailwind classes
	are ported to scoped CSS.
	Deliberate API changes vs React:
	- `class` is accepted alongside `className`; both are merged onto the root.
	- `children` is a Svelte snippet instead of ReactNode.
	- No `widthClassName` / `closedInlineClassName` (Tailwind class props; every
	  upstream caller passes the defaults `w-40` / `-ml-40`).
	- Accepts the shared dark-mode contract (`isDark`, `onIsDarkChange`); the
	  parent controls the theme, so `onIsDarkChange` is never invoked here.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { DarkModeProps } from '../../dark-mode.js';

	interface Props extends DarkModeProps {
		children: Snippet;
		className?: string;
		class?: string;
		inline: boolean;
		open: boolean;
	}

	let {
		children,
		className,
		class: classProp,
		inline,
		open,
		isDark = false,
		// Shared-contract parity; intentionally unused, the parent owns the theme.
		onIsDarkChange: _onIsDarkChange
	}: Props = $props();

	// Skip the slide-in on first paint: transitions turn on two frames after mount.
	let transitionsReady = $state(false);

	$effect(() => {
		let secondFrameId = 0;
		const firstFrameId = requestAnimationFrame(() => {
			secondFrameId = requestAnimationFrame(() => {
				transitionsReady = true;
			});
		});

		return () => {
			cancelAnimationFrame(firstFrameId);
			cancelAnimationFrame(secondFrameId);
		};
	});
</script>

<aside
	data-document-thumbnail-sidebar=""
	data-sidebar-mode={inline ? 'inline' : 'overlay'}
	data-sidebar-open={open ? 'true' : 'false'}
	class={['sidebar', className, classProp]}
	class:animate={transitionsReady && open}
	class:inline
	class:open
	class:dark={isDark}
>
	{@render children()}
</aside>

<style>
	.sidebar {
		--sidebar: oklch(0.985 0 0);
		--border: rgb(0 0 0 / 8%);
		position: absolute;
		inset-block: 0;
		left: 0;
		z-index: 30;
		box-sizing: border-box;
		width: 10rem;
		flex-shrink: 0;
		overflow: hidden;
		border-right: 1px solid var(--border);
		background: var(--sidebar);
		box-shadow:
			0 10px 15px -3px rgb(0 0 0 / 0.1),
			0 4px 6px -4px rgb(0 0 0 / 0.1);
		transition: none;
	}

	.sidebar.dark {
		--sidebar: color-mix(in srgb, oklch(0.145 0 0) 97%, white);
		--border: rgb(255 255 255 / 6%);
	}

	.animate {
		transition-property: translate, margin-left, border-color;
		transition-duration: 200ms;
		transition-timing-function: ease-out;
	}

	.inline {
		position: relative;
		z-index: auto;
		translate: 0;
		box-shadow: none;
	}

	.open {
		margin-left: 0;
		translate: 0;
	}

	.sidebar:not(.open) {
		border-right-width: 0;
	}

	.inline:not(.open) {
		pointer-events: auto;
		margin-left: -10rem;
	}

	.sidebar:not(.inline):not(.open) {
		pointer-events: none;
		translate: -100% 0;
	}
</style>
