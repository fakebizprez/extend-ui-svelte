<!--
	MIT License — Svelte 5 port of Extend UI pdf-viewer. Upstream: extend-hq/ui (MIT).
	Deliberate changes vs the React PDFViewer (also listed on the docs page):
	- Rendering runs on the shared PDF.js engine wrapper (#lib/engines/pdf)
	  instead of the @embedpdf plugin stack. Zoom modes use EmbedPDF's formulas.
	- Dark mode is parent-controlled (isDark + onIsDarkChange) per project
	  contract; the viewer never renders its own dark toggle.
	- renderPageOverlay is a `pageOverlay` snippet; toolbarActions is a snippet.
	- `class` and `className` are both accepted and merged.
	- Extra props: `height` (viewport px), `pageWidth`/`pageHeight` (fallback
	  page size when the engine cannot report sizes), `pageGap`, `overscan`.
	- The toolbar adds previous/next page buttons and shows a plain page
	  indicator; Download and Upload are toolbar buttons instead of a menu.
	- Out of scope: thumbnail sidebar (rotate applies to the active page),
	  text search, text selection, tiling, page pointer callbacks,
	  resolveScrollAreaViewport, and the imperative ref handle.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import type { Snippet } from 'svelte';
	import { DEFAULT_OVERSCAN } from '../../virtual-list/window.js';
	import type { PdfEngine, PdfPageSize } from '../../engines/pdf/index.js';
	import PdfPage from './PdfPage.svelte';
	import type { PdfViewerPageOverlayProps } from './types.js';
	import {
		anchorOffset,
		computePageLayout,
		DEFAULT_ZOOM,
		formatZoomPercent,
		getPdfDownloadFileName,
		getRotatedPdfDownloadFileName,
		isZoomMode,
		MAX_ZOOM,
		MIN_ZOOM,
		normalizeRotation,
		mostVisiblePage,
		pageAnchorAt,
		pageWindow,
		resolveZoom,
		rotatedPageSize,
		zoomSelectOptions,
		zoomSelectValue,
		ZOOM_MODES,
		zoomStepIn,
		zoomStepOut,
		type PageAnchor,
		type PdfPageLayout,
		type PdfViewerZoomLevel
	} from './zoom.js';

	export interface PdfViewerProps {
		/** PDF URL to load. Empty renders the upload prompt. */
		src?: string;
		/** Download file name (without the .pdf extension is fine). */
		fileName?: string;
		/** Initial zoom: a scale, or 'fit-page' | 'fit-width' | 'automatic'. */
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
		/** Part of the dark-mode contract; the viewer itself never toggles dark mode. */
		onIsDarkChange?: (isDark: boolean) => void;
		/** Viewport height in px. */
		height?: number;
		/** Fallback page CSS width in px at zoom 1, used until real sizes are known. */
		pageWidth?: number;
		/** Fallback page CSS height in px at zoom 1, used until real sizes are known. */
		pageHeight?: number;
		/** Gap around and between pages in px. */
		pageGap?: number;
		/** Extra pages rendered above/below the visible window. */
		overscan?: number;
		class?: string;
		/** Alias of `class`, matching the React prop name. */
		className?: string;
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
		height = 600,
		pageWidth = 612,
		pageHeight = 792,
		pageGap = 24,
		overscan = DEFAULT_OVERSCAN,
		class: classProp = '',
		className = ''
	}: PdfViewerProps = $props();

	let engine: PdfEngine | null = $state.raw(null);
	// svelte-ignore state_referenced_locally: `src` intentionally seeds the initial status only.
	let status = $state<'empty' | 'loading' | 'ready' | 'error'>(src ? 'loading' : 'empty');
	let numPages = $state(0);
	let engineFailed = $state(false);
	let pageSizes: PdfPageSize[] = $state.raw([]);
	/** Rotation added per page index, in degrees; pages without an entry are unrotated. */
	let pageRotations: ReadonlyMap<number, number> = $state.raw(new Map());
	let activePage = $state(1);
	// svelte-ignore state_referenced_locally: `defaultZoom` is intentionally uncontrolled after mount.
	let zoomLevel: PdfViewerZoomLevel = $state(defaultZoom);
	let viewportWidth = $state(0);
	let viewportHeight = $state(0);
	let scrollTop = $state(0);
	/** An uploaded file shows until `src` changes, like upstream. */
	let upload = $state.raw<{ url: string; forSrc: string | undefined } | null>(null);
	let downloading = $state(false);
	let viewport: HTMLDivElement | null = $state(null);

	const uploadUrl = $derived(upload && upload.forSrc === src ? upload.url : null);
	const effectiveSrc = $derived(uploadUrl ?? src);
	const rootClass = $derived(
		['pdf-viewer', isDark && 'dark', classProp, className].filter(Boolean).join(' ')
	);
	const baseSizes: PdfPageSize[] = $derived(
		pageSizes.length === numPages
			? pageSizes
			: Array.from({ length: numPages }, () => ({ width: pageWidth, height: pageHeight }))
	);
	const zoom = $derived(
		resolveZoom(zoomLevel, { width: viewportWidth, height: viewportHeight, gap: pageGap }, baseSizes)
	);
	const displaySizes = $derived(
		baseSizes.map((size, index) => {
			const rotated = rotatedPageSize(size, pageRotations.get(index) ?? 0);
			return { width: rotated.width * zoom, height: rotated.height * zoom };
		})
	);
	const layout = $derived(computePageLayout(displaySizes, pageGap));
	const range = $derived(pageWindow(layout, scrollTop, height, overscan));
	// Scroll anchoring across relayouts (zoom, rotate, resize), matching upstream:
	// zoom keeps the point at the viewport centre, rotate keeps the active page's
	// centre, and anything else (a resize) keeps the point at the viewport top.
	let anchorFocus: 'center' | 'active-page' | null = null;
	let lastLayout: PdfPageLayout | null = null;
	let pendingScroll: { top: number; leftFraction: number | null } | null = null;

	$effect.pre(() => {
		const next = layout;
		const previous = lastLayout;
		lastLayout = next;
		const focus = anchorFocus;
		anchorFocus = null;
		const element = viewport;
		if (!element || !previous || previous.tops.length !== next.tops.length) return;
		const top = element.scrollTop;
		let anchor: PageAnchor | null;
		let focusOffset = 0;
		if (focus === 'active-page') {
			anchor = { index: activePage - 1, fraction: 0.5 };
		} else {
			// The viewport is styled to `height`, so its centre is height / 2.
			focusOffset = focus === 'center' ? height / 2 : 0;
			anchor = pageAnchorAt(previous, top + focusOffset);
		}
		if (!anchor) return;
		// Zoom also keeps the horizontal centre; content is centred, so a fraction suffices.
		const width = Math.max(previous.totalWidth, element.clientWidth);
		const leftFraction =
			focus === 'center' && width > 0 ? (element.scrollLeft + element.clientWidth / 2) / width : null;
		pendingScroll = {
			top: Math.max(0, top + anchorOffset(next, anchor) - anchorOffset(previous, anchor)),
			leftFraction
		};
	});

	$effect(() => {
		void layout;
		const element = viewport;
		const target = pendingScroll;
		pendingScroll = null;
		if (!element || !target) return;
		element.scrollTop = target.top;
		scrollTop = target.top;
		if (target.leftFraction !== null) {
			const width = Math.max(layout.totalWidth, element.clientWidth);
			element.scrollLeft = Math.max(0, target.leftFraction * width - element.clientWidth / 2);
		}
	});

	const visiblePages = $derived(
		Array.from({ length: range.end - range.start }, (_, offset) => range.start + offset + 1)
	);
	const canNavigate = $derived(status === 'ready' && numPages > 0);

	// Browser-only: the engine (and PDF.js behind it) loads on the client.
	onMount(() => {
		let cancelled = false;
		let unsubscribe: (() => void) | null = null;
		(async () => {
			const { createPdfEngine } = await import('../../engines/pdf/index.js');
			if (cancelled) return;
			const created = createPdfEngine();
			unsubscribe = created.onPageChange((page) => {
				activePage = page;
				onActivePageChange?.(page);
			});
			engine = created;
		})().catch(() => {
			// Like upstream, a failed engine load is an error state, not an endless spinner.
			if (cancelled) return;
			engineFailed = true;
			status = 'error';
		});
		return () => {
			cancelled = true;
			unsubscribe?.();
			unsubscribe = null;
			const created = engine;
			engine = null;
			void created?.destroy();
		};
	});

	// Client-only: $effect never runs on the server.
	$effect(() => {
		const source = effectiveSrc;
		const eng = engine;
		if (!eng) return;
		pageRotations = new Map();
		pageSizes = [];
		if (!source) {
			status = 'empty';
			numPages = 0;
			return;
		}
		let cancelled = false;
		status = 'loading';
		eng.load(source).then(
			async (count) => {
				if (cancelled) return;
				// Unreadable sizes fall back to pageWidth/pageHeight instead of failing the load.
				const sizes = await Promise.resolve()
					.then(() => eng.getPageSizes())
					.catch(() => []);
				if (cancelled) return;
				pageSizes = sizes;
				numPages = count;
				// Each new document starts at defaultZoom, like upstream.
				zoomLevel = defaultZoom;
				status = 'ready';
				scrollTop = 0;
				if (viewport) viewport.scrollTop = 0;
				onDocumentLoadSuccess?.(count);
			},
			() => {
				// Upstream shows a fixed message, never the raw PDF.js error (which can include the URL).
				if (cancelled) return;
				numPages = 0;
				status = 'error';
			}
		);
		return () => {
			cancelled = true;
		};
	});

	// Revoke an upload's object URL once a new upload or a new src replaces it.
	$effect(() => {
		const url = uploadUrl;
		if (!url && upload) upload = null;
		return () => {
			if (url) URL.revokeObjectURL(url);
		};
	});

	// Measure the scroll viewport so fit modes follow resizes, like upstream.
	$effect(() => {
		const element = viewport;
		if (!element) return;
		const measure = () => {
			viewportWidth = element.clientWidth;
			viewportHeight = element.clientHeight;
		};
		measure();
		if (typeof ResizeObserver === 'undefined') return;
		const observer = new ResizeObserver(measure);
		observer.observe(element);
		return () => observer.disconnect();
	});

	function setActivePage(page: number): void {
		if (engine) {
			engine.setCurrentPage(page);
		} else {
			activePage = page;
			onActivePageChange?.(page);
		}
	}

	/** Scroll position a goToPage() call is landing on; its own scroll event keeps that page. */
	let requestedScrollTop: number | null = null;

	function handleScroll(event: Event): void {
		const target = event.currentTarget;
		if (!(target instanceof HTMLElement)) return;
		scrollTop = target.scrollTop;
		const requested = requestedScrollTop;
		requestedScrollTop = null;
		// Like EmbedPDF, a requested page stays current while its own scroll lands.
		if (requested !== null && Math.abs(requested - scrollTop) < 1) return;
		const page = mostVisiblePage(layout, scrollTop, height, target.scrollLeft, viewportWidth);
		if (page > 0 && page !== activePage) setActivePage(page);
	}

	function goToPage(page: number): void {
		if (numPages === 0) return;
		const clamped = Math.min(Math.max(Math.floor(page), 1), numPages);
		setActivePage(clamped);
		const top = layout.tops[clamped - 1] ?? 0;
		scrollTop = top;
		if (viewport) {
			viewport.scrollTop = top;
			// The browser may clamp the position (e.g. the last page cannot reach the top).
			requestedScrollTop = viewport.scrollTop;
		}
	}

	/** Rotate the active page a quarter turn (upstream rotates the selected pages). */
	function rotate(direction: 1 | -1): void {
		const index = activePage - 1;
		if (index < 0 || index >= numPages) return;
		const next = new Map(pageRotations);
		const rotation = normalizeRotation((next.get(index) ?? 0) + direction * 90);
		if (rotation) next.set(index, rotation);
		else next.delete(index);
		anchorFocus = 'active-page';
		pageRotations = next;
	}

	function setZoom(value: string | number): void {
		anchorFocus = 'center';
		zoomLevel = typeof value === 'number' || !isZoomMode(value) ? Number(value) : value;
	}

	function handleFileChange(event: Event): void {
		const input = event.currentTarget;
		if (!(input instanceof HTMLInputElement)) return;
		const file = input.files?.[0];
		if (!file) return;
		onPdfUpload?.(file);
		upload = { url: URL.createObjectURL(file), forSrc: src };
		input.value = '';
	}

	function saveBlob(blob: Blob, name: string): void {
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = name;
		anchor.rel = 'noopener';
		document.body.append(anchor);
		anchor.click();
		anchor.remove();
		setTimeout(() => URL.revokeObjectURL(url), 0);
	}

	/** Download like upstream: the original bytes, or a pdf-lib copy with page rotations saved. */
	async function download(): Promise<void> {
		const source = effectiveSrc;
		if (!source || downloading) return;
		downloading = true;
		try {
			const response = await fetch(source);
			if (!response.ok) {
				throw new Error(`Failed to download PDF (${response.status})`);
			}
			const name = getPdfDownloadFileName(fileName, source);
			if (pageRotations.size === 0) {
				saveBlob(await response.blob(), name);
				return;
			}
			const [{ PDFDocument, degrees }, bytes] = await Promise.all([
				import('pdf-lib'),
				response.arrayBuffer()
			]);
			const pdf = await PDFDocument.load(bytes);
			pdf.getPages().forEach((page, index) => {
				const delta = pageRotations.get(index);
				if (!delta) return;
				page.setRotation(degrees(normalizeRotation(page.getRotation().angle + delta)));
			});
			const saved = await pdf.save();
			const buffer = new ArrayBuffer(saved.byteLength);
			new Uint8Array(buffer).set(saved);
			saveBlob(
				new Blob([buffer], { type: 'application/pdf' }),
				getRotatedPdfDownloadFileName(name)
			);
		} catch (failure: unknown) {
			// Upstream logs download failures and keeps the document on screen.
			console.error(failure);
		} finally {
			downloading = false;
		}
	}
</script>

<div class={rootClass} data-dark={String(isDark)} data-testid="pdf-viewer">
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
				Page {numPages ? activePage : 1} of {numPages || '–'}
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
			{#if showRotateControls}
				<span class="pdf-separator" aria-hidden="true"></span>
				<button
					type="button"
					class="pdf-button"
					aria-label="Rotate counterclockwise"
					disabled={!canNavigate}
					onclick={() => rotate(-1)}
				>
					&#10226;
				</button>
				<button
					type="button"
					class="pdf-button"
					aria-label="Rotate clockwise"
					disabled={!canNavigate}
					onclick={() => rotate(1)}
				>
					&#10227;
				</button>
			{/if}
			<span class="pdf-separator" aria-hidden="true"></span>
			<button
				type="button"
				class="pdf-button"
				aria-label="Zoom out"
				disabled={!canNavigate || zoom <= MIN_ZOOM}
				onclick={() => setZoom(zoomStepOut(zoom))}
			>
				&minus;
			</button>
			<span class="pdf-zoom">
				<select
					class="pdf-zoom-select"
					aria-label="Zoom level"
					value={zoomSelectValue(zoomLevel, zoom)}
					disabled={!canNavigate}
					onchange={(event) => setZoom(event.currentTarget.value)}
				>
					{#each ZOOM_MODES as mode (mode.value)}
						<option value={mode.value}>{mode.label}</option>
					{/each}
					{#each zoomSelectOptions(zoom) as option (option)}
						<option value={String(option)}>{formatZoomPercent(option)}</option>
					{/each}
				</select>
				<!-- Upstream's trigger always shows the current percentage, even in a fit mode. -->
				<span class="pdf-zoom-value" data-testid="pdf-zoom-label" aria-hidden="true">
					{formatZoomPercent(zoom)}
				</span>
			</span>
			<button
				type="button"
				class="pdf-button"
				aria-label="Zoom in"
				disabled={!canNavigate || zoom >= MAX_ZOOM}
				onclick={() => setZoom(zoomStepIn(zoom))}
			>
				+
			</button>
			{#if toolbarActions}
				<span class="pdf-separator" aria-hidden="true"></span>
				{@render toolbarActions()}
			{/if}
			{#if showDownload || showUpload}
				<span class="pdf-separator" aria-hidden="true"></span>
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
		</div>
	{/if}

	{#if status === 'loading'}
		<div class="pdf-state" role="status">Loading PDF…</div>
	{:else if status === 'error'}
		<div class="pdf-state pdf-error" role="alert">
			{engineFailed ? 'Unable to load the PDF engine.' : 'Unable to load the PDF preview.'}
		</div>
	{:else if !effectiveSrc}
		<div class="pdf-state">
			<p class="pdf-state-title">Upload a PDF to preview</p>
			<p class="pdf-state-hint">Pass a PDF URL with the <code>src</code> prop or use the upload control.</p>
		</div>
	{:else}
		<!-- svelte-ignore a11y_no_noninteractive_tabindex (Scrollable regions need a keyboard focus target.) -->
		<div
			class="pdf-viewport"
			data-testid="pdf-viewport"
			role="group"
			aria-label="PDF pages"
			tabindex="0"
			style={`height: ${height}px;`}
			bind:this={viewport}
			onscroll={handleScroll}
		>
			<div
				class="pdf-spacer"
				style={`height: ${layout.totalHeight}px; width: ${layout.totalWidth}px;`}
			>
				{#each visiblePages as pageNumber (pageNumber)}
					{@const size = displaySizes[pageNumber - 1]}
					<div
						class="pdf-slot"
						style={`top: ${layout.tops[pageNumber - 1]}px; height: ${size?.height ?? 0}px;`}
					>
						<PdfPage
							engine={engine}
							pageNumber={pageNumber}
							scale={zoom}
							rotation={pageRotations.get(pageNumber - 1) ?? 0}
							width={size?.width ?? 0}
							height={size?.height ?? 0}
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
		min-width: 0;
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

	.pdf-zoom {
		position: relative;
		display: inline-flex;
	}

	/* The select keeps the native list; its own text is hidden under the percentage. */
	.pdf-zoom-select {
		width: 104px;
		padding: 0.375rem 0.5rem;
		border: 1px solid var(--pdf-border);
		border-radius: 0.375rem;
		background: transparent;
		color: transparent;
		font: inherit;
		cursor: pointer;
	}

	.pdf-zoom-select:disabled {
		opacity: 0.45;
		cursor: default;
	}

	.pdf-zoom-select option {
		color: var(--pdf-fg);
		background: var(--pdf-bg);
	}

	.pdf-zoom-value {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		padding: 0 0.625rem;
		pointer-events: none;
		color: var(--pdf-fg);
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
		overflow: auto;
		background: var(--pdf-canvas-bg);
		/* Fit modes size pages from this width, so wide pages must not widen it. */
		contain: inline-size;
	}

	.pdf-spacer {
		position: relative;
		min-width: 100%;
	}

	.pdf-slot {
		position: absolute;
		left: 0;
		right: 0;
		display: flex;
		justify-content: center;
	}

	[data-testid="pdf-viewport"]:focus-visible {
		outline: 2px solid currentColor;
		outline-offset: -2px;
	}
</style>
