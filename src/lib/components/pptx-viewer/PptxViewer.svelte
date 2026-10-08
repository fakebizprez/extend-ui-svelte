<!--
	MIT License — Svelte 5 port of Extend UI pptx-viewer (PptxViewerPreview). Upstream: extend-hq/ui (MIT).
	Deliberate changes vs the React PptxViewerPreview ({ className, defaultThumbnailSidebarOpen,
	defaultZoom, fileName, initialSlide, showDownload, showToolbar, showUpload, src, toolbarActions }):
	- Scope is the phase-6 port: a virtualized slide list. Zoom modes, the thumbnail
	  sidebar, slide navigation, upload/download, and custom toolbar actions are out of scope.
	- Rendering goes through the pptx-browser engine wrapper (#lib/engines/pptx) instead
	  of @extend-ai/react-pptx, which is React-only.
	- Virtualization uses the shared VirtualList instead of @tanstack/react-virtual.
	- Dark mode is parent-controlled (isDark + onIsDarkChange) per project contract;
	  upstream follows the app theme automatically.
-->
<script lang="ts">
	import { loadDeck, type PptxDeck } from '#lib/engines/pptx/index.js';
	import { DEFAULT_OVERSCAN, VirtualList } from '#lib/virtual-list/index.js';
	import PptxSlide from './PptxSlide.svelte';

	interface Props {
		/** Deck URL to fetch and render. Empty means the empty state. */
		src?: string;
		/** Display name shown in the toolbar. Defaults to the src basename. */
		fileName?: string;
		/** Show the toolbar with the file name, slide count, and theme toggle. */
		showToolbar?: boolean;
		/** Viewport height in px. */
		height?: number;
		/** Fixed row height of one slide in px; required for windowing math. */
		slideHeight?: number;
		/** Slide render width in px passed to the engine. */
		slideWidth?: number;
		/** Extra rows rendered above/below the visible window. */
		overscan?: number;
		/** Parent-controlled dark mode flag. */
		isDark?: boolean;
		/** Called when the user toggles dark mode. */
		onIsDarkChange?: (isDark: boolean) => void;
		class?: string;
	}

	let {
		src,
		fileName,
		showToolbar = true,
		height = 560,
		slideHeight = 360,
		slideWidth = 960,
		overscan = DEFAULT_OVERSCAN,
		isDark = false,
		onIsDarkChange,
		class: className = ''
	}: Props = $props();

	type Status = 'empty' | 'loading' | 'ready' | 'error';

	// Starts loading; the effect below corrects to the empty state when no src is given.
	let status = $state<Status>('loading');
	// Raw state: the loaded deck is large and needs no deep reactivity.
	let deck = $state.raw<PptxDeck | null>(null);
	let error = $state('');

	const slideCount = $derived(deck?.slideCount ?? 0);
	const slideIndexes = $derived(Array.from({ length: slideCount }, (_, index) => index));
	const displayName = $derived(
		fileName?.trim() ? fileName : src ? basename(src) : 'presentation.pptx'
	);

	function basename(url: string): string {
		const raw = (url.split('?')[0] ?? '').split('/').pop() ?? '';
		if (!raw) return 'presentation.pptx';
		try {
			return decodeURIComponent(raw);
		} catch {
			return raw;
		}
	}

	// Client-only loading: $effect never runs on the server, and loadDeck
	// dynamic-imports the browser engine, so SSR renders the loading state.
	$effect(() => {
		const url = src;
		if (!url) {
			status = 'empty';
			error = '';
			deck = null;
			return;
		}
		let cancelled = false;
		let loaded: PptxDeck | null = null;
		status = 'loading';
		error = '';
		deck = null;
		(async () => {
			try {
				const response = await fetch(url);
				if (!response.ok) {
					throw new Error(`Failed to load presentation (${response.status})`);
				}
				loaded = await loadDeck(new Uint8Array(await response.arrayBuffer()));
				if (cancelled) {
					loaded.destroy();
					return;
				}
				deck = loaded;
				status = 'ready';
			} catch (failure: unknown) {
				if (cancelled) return;
				error = failure instanceof Error ? failure.message : 'Could not load presentation.';
				status = 'error';
			}
		})();
		return () => {
			cancelled = true;
			loaded?.destroy();
		};
	});
</script>

<div
	class={`pptx-viewer${isDark ? ' dark' : ''}${className ? ` ${className}` : ''}`}
	data-dark={String(isDark)}
	data-testid="pptx-viewer"
>
	{#if showToolbar}
		<div class="pptx-toolbar" data-testid="pptx-toolbar">
			<span class="pptx-name" data-testid="presentation-name">{displayName}</span>
			{#if status === 'ready'}
				<span class="pptx-count">Slides: <span data-testid="slide-count">{slideCount}</span></span>
			{/if}
			<button
				type="button"
				class="pptx-theme-toggle"
				role="switch"
				aria-checked={isDark}
				aria-label="Toggle dark mode"
				onclick={() => onIsDarkChange?.(!isDark)}
			>
				{isDark ? 'Light' : 'Dark'}
			</button>
		</div>
	{/if}

	{#if status === 'empty'}
		<div class="pptx-state">
			<p class="pptx-state-title">No presentation to preview</p>
			<p class="pptx-state-hint">Pass a deck URL with the src prop.</p>
		</div>
	{:else if status === 'loading'}
		<div class="pptx-state" role="status">Loading presentation…</div>
	{:else if status === 'error'}
		<div class="pptx-state pptx-error" role="alert">{error}</div>
	{:else if deck !== null}
		{@const readyDeck = deck}
		<VirtualList items={slideIndexes} itemHeight={slideHeight} {height} {overscan}>
			{#snippet children(slideIndex)}
				<PptxSlide deck={readyDeck} index={slideIndex} {slideCount} width={slideWidth} />
			{/snippet}
		</VirtualList>
	{/if}
</div>

<style>
	.pptx-viewer {
		--pptx-bg: #ffffff;
		--pptx-fg: #171717;
		--pptx-muted: #525252;
		--pptx-border: #e5e5e5;
		display: flex;
		flex-direction: column;
		width: 100%;
		overflow: hidden;
		background: var(--pptx-bg);
		color: var(--pptx-fg);
		border: 1px solid var(--pptx-border);
		border-radius: 0.75rem;
		font-family:
			system-ui,
			-apple-system,
			'Segoe UI',
			sans-serif;
		font-size: 13px;
	}

	.pptx-viewer.dark {
		--pptx-bg: #0a0a0a;
		--pptx-fg: #e5e5e5;
		--pptx-muted: #a3a3a3;
		--pptx-border: #262626;
	}

	.pptx-toolbar {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		border-bottom: 1px solid var(--pptx-border);
	}

	.pptx-name {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-weight: 600;
	}

	.pptx-count {
		margin-left: auto;
		white-space: nowrap;
		color: var(--pptx-muted);
		font-size: 12px;
	}

	.pptx-theme-toggle {
		flex: none;
		padding: 0.375rem 0.625rem;
		border: 1px solid var(--pptx-border);
		border-radius: 0.375rem;
		background: transparent;
		color: var(--pptx-fg);
		font: inherit;
		cursor: pointer;
	}

	.pptx-state {
		display: grid;
		place-items: center;
		align-content: center;
		gap: 0.25rem;
		min-height: 200px;
		padding: 1rem;
		text-align: center;
	}

	.pptx-state-title {
		margin: 0;
		font-weight: 600;
	}

	.pptx-state-hint {
		margin: 0;
		color: var(--pptx-muted);
	}

	.pptx-error {
		color: #b91c1c;
	}

	.dark .pptx-error {
		color: #f87171;
	}
</style>
