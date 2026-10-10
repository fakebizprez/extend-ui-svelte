<!--
	MIT License — Svelte 5 port of Extend UI pdf-viewer. Upstream: extend-hq/ui (MIT).
	Deliberate changes vs the React PDFViewer:
	- Rendering runs on the shared PDF.js engine wrapper (#lib/engines/pdf)
	  instead of the @embedpdf plugin stack.
	- Dark mode is parent-controlled (isDark + onIsDarkChange) per project contract.
	- renderPageOverlay is a `pageOverlay` snippet; toolbarActions is a snippet.
	- `class` replaces React's `className`, matching the other Svelte ports.
	- Virtualization reuses the shared windowing math (#lib/virtual-list) in a
	  local scroll container, because page navigation needs scroll control the
	  shared VirtualList component does not expose.
	- Out of scope: thumbnail sidebar, text search, text selection, tiling,
	  page pointer callbacks, and byte-level rotated download (rotation applies
	  to rendering; download fetches the original bytes).
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import type { Snippet } from 'svelte';
	import {
		computeWindow,
		DEFAULT_OVERSCAN,
		offsetTopForIndex,
		totalHeight
	} from '#lib/virtual-list/window.js';
	import type { PdfEngine } from '#lib/engines/pdf/index.js';
	import PdfPage from './PdfPage.svelte';
	import type { PdfViewerPageOverlayProps } from './types.js';
	import {
		computeActivePage,
		DEFAULT_ZOOM,
		formatZoomPercent,
		getPdfDownloadFileName,
		resolveInitialZoom,
		rotateClockwise,
		rotateCounterClockwise,
		zoomStepIn,
		zoomStepOut,
		type PdfViewerZoomLevel
	} from './zoom.js';

	export interface PdfViewerProps {
		/** PDF URL to load. Empty renders the upload prompt. */
		src?: string;
		/** Download file name (without the .pdf extension is fine). */
		fileName?: string;
		/** Initial zoom; fit modes start at 1. */
		defaultZoom?: PdfViewerZoomLevel;
		/** Show the toolbar. */
		showToolbar?: boolean;
		/** Show the download button. */
		showDownload?: boolean;
		/** Show the rotate buttons. */
		showRotateControls?: boolean;
		/** Show the upload control. */
		showUpload?: boolean;
		/** Extra class per page wrapper. */
		pageClassName?: (pageNumber: number) => string | undefined;
		/** Overlay snippet rendered on top of each visible page. */
		pageOverlay?: Snippet<[PdfViewerPageOverlayProps]>;
		/** Extra toolbar content. */
		toolbarActions?: Snippet;
		/** Called when the active (topmost visible) page changes. */
		onActivePageChange?: (pageNumber: number) => void;
		/** Called with the page count once the document loads. */
		onDocumentLoadSuccess?: (numPages: number) => void;
		/** Called with the file chosen through the upload control. */
		onPdfUpload?: (file: File) => void;
		/** Parent-controlled dark mode flag. */
		isDark?: boolean;
		/** Called when the user toggles dark mode. */
		onIsDarkChange?: (isDark: boolean) => void;
		/** Viewport height in px. */
		height?: number;
		/** Page CSS width in px at zoom 1. */
		pageWidth?: number;
		/** Page CSS height in px at zoom 1. */
		pageHeight?: number;
		/** Gap between pages in px. */
		pageGap?: number;
		/** Extra pages rendered above/below the visible window. */
		overscan?: number;
		class?: string;
	}

	let {
		src,
		fileName,
		defaultZoom = DEFAULT_ZOOM,
		showToolbar = true,
		showDownload = true,
		showRotateControls = true,
		showUpload = true,
		pageClassName,
		pageOverlay,
		toolbarActions,
		onActivePageChange,
		onDocumentLoadSuccess,
		onPdfUpload,
		isDark = false,
		onIsDarkChange,
		height = 600,
		pageWidth = 612,
		pageHeight = 792,
		pageGap = 24,
		overscan = DEFAULT_OVERSCAN,
		class: className = ''
	}: PdfViewerProps = $props();

	let engine: PdfEngine | null = $state.raw(null);
	// svelte-ignore state_referenced_locally: `src` intentionally seeds the initial status only.
	let status: 'empty' | 'loading' | 'ready' | 'error' = $state(src ? 'loading' : 'empty');
	let loadError = $state('');
	let numPages = $state(0);
	let activePage = $state(1);
	// svelte-ignore state_referenced_locally: `defaultZoom` is intentionally uncontrolled after mount.
	let zoom = $state(resolveInitialZoom(defaultZoom));
	let rotation = $state(0);
	let scrollTop = $state(0);
	let uploadUrl: string | null = $state(null);
	let downloading = $state(false);
	let viewport: HTMLDivElement | null = $state(null);

	const effectiveSrc = $derived(uploadUrl ?? src);
	const slotHeight = $derived(pageHeight * zoom + pageGap);
	const range = $derived(
		computeWindow({
			itemCount: numPages,
			itemHeight: slotHeight,
			viewportHeight: height,
			scrollTop,
			overscan
		})
	);
	const visiblePages = $derived(
		Array.from({ length: range.end - range.start }, (_, offset) => range.start + offset + 1)
	);
	const spacerHeight = $derived(totalHeight(numPages, slotHeight));
	const canNavigate = $derived(status === 'ready' && numPages > 0);

	// Browser-only: the engine (and PDF.js behind it) loads on the client.
	onMount(() => {
		let cancelled = false;
		let unsubscribe: (() => void) | null = null;
		(async () => {
			const { createPdfEngine } = await import('#lib/engines/pdf/index.js');
			if (cancelled) return;
			const created = createPdfEngine();
			unsubscribe = created.onPageChange((page) => {
				activePage = page;
				onActivePageChange?.(page);
			});
			engine = created;
		})();
		return () => {
			cancelled = true;
			unsubscribe?.();
			unsubscribe = null;
			const created = engine;
			engine = null;
			if (uploadUrl) URL.revokeObjectURL(uploadUrl);
			uploadUrl = null;
			void created?.destroy();
		};
	});

	// Client-only: $effect never runs on the server.
	$effect(() => {
		const source = effectiveSrc;
		const eng = engine;
		if (!eng) return;
		if (!source) {
			status = 'empty';
			numPages = 0;
			return;
		}
		let cancelled = false;
		status = 'loading';
		loadError = '';
		eng.load(source).then(
			(count) => {
				if (cancelled) return;
				numPages = count;
				status = 'ready';
				scrollTop = 0;
				if (viewport) viewport.scrollTop = 0;
				onDocumentLoadSuccess?.(count);
			},
			(failure: unknown) => {
				if (cancelled) return;
				numPages = 0;
				status = 'error';
				loadError =
					failure instanceof Error ? failure.message : 'Unable to load the PDF preview.';
			}
		);
		return () => {
			cancelled = true;
		};
	});

	function syncActivePageFromScroll(): void {
		const page = computeActivePage(scrollTop, slotHeight, numPages);
		if (page > 0 && page !== activePage) {
			if (engine) {
				engine.setCurrentPage(page);
			} else {
				activePage = page;
				onActivePageChange?.(page);
			}
		}
	}

	function handleScroll(event: Event): void {
		const target = event.currentTarget;
		if (!(target instanceof HTMLElement)) return;
		scrollTop = target.scrollTop;
		syncActivePageFromScroll();
	}

	function goToPage(page: number): void {
		if (numPages === 0) return;
		const clamped = Math.min(Math.max(Math.floor(page), 1), numPages);
		if (engine) {
			engine.setCurrentPage(clamped);
		} else {
			activePage = clamped;
			onActivePageChange?.(clamped);
		}
		const top = offsetTopForIndex(clamped - 1, slotHeight);
		scrollTop = top;
		if (viewport) viewport.scrollTop = top;
	}

	function handleFileChange(event: Event): void {
		const input = event.currentTarget;
		if (!(input instanceof HTMLInputElement)) return;
		const file = input.files?.[0];
		if (!file) return;
		onPdfUpload?.(file);
		if (uploadUrl) URL.revokeObjectURL(uploadUrl);
		uploadUrl = URL.createObjectURL(file);
		input.value = '';
	}

	async function download(): Promise<void> {
		const source = effectiveSrc;
		if (!source || downloading) return;
		downloading = true;
		try {
			const response = await fetch(source);
			if (!response.ok) {
				throw new Error(`Download failed with status ${response.status}.`);
			}
			const blob = await response.blob();
			const name = getPdfDownloadFileName(fileName, src ?? source);
			const url = URL.createObjectURL(blob);
			const anchor = document.createElement('a');
			anchor.href = url;
			anchor.setAttribute('download', name);
			document.body.appendChild(anchor);
			anchor.click();
			anchor.remove();
			URL.revokeObjectURL(url);
		} catch (failure: unknown) {
			loadError = failure instanceof Error ? failure.message : 'Download failed.';
			status = 'error';
		} finally {
			downloading = false;
		}
	}
</script>

<div
	class={`pdf-viewer${isDark ? ' dark' : ''}${className ? ` ${className}` : ''}`}
	data-dark={String(isDark)}
	data-rotation={rotation}
	data-testid="pdf-viewer"
>
	{#if showToolbar}
		<div role="toolbar" aria-label="PDF viewer toolbar" class="pdf-toolbar">
			<button
				type="button"
				class="pdf-button"
				aria-label="Previous page"
				disabled={!canNavigate || activePage <= 1}
				onclick={() => goToPage(activePage - 1)}
			>
				&#8249;
			</button>
			<span class="pdf-indicator" data-testid="pdf-page-indicator">
				Page {activePage} of {numPages}
			</span>
			<button
				type="button"
				class="pdf-button"
				aria-label="Next page"
				disabled={!canNavigate || activePage >= numPages}
				onclick={() => goToPage(activePage + 1)}
			>
				&#8250;
			</button>
			<span class="pdf-separator" aria-hidden="true"></span>
			<button
				type="button"
				class="pdf-button"
				aria-label="Zoom out"
				disabled={!canNavigate}
				onclick={() => (zoom = zoomStepOut(zoom))}
			>
				&minus;
			</button>
			<span class="pdf-indicator" data-testid="pdf-zoom-label">{formatZoomPercent(zoom)}</span>
			<button
				type="button"
				class="pdf-button"
				aria-label="Zoom in"
				disabled={!canNavigate}
				onclick={() => (zoom = zoomStepIn(zoom))}
			>
				+
			</button>
			{#if showRotateControls}
				<span class="pdf-separator" aria-hidden="true"></span>
				<button
					type="button"
					class="pdf-button"
					aria-label="Rotate counter-clockwise"
					disabled={!canNavigate}
					onclick={() => (rotation = rotateCounterClockwise(rotation))}
				>
					&#10226;
				</button>
				<button
					type="button"
					class="pdf-button"
					aria-label="Rotate clockwise"
					disabled={!canNavigate}
					onclick={() => (rotation = rotateClockwise(rotation))}
				>
					&#10227;
				</button>
			{/if}
			{#if showDownload}
				<button
					type="button"
					class="pdf-button"
					aria-label="Download PDF"
					disabled={!canNavigate || downloading}
					onclick={() => void download()}
				>
					{downloading ? 'Downloading…' : 'Download'}
				</button>
			{/if}
			{#if showUpload}
				<label class="pdf-button pdf-upload">
					Upload
					<input
						type="file"
						accept="application/pdf,.pdf"
						aria-label="Upload PDF"
						class="pdf-file-input"
						onchange={handleFileChange}
					/>
				</label>
			{/if}
			{@render toolbarActions?.()}
			<button
				type="button"
				class="pdf-button pdf-theme-toggle"
				role="switch"
				aria-checked={String(isDark)}
				aria-label="Toggle dark mode"
				onclick={() => onIsDarkChange?.(!isDark)}
			>
				{isDark ? 'Light' : 'Dark'}
			</button>
		</div>
	{/if}

	{#if status === 'loading'}
		<div class="pdf-state" role="status">Loading PDF…</div>
	{:else if status === 'error'}
		<div class="pdf-state pdf-error" role="alert">
			{loadError || 'Unable to load the PDF preview.'}
		</div>
	{:else if !effectiveSrc}
		<div class="pdf-state">
			<p class="pdf-state-title">Upload a PDF to preview</p>
			<p class="pdf-state-hint">Pass a PDF URL with the <code>src</code> prop or use the upload control.</p>
		</div>
	{:else}
		<div
			class="pdf-viewport"
			data-testid="pdf-viewport"
			style={`height: ${height}px;`}
			bind:this={viewport}
			onscroll={handleScroll}
		>
			<div class="pdf-spacer" style={`height: ${spacerHeight}px;`}>
				{#each visiblePages as pageNumber (pageNumber)}
					<div
						class="pdf-slot"
						style={`top: ${offsetTopForIndex(pageNumber - 1, slotHeight)}px; height: ${slotHeight}px;`}
					>
						<PdfPage
							engine={engine}
							pageNumber={pageNumber}
							scale={zoom}
							rotation={rotation}
							width={pageWidth * zoom}
							height={pageHeight * zoom}
							pageClass={pageClassName?.(pageNumber)}
							overlay={pageOverlay}
						/>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	.pdf-viewer {
		--pdf-bg: #ffffff;
		--pdf-fg: #171717;
		--pdf-muted: #525252;
		--pdf-border: #e5e5e5;
		--pdf-canvas-bg: #f5f5f5;
		display: flex;
		flex-direction: column;
		width: 100%;
		overflow: hidden;
		background: var(--pdf-bg);
		color: var(--pdf-fg);
		border: 1px solid var(--pdf-border);
		border-radius: 0.75rem;
		font-family:
			system-ui,
			-apple-system,
			'Segoe UI',
			sans-serif;
		font-size: 13px;
	}

	.pdf-viewer.dark {
		--pdf-bg: #0a0a0a;
		--pdf-fg: #e5e5e5;
		--pdf-muted: #a3a3a3;
		--pdf-border: #262626;
		--pdf-canvas-bg: #171717;
	}

	.pdf-toolbar {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.5rem 0.75rem;
		border-bottom: 1px solid var(--pdf-border);
		flex-wrap: wrap;
	}

	.pdf-button {
		flex: none;
		padding: 0.375rem 0.625rem;
		border: 1px solid var(--pdf-border);
		border-radius: 0.375rem;
		background: transparent;
		color: var(--pdf-fg);
		font: inherit;
		cursor: pointer;
		line-height: 1.25;
	}

	.pdf-button:disabled {
		opacity: 0.45;
		cursor: default;
	}

	.pdf-indicator {
		white-space: nowrap;
		color: var(--pdf-muted);
		font-size: 12px;
		padding: 0 0.25rem;
	}

	.pdf-separator {
		width: 1px;
		align-self: stretch;
		margin: 0.125rem 0.25rem;
		background: var(--pdf-border);
	}

	.pdf-upload {
		cursor: pointer;
	}

	.pdf-file-input {
		position: absolute;
		width: 1px;
		height: 1px;
		opacity: 0;
		overflow: hidden;
	}

	.pdf-theme-toggle {
		margin-left: auto;
	}

	.pdf-state {
		display: grid;
		place-items: center;
		align-content: center;
		gap: 0.25rem;
		min-height: 200px;
		padding: 1rem;
		text-align: center;
	}

	.pdf-state-title {
		margin: 0;
		font-weight: 600;
	}

	.pdf-state-hint {
		margin: 0;
		color: var(--pdf-muted);
	}

	.pdf-error {
		color: #b91c1c;
	}

	.dark .pdf-error {
		color: #f87171;
	}

	.pdf-viewport {
		overflow-y: auto;
		background: var(--pdf-canvas-bg);
	}

	.pdf-spacer {
		position: relative;
	}

	.pdf-slot {
		position: absolute;
		left: 0;
		right: 0;
		display: flex;
		justify-content: center;
	}
</style>
