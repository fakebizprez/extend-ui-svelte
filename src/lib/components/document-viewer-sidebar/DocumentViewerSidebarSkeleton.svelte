<!--
	MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
	Ported from apps/v4/components/extend/document-viewer-sidebar.tsx
	(DocumentViewerSidebarSkeleton): the loading placeholder for an inline
	thumbnail sidebar. Renders nothing for overlay sidebars, like upstream.
	Deliberate API changes vs React:
	- `class` is accepted alongside `className`; both are merged onto the root.
	- Accepts the shared dark-mode contract (`isDark`, `onIsDarkChange`); the
	  parent controls the theme, so `onIsDarkChange` is never invoked here.
-->
<script lang="ts">
	import type { DarkModeProps } from '../../dark-mode.js';

	interface Props extends DarkModeProps {
		className?: string;
		class?: string;
		inline: boolean;
	}

	let {
		className,
		class: classProp,
		inline,
		isDark = false,
		// Shared-contract parity; intentionally unused, the parent owns the theme.
		onIsDarkChange: _onIsDarkChange
	}: Props = $props();
</script>

{#if inline}
	<div
		data-document-sidebar-skeleton=""
		class={['skeleton', className, classProp]}
		class:dark={isDark}
	>
		<div class="thumbnail">
			<div class="pulse"></div>
		</div>
		<div class="label"></div>
	</div>
{/if}

<style>
	.skeleton {
		--sidebar: oklch(0.985 0 0);
		--background: oklch(1 0 0);
		--muted: rgb(0 0 0 / 4%);
		--border: rgb(0 0 0 / 8%);
		width: 10rem;
		flex-shrink: 0;
		box-sizing: border-box;
		border-right: 1px solid var(--border);
		background: var(--sidebar);
		padding: 1rem;
	}

	.skeleton.dark {
		--sidebar: color-mix(in srgb, oklch(0.145 0 0) 97%, white);
		--background: oklch(0.145 0 0);
		--muted: rgb(255 255 255 / 4%);
		--border: rgb(255 255 255 / 6%);
	}

	.thumbnail {
		margin-inline: auto;
		height: 7rem;
		width: 5rem;
		overflow: hidden;
		border-radius: 0.375rem;
		background: var(--background);
		box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
	}

	.pulse {
		height: 100%;
		background: var(--muted);
		animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
	}

	.label {
		margin: 0.75rem auto 0;
		height: 0.75rem;
		width: 2.5rem;
		border-radius: 9999px;
		background: var(--muted);
	}

	@keyframes pulse {
		50% {
			opacity: 0.5;
		}
	}
</style>
