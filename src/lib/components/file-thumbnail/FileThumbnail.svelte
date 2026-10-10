<!--
	MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
	Ported from apps/v4/components/extend/file-thumbnail.tsx.

	Deliberate changes from the React version:
	- previewContent is a Svelte Snippet instead of React.ReactNode. `class`
	  is accepted alongside the upstream `className`. The loading overlay is
	  inlined instead of exported as FileThumbnailLoadingOverlay.
	- PDF rendering is built in: pass pdfUrl (or pdfFile) plus pageNumber and
	  width and the requested page renders onto a canvas through the shared PDF
	  engine wrapper (dynamically imported on the client). Upstream renders
	  thumbnails in docs-level wrappers around @embedpdf; here PDF.js does it
	  in-component. Only the requested page is rendered, never the document.
	- Dark mode follows the repo-wide contract (isDark + onIsDarkChange). Like
	  upstream it renders no theme toggle (it is often nested inside a parent
	  button), so it reflects `isDark` and never invokes the callback.
-->
<script module lang="ts">
	export interface ThumbnailFile {
		name: string;
		type: string;
	}

	// Preview URLs that have completed a reveal this session. Remounts render
	// URLs in this set instantly instead of replaying the blur-in.
	const revealedPreviewImageUrls = new Set<string>();
</script>

<script lang="ts">
	import { onMount } from 'svelte';
	import type { Snippet } from 'svelte';
	import type { PdfEngine } from '#lib/engines/pdf/index.js';
	import {
		DEFAULT_THUMBNAIL_PAGE,
		DEFAULT_THUMBNAIL_WIDTH,
		renderPdfThumbnail
	} from './pdf-thumbnail.js';

	interface Props {
		/** The file being previewed. Required, like upstream. */
		file: ThumbnailFile | File;
		className?: string;
		/** Alias of the upstream `className`. */
		class?: string;
		previewAspectRatio?: number;
		previewClassName?: string;
		previewContent?: Snippet;
		previewImageUrl?: string | null;
		isLoading?: boolean;
		hasError?: boolean;
		/** URL of a PDF to render onto the thumbnail canvas. */
		pdfUrl?: string | null;
		/** PDF bytes as a File/Blob; used when pdfUrl is not given. */
		pdfFile?: File | Blob | null;
		/** 1-based page rendered in PDF mode. Defaults to 1. */
		pageNumber?: number;
		/** Target CSS width in pixels in PDF mode. Defaults to 240. */
		width?: number;
		isDark?: boolean;
		onIsDarkChange?: (isDark: boolean) => void;
	}

	let {
		className,
		class: classProp,
		previewAspectRatio,
		previewClassName,
		previewContent,
		previewImageUrl = null,
		isLoading = false,
		hasError = false,
		pdfUrl = null,
		pdfFile = null,
		pageNumber = DEFAULT_THUMBNAIL_PAGE,
		width = DEFAULT_THUMBNAIL_WIDTH,
		isDark = false
	}: Props = $props();

	// PDF mode is the fallback source: explicit image/snippet previews win.
	const pdfActive = $derived(!previewImageUrl && !previewContent && (!!pdfUrl || !!pdfFile));

	let imageRef: HTMLImageElement | null = $state(null);
	let loadedPreviewImageUrl = $state<string | null>(null);
	let failedPreviewImageUrl = $state<string | null>(null);
	let pdfCanvas: HTMLCanvasElement | undefined = $state();
	let pdfStatus = $state<'idle' | 'loading' | 'ready' | 'error'>('idle');
	let pdfAspect = $state<number | null>(null);

	let revealFrame: number | null = null;
	let enginePromise: Promise<PdfEngine> | null = null;
	let pdfRun = 0;

	const imageFailed = $derived(!!(previewImageUrl && failedPreviewImageUrl === previewImageUrl));
	const isImageLoading = $derived(
		!!(
			previewImageUrl &&
			loadedPreviewImageUrl !== previewImageUrl &&
			!imageFailed &&
			!revealedPreviewImageUrls.has(previewImageUrl)
		)
	);
	const hasPreviewContent = $derived(Boolean(previewContent));
	// PDF mode starts loading on mount: idle means the first render is pending.
	const pdfLoading = $derived(pdfActive && (pdfStatus === 'idle' || pdfStatus === 'loading'));
	const showLoading = $derived(isLoading || isImageLoading || pdfLoading);
	const showFallback = $derived(
		!showLoading &&
			(hasError ||
				imageFailed ||
				(pdfActive && pdfStatus === 'error') ||
				(!previewImageUrl && !hasPreviewContent && !pdfActive))
	);
	// CSS aspect-ratio is width / height.
	const aspectRatio = $derived(previewAspectRatio ?? (pdfActive ? (pdfAspect ?? 1) : 1));

	function cancelImageReveal(): void {
		if (revealFrame === null) return;
		window.cancelAnimationFrame(revealFrame);
		revealFrame = null;
	}

	function markImageLoaded(image: HTMLImageElement, imageUrl: string | null | undefined): void {
		if (!imageUrl) return;
		const didLoad = image.naturalWidth > 0 && image.naturalHeight > 0;
		failedPreviewImageUrl = didLoad ? null : imageUrl;
		if (didLoad) {
			revealedPreviewImageUrls.add(imageUrl);
			cancelImageReveal();
			revealFrame = window.requestAnimationFrame(() => {
				revealFrame = window.requestAnimationFrame(() => {
					loadedPreviewImageUrl = imageUrl;
					revealFrame = null;
				});
			});
		}
	}

	function handleImageError(): void {
		if (!previewImageUrl) return;
		revealedPreviewImageUrls.delete(previewImageUrl);
		cancelImageReveal();
		failedPreviewImageUrl = previewImageUrl;
		if (loadedPreviewImageUrl === previewImageUrl) loadedPreviewImageUrl = null;
	}

	async function ensureEngine(): Promise<PdfEngine> {
		// Browser-only: the engine (and PDF.js behind it) loads on the client.
		enginePromise ??= import('#lib/engines/pdf/index.js').then((module) =>
			module.createPdfEngine()
		);
		return enginePromise;
	}

	// Reset the reveal cycle whenever the image URL changes.
	$effect(() => {
		void previewImageUrl;
		cancelImageReveal();
	});

	// Catch images that finished loading from cache before handlers attached.
	$effect(() => {
		const image = imageRef;
		const url = previewImageUrl;
		if (image && url && image.complete) {
			markImageLoaded(image, url);
		}
	});

	// Render the requested PDF page; re-runs when the source, page, or size changes.
	$effect(() => {
		const sourceUrl = pdfUrl;
		const sourceFile = pdfFile;
		const page = pageNumber;
		const targetWidth = width;
		const canvas = pdfCanvas;
		const active = pdfActive;
		if (!active || !canvas) return;

		const run = ++pdfRun;
		pdfStatus = 'loading';
		(async () => {
			try {
				const engine = await ensureEngine();
				if (run !== pdfRun) return;
				const source = sourceFile ? await sourceFile.arrayBuffer() : (sourceUrl as string);
				if (run !== pdfRun) return;
				const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
				const result = await renderPdfThumbnail(engine, source, canvas, {
					pageNumber: page,
					width: targetWidth,
					dpr
				});
				if (run !== pdfRun) return;
				pdfAspect = result.height > 0 ? result.width / result.height : null;
				pdfStatus = 'ready';
			} catch {
				if (run !== pdfRun) return;
				pdfStatus = 'error';
			}
		})();
	});

	onMount(() => {
		return () => {
			pdfRun += 1;
			cancelImageReveal();
			const pending = enginePromise;
			enginePromise = null;
			void pending?.then((engine) => engine.destroy());
		};
	});
</script>

<div class={['file-thumbnail', classProp, className]} class:dark={isDark} data-testid="file-thumbnail">
	<div
		class={['preview', previewClassName]}
		class:preview-loading={showLoading}
		data-testid="file-thumbnail-preview"
		style:aspect-ratio={aspectRatio}
	>
		{#if previewImageUrl}
			<!-- Preview URLs can be transient object or presigned URLs. -->
			<img
				bind:this={imageRef}
				src={previewImageUrl}
				alt=""
				draggable={false}
				loading="lazy"
				decoding="async"
				class="preview-image"
				class:image-loading={showLoading}
				data-testid="file-thumbnail-image"
				onload={(event) => markImageLoaded(event.currentTarget as HTMLImageElement, previewImageUrl)}
				onerror={handleImageError}
			/>
		{/if}
		{#if previewContent}
			<div class="preview-custom" class:image-loading={showLoading}>
				{@render previewContent()}
			</div>
		{/if}
		{#if pdfActive}
			<canvas
				bind:this={pdfCanvas}
				class="pdf-canvas"
				class:image-loading={showLoading}
				data-testid="file-thumbnail-canvas"
			></canvas>
		{/if}
		{#if showLoading}
			<div
				aria-hidden="true"
				class="loading-overlay"
				data-testid="file-thumbnail-loading"
			>
				<div class="loading-pulse"></div>
			</div>
		{/if}
		{#if showFallback}
			<div class="fallback" aria-hidden="true" data-testid="file-thumbnail-fallback"></div>
		{/if}
	</div>
</div>

<style>
	.file-thumbnail {
		--ft-bg: #ffffff;
		--ft-fg: #111827;
		--ft-muted: #f3f4f6;
		--ft-border: rgba(17, 24, 39, 0.12);
		position: relative;
		overflow: hidden;
		border-radius: 0.5rem;
		border: 1px solid var(--ft-border);
		background: var(--ft-bg);
		color: var(--ft-fg);
	}

	.file-thumbnail.dark {
		--ft-bg: #111827;
		--ft-fg: #f3f4f6;
		--ft-muted: #1f2937;
		--ft-border: rgba(243, 244, 246, 0.16);
	}

	.preview {
		position: relative;
		overflow: hidden;
		background: var(--ft-muted);
		contain: layout paint;
	}

	.preview-image,
	.pdf-canvas {
		position: absolute;
		inset: 0;
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: top;
		transition:
			opacity 160ms cubic-bezier(0.22, 1, 0.36, 1),
			filter 160ms cubic-bezier(0.22, 1, 0.36, 1);
	}

	.preview-custom {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		transition:
			opacity 160ms cubic-bezier(0.22, 1, 0.36, 1),
			filter 160ms cubic-bezier(0.22, 1, 0.36, 1);
	}

	.image-loading {
		opacity: 0;
		filter: blur(4px);
	}

	.loading-overlay {
		position: absolute;
		inset: 0;
		z-index: 10;
		overflow: hidden;
		background: var(--ft-muted);
	}

	.loading-pulse {
		position: absolute;
		inset: 0;
		background: var(--ft-bg);
		opacity: 0.55;
		animation: ft-pulse 1.6s ease-in-out infinite;
	}

	@media (prefers-reduced-motion: reduce) {
		.loading-pulse {
			animation: none;
		}
		.preview-image,
		.pdf-canvas,
		.preview-custom {
			transition: none;
		}
	}

	@keyframes ft-pulse {
		0%,
		100% {
			opacity: 0.2;
		}
		50% {
			opacity: 0.55;
		}
	}

	.fallback {
		position: absolute;
		inset: 0;
		background: var(--ft-muted);
	}
</style>
