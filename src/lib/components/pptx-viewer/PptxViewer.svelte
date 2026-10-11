<!--
	MIT License — Svelte 5 port of Extend UI pptx-viewer (PptxViewerPreview). Upstream: extend-hq/ui (MIT).
	Deliberate changes vs the React PptxViewerPreview ({ className, defaultThumbnailSidebarOpen,
	defaultZoom, fileName, initialSlide, showDownload, showToolbar, showUpload, src, toolbarActions }):
	- Also exported as the upstream name PptxViewerPreview; `className` is an alias of `class`.
	- Scope is a virtualized slide list with upload, download, and toolbarActions (a Snippet).
	  defaultZoom/zoom modes, the thumbnail sidebar (defaultThumbnailSidebarOpen), and slide
	  navigation (initialSlide, jump to slide) are out of scope. Uploads accept .pptx only:
	  the engine cannot read legacy .ppt.
	- Port additions: height, slideHeight, slideWidth, overscan (fixed-row windowing).
	- Rendering goes through the pptx-browser engine wrapper (#lib/engines/pptx) instead
	  of @extend-ai/react-pptx, which is React-only.
	- Virtualization uses the shared VirtualList instead of @tanstack/react-virtual.
	- Dark mode is parent-controlled (isDark) per project contract; upstream follows the app
	  theme automatically. Like upstream it renders no theme switch, so onIsDarkChange is
	  accepted for contract parity and never called.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { loadDeck, type PptxDeck } from '#lib/engines/pptx/index.js';
	import { DEFAULT_OVERSCAN, VirtualList } from '#lib/virtual-list/index.js';
	import PptxSlide from './PptxSlide.svelte';

	interface Props {
		/** Deck URL to fetch and render. Empty means the empty state. */
		src?: string;
		/** Display name shown in the toolbar. Defaults to the src basename. */
		fileName?: string;
		/** Show the toolbar with the file name, slide count, and actions. */
		showToolbar?: boolean;
		/** Show the download button. */
		showDownload?: boolean;
		/** Show the upload button and file input. */
		showUpload?: boolean;
		/** Extra toolbar content, matching the upstream `toolbarActions` prop. */
		toolbarActions?: Snippet;
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
		/** Accepted for contract parity; the viewer renders no theme switch, so it is never called. */
		onIsDarkChange?: (isDark: boolean) => void;
		class?: string;
		/** Alias of `class`, matching the upstream React prop. */
		className?: string;
	}

	let {
		src,
		fileName,
		showToolbar = true,
		showDownload = true,
		showUpload = true,
		toolbarActions,
		height = 560,
		slideHeight = 360,
		slideWidth = 960,
		overscan = DEFAULT_OVERSCAN,
		isDark = false,
		class: classProp = '',
		className = ''
	}: Props = $props();

	const PPTX_UPLOAD_ACCEPT =
		'.pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation';

	type Status = 'empty' | 'loading' | 'ready' | 'error';

	// Starts loading; the effect below corrects to the empty state when no src is given.
	let status = $state<Status>('loading');
	// Raw state: the loaded deck is large and needs no deep reactivity.
	let deck = $state.raw<PptxDeck | null>(null);
	let error = $state('');
	// Like upstream, an upload applies only while `src` is unchanged; a new src wins.
	let upload = $state.raw<{ file: File; sourceUrl: string | undefined } | null>(null);
	const uploadedFile = $derived(upload && upload.sourceUrl === src ? upload.file : null);
	let fileInputEl = $state<HTMLInputElement | null>(null);
	let preparingDownload = $state(false);

	const slideCount = $derived(deck?.slideCount ?? 0);
	const slideIndexes = $derived(Array.from({ length: slideCount }, (_, index) => index));
	const displayName = $derived(
		uploadedFile?.name ??
			(fileName?.trim() ? fileName : src ? basename(src) : 'presentation.pptx')
	);
	const rootClass = $derived(
		['pptx-viewer', isDark && 'dark', classProp, className].filter(Boolean).join(' ')
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
		const file = uploadedFile;
		if (!url && !file) {
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
				let bytes: ArrayBuffer;
				if (file) {
					bytes = await file.arrayBuffer();
				} else {
					const response = await fetch(url as string);
					if (!response.ok) {
						throw new Error(`Failed to load presentation (${response.status})`);
					}
					bytes = await response.arrayBuffer();
				}
				if (cancelled) return;
				loaded = await loadDeck(new Uint8Array(bytes));
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

	function ensurePresentationExtension(name: string): string {
		const lower = name.toLowerCase();
		return lower.endsWith('.pptx') || lower.endsWith('.ppt') ? name : `${name}.pptx`;
	}

	function handleUpload(event: Event): void {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0] ?? null;
		input.value = '';
		if (file) upload = { file, sourceUrl: src };
	}

	function downloadBlob(blob: Blob, name: string): void {
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = name;
		anchor.rel = 'noopener';
		document.body.append(anchor);
		anchor.click();
		anchor.remove();
		window.setTimeout(() => URL.revokeObjectURL(url), 0);
	}

	// Like upstream: a URL source is fetched and saved as a blob so the name holds cross-origin.
	async function handleDownload(): Promise<void> {
		const name = ensurePresentationExtension(displayName);
		if (uploadedFile) {
			downloadBlob(uploadedFile, name);
			return;
		}
		if (!src || preparingDownload) return;
		preparingDownload = true;
		try {
			const response = await fetch(src);
			if (!response.ok) throw new Error(`Failed to download presentation (${response.status})`);
			downloadBlob(await response.blob(), name);
		} catch (failure) {
			console.error(failure);
		} finally {
			preparingDownload = false;
		}
	}
</script>

<div class={rootClass} data-dark={String(isDark)} data-testid="pptx-viewer">
	<!-- Always mounted, like upstream: the empty-state button uses it even when showUpload is off. -->
	<input
		type="file"
		data-testid="pptx-file-input"
		accept={PPTX_UPLOAD_ACCEPT}
		hidden
		bind:this={fileInputEl}
		onchange={handleUpload}
	/>
	{#if showToolbar}
		<div class="pptx-toolbar" data-testid="pptx-toolbar">
			<span class="pptx-name" data-testid="presentation-name">{displayName}</span>
			{#if status === 'ready'}
				<span class="pptx-count">Slides: <span data-testid="slide-count">{slideCount}</span></span>
			{/if}
			{#if toolbarActions}
				{@render toolbarActions()}
			{/if}
			{#if showUpload}
				<button type="button" class="pptx-button" onclick={() => fileInputEl?.click()}>
					Upload
				</button>
			{/if}
			{#if showDownload}
				<button
					type="button"
					class="pptx-button"
					disabled={(!src && !uploadedFile) || preparingDownload}
					onclick={handleDownload}
				>
					Download
				</button>
			{/if}
		</div>
	{/if}

	{#if status === 'empty'}
		<div class="pptx-state">
			<p class="pptx-state-title">Upload a PowerPoint presentation to preview</p>
			<p class="pptx-state-hint">
				Pass a PPTX URL with the <code>src</code> prop or upload a PPTX file.
			</p>
			<button type="button" class="pptx-button" onclick={() => fileInputEl?.click()}>
				Upload PowerPoint
			</button>
		</div>
	{:else if status === 'loading'}
		<div class="pptx-state" role="status">Loading presentation…</div>
	{:else if status === 'error'}
		<div class="pptx-state" role="alert">
			<p class="pptx-state-title pptx-error">Unable to display PowerPoint</p>
			<p class="pptx-state-hint">{error}</p>
		</div>
	{:else if slideCount === 0}
		<div class="pptx-state">
			<p class="pptx-state-hint">This presentation has no slides.</p>
		</div>
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

	.pptx-button {
		flex: none;
		padding: 0.375rem 0.625rem;
		border: 1px solid var(--pptx-border);
		border-radius: 0.375rem;
		background: transparent;
		color: var(--pptx-fg);
		font: inherit;
		cursor: pointer;
	}

	.pptx-button:disabled {
		opacity: 0.45;
		cursor: default;
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
