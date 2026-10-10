<!--
	MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
	E-signature: draw with signature_pad, stamp onto a PDF with pdf-lib,
	preview through the shared PDF.js engine wrapper, download the result.
	Browser-only libraries load on the client via dynamic import() in onMount.
	Placement coordinates are PDF points from the bottom-left page corner.
-->
<script lang="ts">
	import { onMount, tick } from 'svelte';
	import type { PdfEngine } from '#lib/engines/pdf/index.js';
	import {
		clampPage,
		dataUrlToBytes,
		DEFAULT_POSITION_X,
		DEFAULT_POSITION_Y,
		DEFAULT_SCALE,
		DEFAULT_SIGNATURE_HEIGHT,
		DEFAULT_SIGNATURE_WIDTH,
		embedSignaturePng,
		getSignedDownloadFileName,
		MAX_SCALE,
		MIN_SCALE,
		resolvePlacement
	} from './sign-pdf.js';

	export interface ESignatureProps {
		/** PDF URL to sign. Empty renders the no-document prompt. */
		src?: string;
		/** Download base name; "-signed.pdf" is appended. */
		fileName?: string;
		/** Initial 1-based page; the component owns the active page after mount. */
		page?: number;
		/** Signature offset from the left page edge in PDF points. */
		positionX?: number;
		/** Signature offset from the bottom page edge in PDF points. */
		positionY?: number;
		/** Signature box width in PDF points before scaling. */
		signatureWidth?: number;
		/** Signature box height in PDF points before scaling. */
		signatureHeight?: number;
		/** Placement scale multiplier. */
		scale?: number;
		/** Ink color for the signature pad. */
		penColor?: string;
		/** Pad background; transparent keeps the stamped PNG clean. */
		backgroundColor?: string;
		/** Show the download button once a signature is placed. */
		showDownload?: boolean;
		/** Parent-controlled dark mode flag. */
		isDark?: boolean;
		/** Called when the user toggles dark mode. */
		onIsDarkChange?: (isDark: boolean) => void;
		/** Called when the pad gains or loses a signature. */
		onSignatureChange?: (hasSignature: boolean) => void;
		/** Called with the page count once the document loads. */
		onDocumentLoadSuccess?: (numPages: number) => void;
		/** Called when the active preview page changes. */
		onPageChange?: (page: number) => void;
		/** Called with the file name when the signed PDF downloads. */
		onSignedDownload?: (fileName: string) => void;
		class?: string;
	}

	let {
		src,
		fileName,
		page = 1,
		positionX = $bindable(DEFAULT_POSITION_X),
		positionY = $bindable(DEFAULT_POSITION_Y),
		signatureWidth = $bindable(DEFAULT_SIGNATURE_WIDTH),
		signatureHeight = $bindable(DEFAULT_SIGNATURE_HEIGHT),
		scale = $bindable(DEFAULT_SCALE),
		penColor = '#111827',
		backgroundColor = 'rgba(0,0,0,0)',
		showDownload = true,
		isDark = false,
		onIsDarkChange,
		onSignatureChange,
		onDocumentLoadSuccess,
		onPageChange,
		onSignedDownload,
		class: className = ''
	}: ESignatureProps = $props();

	type SignaturePadInstance = {
		isEmpty(): boolean;
		clear(): void;
		toDataURL(type?: string): string;
		off(): void;
		addEventListener(type: string, listener: () => void): void;
		removeEventListener(type: string, listener: () => void): void;
	};

	let padCanvas: HTMLCanvasElement | null = $state(null);
	let previewCanvas: HTMLCanvasElement | null = $state(null);
	let pad: SignaturePadInstance | null = $state.raw(null);
	let engine: PdfEngine | null = $state.raw(null);
	let hasSignature = $state(false);
	let padReady = $state(false);
	// svelte-ignore state_referenced_locally: `page` intentionally seeds the initial page only.
	let activePage = $state(page);
	// svelte-ignore state_referenced_locally: `src` intentionally seeds the initial status only.
	let status: 'empty' | 'loading' | 'ready' | 'error' = $state(src ? 'loading' : 'empty');
	let loadError = $state('');
	let placeError = $state('');
	let numPages = $state(0);
	let placing = $state(false);
	let originalBytes: Uint8Array | null = $state.raw(null);
	let signedBytes: Uint8Array | null = $state.raw(null);

	const pdfReady = $derived(status === 'ready' && numPages > 0);
	const canPlace = $derived(pdfReady && hasSignature && !placing);
	const canDownload = $derived(pdfReady && signedBytes !== null);

	// Browser-only: signature_pad and the PDF engine load on the client.
	onMount(() => {
		let cancelled = false;
		let handleStroke: (() => void) | null = null;

		(async () => {
			const [{ default: SignaturePad }, { createPdfEngine }] = await Promise.all([
				import('signature_pad'),
				import('#lib/engines/pdf/index.js')
			]);
			if (cancelled) return;
			const created = createPdfEngine();
			engine = created;
			const canvas = padCanvas;
			if (canvas) {
				const context = canvas.getContext('2d');
				if (context) {
					const ratio =
						typeof window !== 'undefined' && window.devicePixelRatio > 1
							? window.devicePixelRatio
							: 1;
					if (ratio !== 1 && typeof context.scale === 'function') {
						canvas.width *= ratio;
						canvas.height *= ratio;
						context.scale(ratio, ratio);
					}
					const instance = new SignaturePad(canvas, { penColor, backgroundColor });
					handleStroke = () => {
						const drawn = !instance.isEmpty();
						if (drawn !== hasSignature) {
							hasSignature = drawn;
							onSignatureChange?.(drawn);
						}
					};
					instance.addEventListener('endStroke', handleStroke);
					pad = instance;
					padReady = true;
				}
			}
		})();

		return () => {
			cancelled = true;
			if (pad && handleStroke) {
				pad.removeEventListener('endStroke', handleStroke);
				pad.off();
			}
			handleStroke = null;
			pad = null;
			padReady = false;
			const created = engine;
			engine = null;
			void created?.destroy();
		};
	});

	// Client-only: $effect never runs on the server.
	$effect(() => {
		const source = src;
		const eng = engine;
		if (!eng) return;
		if (!source) {
			status = 'empty';
			numPages = 0;
			originalBytes = null;
			signedBytes = null;
			return;
		}
		let cancelled = false;
		status = 'loading';
		loadError = '';
		placeError = '';
		signedBytes = null;
		fetch(source)
			.then(async (response) => {
				if (!response.ok) {
					throw new Error(`Unable to load the PDF (status ${response.status}).`);
				}
				return new Uint8Array(await response.arrayBuffer());
			})
			.then(async (bytes) => {
				if (cancelled) return;
				originalBytes = bytes;
				const count = await eng.load(new Uint8Array(bytes));
				if (cancelled) return;
				numPages = count;
				activePage = clampPage(activePage, count);
				status = 'ready';
				onDocumentLoadSuccess?.(count);
				// Let the preview canvas mount before rendering into it.
				await tick();
				if (cancelled) return;
				await renderPreview();
			})
			.catch((failure: unknown) => {
				if (cancelled) return;
				numPages = 0;
				originalBytes = null;
				status = 'error';
				loadError =
					failure instanceof Error ? failure.message : 'Unable to load the PDF preview.';
			});
		return () => {
			cancelled = true;
		};
	});

	async function renderPreview(): Promise<void> {
		const eng = engine;
		const canvas = previewCanvas;
		if (!eng || !canvas || status !== 'ready' || numPages === 0) return;
		try {
			await eng.renderPage(activePage, canvas, { scale: 1 });
		} catch (failure: unknown) {
			status = 'error';
			loadError =
				failure instanceof Error ? failure.message : 'Unable to render the PDF preview.';
		}
	}

	function goToPage(next: number): void {
		if (numPages === 0) return;
		const clamped = clampPage(next, numPages);
		if (clamped === 0 || clamped === activePage) return;
		activePage = clamped;
		onPageChange?.(clamped);
		void renderPreview();
	}

	function clearSignature(): void {
		pad?.clear();
		if (hasSignature) {
			hasSignature = false;
			onSignatureChange?.(false);
		}
	}

	async function placeSignature(): Promise<void> {
		const instance = pad;
		const bytes = originalBytes;
		const eng = engine;
		if (!instance || !bytes || !eng || placing) return;
		if (instance.isEmpty()) {
			hasSignature = false;
			onSignatureChange?.(false);
			return;
		}
		placing = true;
		placeError = '';
		try {
			const pngBytes = dataUrlToBytes(instance.toDataURL('image/png'));
			const placement = resolvePlacement({
				page: activePage,
				x: positionX,
				y: positionY,
				width: signatureWidth,
				height: signatureHeight,
				scale,
				pageCount: numPages
			});
			// Stamp onto the original bytes so re-placing replaces the stamp.
			const stamped = await embedSignaturePng(bytes, pngBytes, placement);
			signedBytes = stamped;
			numPages = await eng.load(new Uint8Array(stamped));
			await renderPreview();
		} catch (failure: unknown) {
			placeError =
				failure instanceof Error ? failure.message : 'Unable to place the signature.';
		} finally {
			placing = false;
		}
	}

	function downloadSigned(): void {
		const stamped = signedBytes;
		if (!stamped) return;
		const name = getSignedDownloadFileName(fileName, src ?? '');
		const bytes = new Uint8Array(stamped);
		const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' });
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.setAttribute('download', name);
		document.body.appendChild(anchor);
		anchor.click();
		anchor.remove();
		URL.revokeObjectURL(url);
		onSignedDownload?.(name);
	}
</script>

<div
	class={`e-signature${isDark ? ' dark' : ''}${className ? ` ${className}` : ''}`}
	data-dark={String(isDark)}
	data-pdf-ready={String(pdfReady)}
	data-signed={String(signedBytes !== null)}
	data-testid="e-signature"
>
	<div role="toolbar" aria-label="E-signature toolbar" class="es-toolbar">
		<span class="es-title">E-Signature</span>
		<button
			type="button"
			class="es-button es-theme-toggle"
			role="switch"
			aria-checked={String(isDark)}
			aria-label="Toggle dark mode"
			onclick={() => onIsDarkChange?.(!isDark)}
		>
			{isDark ? 'Light' : 'Dark'}
		</button>
	</div>

	<div class="es-panels">
		<section aria-label="Draw your signature" class="es-panel">
			<canvas
				bind:this={padCanvas}
				class="es-pad"
				data-pad-ready={String(padReady)}
				data-testid="e-signature-pad"
				width="560"
				height="200"
			></canvas>
			<p class="es-status" data-testid="e-signature-status">
				{hasSignature ? 'Signature ready' : 'Draw your signature above'}
			</p>
			<div class="es-row">
				<button
					type="button"
					class="es-button"
					disabled={!hasSignature}
					onclick={clearSignature}
				>
					Clear signature
				</button>
			</div>
		</section>

		<section aria-label="Place the signature on the PDF" class="es-panel">
			{#if status === 'loading'}
				<div class="es-state" role="status">Loading PDF…</div>
			{:else if status === 'error'}
				<div class="es-state es-error" role="alert">
					{loadError || 'Unable to load the PDF preview.'}
				</div>
			{:else if !src}
				<div class="es-state">
					<p class="es-state-title">Choose a PDF to sign</p>
					<p class="es-state-hint">
						Pass a PDF URL with the <code>src</code> prop.
					</p>
				</div>
			{:else}
				<div class="es-row">
					<button
						type="button"
						class="es-button"
						aria-label="Previous page"
						disabled={activePage <= 1}
						onclick={() => goToPage(activePage - 1)}
					>
						&#8249;
					</button>
					<span class="es-indicator" data-testid="e-signature-page-indicator">
						Page {activePage} of {numPages}
					</span>
					<button
						type="button"
						class="es-button"
						aria-label="Next page"
						disabled={activePage >= numPages}
						onclick={() => goToPage(activePage + 1)}
					>
						&#8250;
					</button>
				</div>
				<canvas
					bind:this={previewCanvas}
					class="es-preview"
					data-testid="e-signature-preview"
				></canvas>
				<div class="es-grid">
					<label class="es-field">
						Position X (pt)
						<input type="number" min="0" step="1" bind:value={positionX} />
					</label>
					<label class="es-field">
						Position Y (pt)
						<input type="number" min="0" step="1" bind:value={positionY} />
					</label>
					<label class="es-field">
						Width (pt)
						<input type="number" min="1" step="1" bind:value={signatureWidth} />
					</label>
					<label class="es-field">
						Height (pt)
						<input type="number" min="1" step="1" bind:value={signatureHeight} />
					</label>
				</div>
				<label class="es-field es-scale">
					Scale
					<input
						type="range"
						min={MIN_SCALE}
						max={MAX_SCALE}
						step="0.05"
						bind:value={scale}
					/>
					<span class="es-indicator" data-testid="e-signature-scale-label">
						{Math.round(scale * 100)}%
					</span>
				</label>
				{#if placeError}
					<div class="es-state es-error" role="alert">{placeError}</div>
				{/if}
				<div class="es-row">
					<button
						type="button"
						class="es-button es-primary"
						disabled={!canPlace}
						onclick={() => void placeSignature()}
					>
						{placing ? 'Placing…' : 'Place signature'}
					</button>
					{#if showDownload}
						<button
							type="button"
							class="es-button"
							disabled={!canDownload}
							onclick={downloadSigned}
						>
							Download signed PDF
						</button>
					{/if}
				</div>
			{/if}
		</section>
	</div>
</div>

<style>
	.e-signature {
		--es-bg: #ffffff;
		--es-fg: #171717;
		--es-muted: #525252;
		--es-border: #e5e5e5;
		--es-canvas-bg: #f5f5f5;
		--es-accent: #2563eb;
		display: flex;
		flex-direction: column;
		width: 100%;
		overflow: hidden;
		background: var(--es-bg);
		color: var(--es-fg);
		border: 1px solid var(--es-border);
		border-radius: 0.75rem;
		font-family:
			system-ui,
			-apple-system,
			'Segoe UI',
			sans-serif;
		font-size: 13px;
	}

	.e-signature.dark {
		--es-bg: #0a0a0a;
		--es-fg: #e5e5e5;
		--es-muted: #a3a3a3;
		--es-border: #262626;
		--es-canvas-bg: #171717;
		--es-accent: #60a5fa;
	}

	.es-toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		border-bottom: 1px solid var(--es-border);
	}

	.es-title {
		font-weight: 600;
	}

	.es-panels {
		display: grid;
		gap: 1rem;
		padding: 0.75rem;
		grid-template-columns: 1fr;
	}

	@media (min-width: 900px) {
		.es-panels {
			grid-template-columns: 1fr 1fr;
		}
	}

	.es-panel {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-width: 0;
	}

	.es-pad,
	.es-preview {
		width: 100%;
		border: 1px solid var(--es-border);
		border-radius: 0.5rem;
		background: var(--es-canvas-bg);
		touch-action: none;
	}

	.es-pad {
		height: 200px;
		cursor: crosshair;
	}

	.es-status {
		margin: 0;
		color: var(--es-muted);
		font-size: 12px;
	}

	.es-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.es-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.5rem;
	}

	.es-field {
		display: grid;
		gap: 0.25rem;
		font-size: 12px;
		color: var(--es-muted);
	}

	.es-field input[type='number'] {
		width: 100%;
		padding: 0.375rem 0.5rem;
		border: 1px solid var(--es-border);
		border-radius: 0.375rem;
		background: transparent;
		color: var(--es-fg);
		font: inherit;
	}

	.es-scale {
		grid-template-columns: auto 1fr auto;
		align-items: center;
	}

	.es-button {
		flex: none;
		padding: 0.375rem 0.625rem;
		border: 1px solid var(--es-border);
		border-radius: 0.375rem;
		background: transparent;
		color: var(--es-fg);
		font: inherit;
		cursor: pointer;
		line-height: 1.25;
	}

	.es-button:disabled {
		opacity: 0.45;
		cursor: default;
	}

	.es-primary {
		background: var(--es-accent);
		border-color: var(--es-accent);
		color: #ffffff;
	}

	.e-signature.dark .es-primary {
		color: #0a0a0a;
	}

	.es-indicator {
		white-space: nowrap;
		color: var(--es-muted);
		font-size: 12px;
		padding: 0 0.25rem;
	}

	.es-state {
		display: grid;
		gap: 0.25rem;
		place-items: center;
		text-align: center;
		padding: 2rem 1rem;
		color: var(--es-muted);
	}

	.es-state-title {
		margin: 0;
		font-weight: 600;
		color: var(--es-fg);
	}

	.es-state-hint {
		margin: 0;
		font-size: 12px;
	}

	.es-error {
		color: #dc2626;
	}

	.e-signature.dark .es-error {
		color: #f87171;
	}
</style>
