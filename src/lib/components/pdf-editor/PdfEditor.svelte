<!--
	MIT License — Svelte 5 port of Extend UI pdf-editor. Upstream: extend-hq/ui (MIT).
	Deliberate changes vs the React PDFEditor (also listed on the docs page):
	- The upstream editor is built on the React-only @embedpdf plugin stack;
	  this port covers document-level edits only: per-page rotate, delete,
	  reorder, reset, and download. Annotate, sign, forms, redact, search,
	  print, password prompts, and the imperative handle are not ported.
	- Rendering runs on the shared PDF.js engine wrapper (#lib/engines/pdf)
	  and download runs on pdf-lib, both loaded on the client.
	- The layout is a page list beside a single-page preview instead of the
	  upstream scrolling workspace with side panels.
	- Dark mode is parent-controlled (isDark + onIsDarkChange) per project
	  contract; the editor never renders its own dark toggle.
	- `class` and `className` are both accepted and merged.
	- Shortcuts: ⌘/Ctrl S, =, -, 0 only (undo/redo, print, search not ported).
	- Extra props: `onPagesChange`, `height`, `pageWidth`/`pageHeight`
	  (fallback page size when the engine cannot report sizes).
-->
<script lang="ts" module>
	// Shared by every editor instance so each loaded document gets a unique id.
	let documentCounter = 0;
</script>

<script lang="ts">
	import { onMount } from 'svelte';
	import { VirtualList } from '../../virtual-list/index.js';
	import type { PdfEngine, PdfPageSize } from '../../engines/pdf/index.js';
	import PdfPage from '../pdf-viewer/PdfPage.svelte';
	import {
		formatZoomPercent,
		isZoomMode,
		resolveZoom,
		rotatedPageSize,
		zoomSelectOptions,
		zoomSelectValue,
		ZOOM_MODES,
		zoomStepByRange,
		type PdfViewerZoomLevel
	} from '../pdf-viewer/zoom.js';
	import {
		createEditState,
		deleteEditPage,
		exportEditedPdf,
		getPdfFileName,
		moveEditPage,
		rotateEditPage,
		type EditedPdfPage,
		type PdfEditState
	} from './page-model.js';

	export type PdfEditorZoomLevel = PdfViewerZoomLevel;

	export interface PdfEditorSaveResult {
		buffer: ArrayBuffer;
		fileName: string;
	}

	export interface PdfEditorDocumentInfo {
		numPages: number;
		documentId: string;
		fileName: string;
	}

	export interface PdfEditorProps {
		/** A URL, or the PDF bytes as an ArrayBuffer, Uint8Array, Blob, or File. Empty renders the upload prompt. */
		src?: string | ArrayBuffer | Uint8Array | Blob;
		/** File name for downloads and the load payload (the .pdf extension is optional). */
		fileName?: string;
		/** Initial zoom: a scale, or 'fit-page' | 'fit-width' | 'automatic'. */
		defaultZoom?: PdfEditorZoomLevel;
		/** Show the toolbar. */
		showToolbar?: boolean;
		/** Show the download button. */
		showDownload?: boolean;
		/** Show the upload control. */
		showUpload?: boolean;
		/** Called once the document loads. */
		onDocumentLoadSuccess?: (info: PdfEditorDocumentInfo) => void;
		/** Called with the failure message when the document fails to load. */
		onDocumentLoadError?: (message: string) => void;
		/** Called when the selected (active) page changes. */
		onActivePageChange?: (pageNumber: number) => void;
		/** Called with the edited page list after every edit operation. */
		onPagesChange?: (pages: EditedPdfPage[]) => void;
		/** Called with the downloaded bytes and file name. */
		onSave?: (result: PdfEditorSaveResult) => void;
		/** Called with the file chosen through the upload control. */
		onPdfUpload?: (file: File) => void;
		/** Parent-controlled dark mode flag. */
		isDark?: boolean;
		/** Part of the dark-mode contract; the editor itself never toggles dark mode. */
		onIsDarkChange?: (isDark: boolean) => void;
		/** Body height in px. */
		height?: number;
		/** Fallback page CSS width in px at zoom 1, used until real sizes are known. */
		pageWidth?: number;
		/** Fallback page CSS height in px at zoom 1, used until real sizes are known. */
		pageHeight?: number;
		class?: string;
		/** Alias of `class`, matching the React prop name. */
		className?: string;
	}

	type EditorSource =
		| { kind: 'url'; url: string; name: string }
		| { kind: 'bytes'; bytes: Uint8Array; name: string };

	const THUMBNAIL_WIDTH = 96;
	const THUMBNAIL_HEIGHT = 124;
	const ROW_HEIGHT = 208;
	// Upstream editor zoom presets, limits, and viewport gap.
	const ZOOM_PRESETS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];
	const MIN_ZOOM = 0.1;
	const MAX_ZOOM = 8;
	const PAGE_GAP = 24;

	let {
		src,
		fileName,
		defaultZoom = 'fit-width',
		showToolbar = true,
		showDownload = true,
		showUpload = true,
		onDocumentLoadSuccess,
		onDocumentLoadError,
		onActivePageChange,
		onPagesChange,
		onSave,
		onPdfUpload,
		isDark = false,
		height = 600,
		pageWidth = 612,
		pageHeight = 792,
		class: classProp = '',
		className = ''
	}: PdfEditorProps = $props();

	type LoadStatus = 'empty' | 'loading' | 'ready' | 'error';

	let engine: PdfEngine | null = $state.raw(null);
	// svelte-ignore state_referenced_locally: `src` intentionally seeds the initial status only.
	let status = $state<LoadStatus>(src ? 'loading' : 'empty');
	let loadError = $state('');
	let numPages = $state(0);
	let pageSizes: PdfPageSize[] = $state.raw([]);
	let loaded = $state.raw<EditorSource | null>(null);
	let editState: PdfEditState = $state({ pages: [] });
	let selectedIndex = $state(0);
	// svelte-ignore state_referenced_locally: `defaultZoom` is intentionally uncontrolled after mount.
	let zoomLevel: PdfEditorZoomLevel = $state(defaultZoom);
	let previewWidth = $state(0);
	let previewHeight = $state(0);
	let preview: HTMLDivElement | null = $state(null);
	/** An uploaded file replaces `src` until `src` changes, like upstream. */
	let upload = $state.raw<{ file: File; forSrc: PdfEditorProps['src'] } | null>(null);
	let exporting = $state(false);
	let exportError = $state('');

	const input = $derived(upload && upload.forSrc === src ? upload.file : src);
	const rootClass = $derived(
		['pdf-editor', isDark && 'dark', classProp, className].filter(Boolean).join(' ')
	);
	const canEdit = $derived(status === 'ready');
	const baseSizes: PdfPageSize[] = $derived(
		pageSizes.length === numPages
			? pageSizes
			: Array.from({ length: numPages }, () => ({ width: pageWidth, height: pageHeight }))
	);
	const zoom = $derived(
		resolveZoom(
			zoomLevel,
			{ width: previewWidth, height: previewHeight, gap: PAGE_GAP },
			baseSizes,
			MIN_ZOOM,
			MAX_ZOOM
		)
	);
	const selectedSafeIndex = $derived(
		editState.pages.length === 0 ? -1 : Math.min(selectedIndex, editState.pages.length - 1)
	);
	const activePage = $derived(selectedSafeIndex < 0 ? 0 : selectedSafeIndex + 1);
	const selectedPage = $derived(
		selectedSafeIndex < 0 ? null : editState.pages[selectedSafeIndex]
	);

	/** Page size at zoom 1 after the page's edit rotation. */
	function editedSize(page: EditedPdfPage): PdfPageSize {
		const base = baseSizes[page.sourcePage - 1] ?? { width: pageWidth, height: pageHeight };
		return rotatedPageSize(base, page.rotation);
	}

	function thumbnailScale(page: EditedPdfPage): number {
		const size = editedSize(page);
		return Math.min(THUMBNAIL_WIDTH / size.width, THUMBNAIL_HEIGHT / size.height);
	}

	/** Normalize every accepted `src` form, matching upstream's naming rules. */
	async function resolveSource(
		value: string | ArrayBuffer | Uint8Array | Blob,
		name: string | undefined
	): Promise<EditorSource> {
		if (typeof value === 'string') {
			return { kind: 'url', url: value, name: getPdfFileName(name, value) };
		}
		if (value instanceof ArrayBuffer) {
			return { kind: 'bytes', bytes: new Uint8Array(value.slice(0)), name: getPdfFileName(name) };
		}
		if (value instanceof Uint8Array) {
			return { kind: 'bytes', bytes: new Uint8Array(value), name: getPdfFileName(name) };
		}
		const blobName = name ?? (value instanceof File ? value.name : undefined);
		return {
			kind: 'bytes',
			bytes: new Uint8Array(await value.arrayBuffer()),
			name: getPdfFileName(blobName)
		};
	}

	// Browser-only: the engine (and PDF.js behind it) loads on the client.
	onMount(() => {
		let cancelled = false;
		(async () => {
			const { createPdfEngine } = await import('../../engines/pdf/index.js');
			if (cancelled) return;
			engine = createPdfEngine();
		})();
		return () => {
			cancelled = true;
			const created = engine;
			engine = null;
			void created?.destroy();
		};
	});

	// Client-only: $effect never runs on the server.
	$effect(() => {
		const value = input;
		const name = upload && value === upload.file ? upload.file.name : fileName;
		const eng = engine;
		if (!eng) return;
		loaded = null;
		pageSizes = [];
		if (!value) {
			status = 'empty';
			numPages = 0;
			editState = { pages: [] };
			selectedIndex = 0;
			return;
		}
		let cancelled = false;
		status = 'loading';
		loadError = '';
		(async () => {
			const source = await resolveSource(value, name);
			if (cancelled) return;
			const count = await eng.load(source.kind === 'url' ? source.url : source.bytes);
			// Unreadable sizes fall back to pageWidth/pageHeight instead of failing the load.
			const sizes = await Promise.resolve()
				.then(() => eng.getPageSizes())
				.catch(() => []);
			if (cancelled) return;
			documentCounter += 1;
			const documentId = `pdf-editor-document-${documentCounter}`;
			loaded = source;
			pageSizes = sizes;
			numPages = count;
			// Each new document starts at defaultZoom, like upstream.
			zoomLevel = defaultZoom;
			editState = createEditState(count);
			selectedIndex = 0;
			status = 'ready';
			onDocumentLoadSuccess?.({ numPages: count, documentId, fileName: source.name });
			reportedPage = 0;
			reportActivePage();
		})().catch((failure: unknown) => {
			if (cancelled) return;
			numPages = 0;
			editState = { pages: [] };
			status = 'error';
			loadError = failure instanceof Error ? failure.message : 'The PDF could not be loaded.';
			onDocumentLoadError?.(loadError);
		});
		return () => {
			cancelled = true;
		};
	});

	// Keep the point at the preview's centre fixed when the previewed page is zoomed
	// or rotated, like upstream's EmbedPDF zoom anchoring.
	const previewSize = $derived.by(() => {
		if (!selectedPage) return null;
		const size = editedSize(selectedPage);
		return { width: size.width * zoom, height: size.height * zoom };
	});
	let lastPreview: { index: number; width: number; height: number } | null = null;
	let pendingPreviewScroll: { x: number; y: number } | null = null;

	$effect.pre(() => {
		const size = previewSize;
		const index = selectedSafeIndex;
		const previous = lastPreview;
		lastPreview = size ? { index, ...size } : null;
		const element = preview;
		if (!element || !size || !previous || previous.index !== index) return;
		if (previous.width === size.width && previous.height === size.height) return;
		// Fractions of the page (inside the 24px padding) under the pane's centre.
		pendingPreviewScroll = {
			x: (element.scrollLeft + element.clientWidth / 2 - PAGE_GAP) / previous.width,
			y: (element.scrollTop + element.clientHeight / 2 - PAGE_GAP) / previous.height
		};
	});

	$effect(() => {
		const size = previewSize;
		const element = preview;
		const target = pendingPreviewScroll;
		pendingPreviewScroll = null;
		if (!element || !size || !target) return;
		element.scrollTop = Math.max(0, PAGE_GAP + target.y * size.height - element.clientHeight / 2);
		element.scrollLeft = Math.max(0, PAGE_GAP + target.x * size.width - element.clientWidth / 2);
	});

	// Measure the preview pane so fit modes follow resizes, like upstream.
	$effect(() => {
		const element = preview;
		if (!element) return;
		const measure = () => {
			previewWidth = element.clientWidth;
			previewHeight = element.clientHeight;
		};
		measure();
		if (typeof ResizeObserver === 'undefined') return;
		const observer = new ResizeObserver(measure);
		observer.observe(element);
		return () => observer.disconnect();
	});

	function applyEdit(next: PdfEditState): void {
		editState = next;
		onPagesChange?.(next.pages);
	}

	function rotateSelected(index: number, direction: 'clockwise' | 'counter-clockwise'): void {
		applyEdit(rotateEditPage(editState, index, direction));
	}

	/** Last page number sent to onActivePageChange; 0 forces the next report. */
	let reportedPage = 0;

	/** Tell the parent whenever the selected page's position changes, however it changed. */
	function reportActivePage(): void {
		if (activePage > 0 && activePage !== reportedPage) {
			reportedPage = activePage;
			onActivePageChange?.(activePage);
		}
	}

	function deleteAt(index: number): void {
		const next = deleteEditPage(editState, index);
		if (next === editState) return;
		// The selection follows its page; deleting the selected page selects the one after it.
		if (index < selectedIndex) selectedIndex -= 1;
		selectedIndex = Math.min(selectedIndex, Math.max(0, next.pages.length - 1));
		applyEdit(next);
		reportActivePage();
	}

	function move(index: number, delta: -1 | 1): void {
		const target = Math.min(Math.max(index + delta, 0), editState.pages.length - 1);
		applyEdit(moveEditPage(editState, index, target));
		// The selection follows its page, including when a neighbour swaps past it.
		if (index === selectedIndex) selectedIndex = target;
		else if (target === selectedIndex) selectedIndex = index;
		reportActivePage();
	}

	function select(index: number): void {
		selectedIndex = index;
		reportActivePage();
	}

	function reset(): void {
		selectedIndex = 0;
		applyEdit(createEditState(numPages));
		reportActivePage();
	}

	/** Upstream's editor shortcuts, for the features this port has. */
	function handleKeyDown(event: KeyboardEvent): void {
		if (!canEdit) return;
		const target = event.target;
		if (
			target instanceof HTMLElement &&
			(target.isContentEditable ||
				target.closest("input, textarea, select, [contenteditable='true'], [contenteditable='']"))
		) {
			if (event.key === 'Escape') target.blur();
			return;
		}
		if (!(event.metaKey || event.ctrlKey)) return;
		const key = event.key;
		if (key === '=' || key === '+') {
			zoomLevel = zoomStepByRange(zoom, 1, MIN_ZOOM, MAX_ZOOM);
		} else if (key === '-') {
			zoomLevel = zoomStepByRange(zoom, -1, MIN_ZOOM, MAX_ZOOM);
		} else if (key === '0') {
			zoomLevel = 'fit-page';
		} else if (key.toLowerCase() === 's' && showDownload) {
			void downloadDocument();
		} else {
			return;
		}
		event.preventDefault();
	}

	function setZoom(value: string): void {
		zoomLevel = isZoomMode(value) ? value : Number(value);
	}

	function handleFileChange(event: Event): void {
		const fileInput = event.currentTarget;
		if (!(fileInput instanceof HTMLInputElement)) return;
		const file = fileInput.files?.[0];
		if (!file) return;
		onPdfUpload?.(file);
		upload = { file, forSrc: src };
		fileInput.value = '';
	}

	async function downloadDocument(): Promise<void> {
		const source = loaded;
		if (!source || exporting || editState.pages.length === 0) return;
		exporting = true;
		exportError = '';
		try {
			let sourceBytes: Uint8Array;
			if (source.kind === 'bytes') {
				sourceBytes = source.bytes;
			} else {
				const response = await fetch(source.url);
				if (!response.ok) {
					throw new Error(`Download failed with status ${response.status}.`);
				}
				sourceBytes = new Uint8Array(await response.arrayBuffer());
			}
			const edited = await exportEditedPdf(sourceBytes, editState);
			const buffer = edited.buffer.slice(
				edited.byteOffset,
				edited.byteOffset + edited.byteLength
			) as ArrayBuffer;
			const name = getPdfFileName(source.name);
			const url = URL.createObjectURL(new Blob([buffer], { type: 'application/pdf' }));
			const anchor = document.createElement('a');
			anchor.href = url;
			anchor.setAttribute('download', name);
			document.body.appendChild(anchor);
			anchor.click();
			anchor.remove();
			URL.revokeObjectURL(url);
			onSave?.({ buffer, fileName: name });
		} catch (failure: unknown) {
			console.error(failure);
			exportError = 'The document could not be saved.';
		} finally {
			exporting = false;
		}
	}
</script>

<!-- Like upstream, shortcuts are scoped to the focused editor (tabindex -1 lets clicks focus it). -->
<!-- svelte-ignore a11y_no_static_element_interactions, a11y_no_noninteractive_tabindex -->
<div
	class={rootClass}
	data-dark={String(isDark)}
	data-testid="pdf-editor"
	tabindex="-1"
	onkeydown={handleKeyDown}
>
	{#if showToolbar}
		<div role="toolbar" aria-label="PDF editor toolbar" class="pdf-editor-toolbar">
			<span class="pdf-editor-indicator" data-testid="pdf-editor-page-indicator">
				Page {editState.pages.length ? activePage : 1} of {editState.pages.length || '–'}
			</span>
			<span class="pdf-editor-separator" aria-hidden="true"></span>
			<button
				type="button"
				class="pdf-editor-button"
				aria-label="Zoom out"
				disabled={!canEdit || zoom <= MIN_ZOOM}
				onclick={() => (zoomLevel = zoomStepByRange(zoom, -1, MIN_ZOOM, MAX_ZOOM))}
			>
				&minus;
			</button>
			<span class="pdf-editor-zoom">
				<select
					class="pdf-editor-zoom-select"
					aria-label="Zoom level"
					value={zoomSelectValue(zoomLevel, zoom)}
					disabled={!canEdit}
					onchange={(event) => setZoom(event.currentTarget.value)}
				>
					{#each ZOOM_MODES as mode (mode.value)}
						<option value={mode.value}>{mode.label}</option>
					{/each}
					{#each zoomSelectOptions(zoom, ZOOM_PRESETS) as option (option)}
						<option value={String(option)}>{formatZoomPercent(option)}</option>
					{/each}
				</select>
				<!-- Upstream's trigger always shows the current percentage, even in a fit mode. -->
				<span class="pdf-editor-zoom-value" data-testid="pdf-editor-zoom-label" aria-hidden="true">
					{formatZoomPercent(zoom)}
				</span>
			</span>
			<button
				type="button"
				class="pdf-editor-button"
				aria-label="Zoom in"
				disabled={!canEdit || zoom >= MAX_ZOOM}
				onclick={() => (zoomLevel = zoomStepByRange(zoom, 1, MIN_ZOOM, MAX_ZOOM))}
			>
				+
			</button>
			<span class="pdf-editor-separator" aria-hidden="true"></span>
			{#if showDownload}
				<button
					type="button"
					class="pdf-editor-button pdf-editor-export"
					aria-label="Download"
					disabled={!canEdit || editState.pages.length === 0 || exporting}
					onclick={() => void downloadDocument()}
				>
					{exporting ? 'Downloading…' : 'Download'}
				</button>
			{/if}
			<button
				type="button"
				class="pdf-editor-button"
				aria-label="Reset edits"
				disabled={!canEdit}
				onclick={reset}
			>
				Reset
			</button>
			{#if showUpload}
				<label class="pdf-editor-button pdf-editor-upload">
					Upload
					<input
						type="file"
						accept="application/pdf,.pdf"
						aria-label="Upload PDF"
						class="pdf-editor-file-input"
						onchange={handleFileChange}
					/>
				</label>
			{/if}
		</div>
	{/if}

	{#if status === 'loading'}
		<div class="pdf-editor-state" role="status">Loading PDF…</div>
	{:else if status === 'error'}
		<div class="pdf-editor-state pdf-editor-error" role="alert">
			{loadError || 'The PDF could not be loaded.'}
		</div>
	{:else if status === 'empty'}
		<div class="pdf-editor-state">
			<p class="pdf-editor-state-title">Upload a PDF to edit</p>
			<p class="pdf-editor-state-hint">
				Pass a PDF URL or bytes with the <code>src</code> prop or use the upload control.
			</p>
		</div>
	{:else}
		{#if exportError}
			<div class="pdf-editor-state pdf-editor-error" role="alert">{exportError}</div>
		{/if}
		<div class="pdf-editor-body" style={`height: ${height}px;`}>
			<div
				class="pdf-editor-sidebar"
				data-testid="pdf-editor-page-list"
				role="listbox"
				aria-label="Document pages"
			>
				<VirtualList items={editState.pages} itemHeight={ROW_HEIGHT} height={height}>
					{#snippet children(page, index)}
						{@const thumbScale = thumbnailScale(page)}
						{@const thumbSize = editedSize(page)}
						<div
							class={`pdf-editor-entry${index === selectedSafeIndex ? ' selected' : ''}`}
							data-testid="pdf-editor-page"
							data-source-page={page.sourcePage}
							data-rotation={page.rotation}
							role="option"
							aria-selected={index === selectedSafeIndex}
						>
							<button
								type="button"
								class="pdf-editor-select"
								aria-label={`Select page ${page.sourcePage}`}
								onclick={() => select(index)}
							>
								{#if engine}
									<PdfPage
										engine={engine}
										pageNumber={page.sourcePage}
										scale={thumbScale}
										rotation={page.rotation}
										width={thumbSize.width * thumbScale}
										height={thumbSize.height * thumbScale}
									/>
								{/if}
								<span class="pdf-editor-entry-label">
									Page {index + 1}
									{#if page.rotation !== 0}
										<span class="pdf-editor-rotation-badge">{page.rotation}°</span>
									{/if}
								</span>
							</button>
							<div class="pdf-editor-entry-controls">
								<button
									type="button"
									class="pdf-editor-icon-button"
									aria-label={`Rotate page ${page.sourcePage} counter-clockwise`}
									onclick={() => rotateSelected(index, 'counter-clockwise')}
								>
									&#10226;
								</button>
								<button
									type="button"
									class="pdf-editor-icon-button"
									aria-label={`Rotate page ${page.sourcePage} clockwise`}
									onclick={() => rotateSelected(index, 'clockwise')}
								>
									&#10227;
								</button>
								<button
									type="button"
									class="pdf-editor-icon-button"
									aria-label={`Move page ${page.sourcePage} up`}
									disabled={index === 0}
									onclick={() => move(index, -1)}
								>
									&#8593;
								</button>
								<button
									type="button"
									class="pdf-editor-icon-button"
									aria-label={`Move page ${page.sourcePage} down`}
									disabled={index === editState.pages.length - 1}
									onclick={() => move(index, 1)}
								>
									&#8595;
								</button>
								<button
									type="button"
									class="pdf-editor-icon-button pdf-editor-delete"
									aria-label={`Delete page ${page.sourcePage}`}
									onclick={() => deleteAt(index)}
								>
									&#10005;
								</button>
							</div>
						</div>
					{/snippet}
				</VirtualList>
			</div>
			<div class="pdf-editor-preview" data-testid="pdf-editor-preview" bind:this={preview}>
				{#if selectedPage && engine}
					{@const size = editedSize(selectedPage)}
					<PdfPage
						engine={engine}
						pageNumber={selectedPage.sourcePage}
						scale={zoom}
						rotation={selectedPage.rotation}
						width={size.width * zoom}
						height={size.height * zoom}
					/>
				{:else}
					<div class="pdf-editor-state">
						<p class="pdf-editor-state-title">No pages left</p>
						<p class="pdf-editor-state-hint">Reset the edits to restore the document.</p>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	.pdf-editor {
		--pdf-editor-bg: #ffffff;
		--pdf-editor-fg: #171717;
		--pdf-editor-muted: #525252;
		--pdf-editor-border: #e5e5e5;
		--pdf-editor-canvas-bg: #f5f5f5;
		--pdf-editor-accent: #2563eb;
		display: flex;
		flex-direction: column;
		width: 100%;
		min-width: 0;
		overflow: hidden;
		background: var(--pdf-editor-bg);
		color: var(--pdf-editor-fg);
		border: 1px solid var(--pdf-editor-border);
		border-radius: 0.75rem;
		font-family:
			system-ui,
			-apple-system,
			'Segoe UI',
			sans-serif;
		font-size: 13px;
	}

	.pdf-editor:focus {
		outline: none;
	}

	.pdf-editor.dark {
		--pdf-editor-bg: #0a0a0a;
		--pdf-editor-fg: #e5e5e5;
		--pdf-editor-muted: #a3a3a3;
		--pdf-editor-border: #262626;
		--pdf-editor-canvas-bg: #171717;
		--pdf-editor-accent: #60a5fa;
	}

	.pdf-editor-toolbar {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.5rem 0.75rem;
		border-bottom: 1px solid var(--pdf-editor-border);
		flex-wrap: wrap;
	}

	.pdf-editor-button {
		flex: none;
		padding: 0.375rem 0.625rem;
		border: 1px solid var(--pdf-editor-border);
		border-radius: 0.375rem;
		background: transparent;
		color: var(--pdf-editor-fg);
		font: inherit;
		cursor: pointer;
		line-height: 1.25;
	}

	.pdf-editor-button:disabled {
		opacity: 0.45;
		cursor: default;
	}

	.pdf-editor-export {
		border-color: var(--pdf-editor-accent);
		color: var(--pdf-editor-accent);
		font-weight: 600;
	}

	.pdf-editor-indicator {
		white-space: nowrap;
		color: var(--pdf-editor-muted);
		font-size: 12px;
		padding: 0 0.25rem;
	}

	.pdf-editor-separator {
		width: 1px;
		align-self: stretch;
		margin: 0.125rem 0.25rem;
		background: var(--pdf-editor-border);
	}

	.pdf-editor-upload {
		cursor: pointer;
	}

	.pdf-editor-file-input {
		position: absolute;
		width: 1px;
		height: 1px;
		opacity: 0;
		overflow: hidden;
		clip: rect(0 0 0 0);
	}

	.pdf-editor-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 2.5rem 1rem;
		color: var(--pdf-editor-muted);
		text-align: center;
	}

	.pdf-editor-state-title {
		margin: 0;
		font-weight: 600;
		color: var(--pdf-editor-fg);
	}

	.pdf-editor-state-hint {
		margin: 0;
		font-size: 12px;
	}

	.pdf-editor-error {
		color: #b91c1c;
	}

	.pdf-editor-body {
		display: flex;
		min-height: 0;
	}

	.pdf-editor-sidebar {
		flex: none;
		width: 13rem;
		border-right: 1px solid var(--pdf-editor-border);
		background: var(--pdf-editor-canvas-bg);
		overflow: hidden;
	}

	.pdf-editor-entry {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
		height: 100%;
		padding: 0.5rem;
		box-sizing: border-box;
	}

	.pdf-editor-entry.selected .pdf-editor-select {
		outline: 2px solid var(--pdf-editor-accent);
		outline-offset: 2px;
	}

	.pdf-editor-select {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
		padding: 0.25rem;
		border: none;
		border-radius: 0.375rem;
		background: transparent;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}

	.pdf-editor-entry-label {
		font-size: 12px;
		color: var(--pdf-editor-muted);
	}

	.pdf-editor-rotation-badge {
		margin-left: 0.25rem;
		padding: 0 0.25rem;
		border-radius: 0.25rem;
		background: var(--pdf-editor-accent);
		color: #ffffff;
		font-size: 11px;
	}

	.pdf-editor-entry-controls {
		display: flex;
		gap: 0.25rem;
	}

	.pdf-editor-icon-button {
		padding: 0.125rem 0.375rem;
		border: 1px solid var(--pdf-editor-border);
		border-radius: 0.375rem;
		background: var(--pdf-editor-bg);
		color: var(--pdf-editor-fg);
		font: inherit;
		font-size: 12px;
		cursor: pointer;
		line-height: 1.25;
	}

	.pdf-editor-icon-button:disabled {
		opacity: 0.45;
		cursor: default;
	}

	.pdf-editor-delete {
		color: #b91c1c;
	}

	.pdf-editor-preview {
		flex: 1;
		min-width: 0;
		display: flex;
		justify-content: safe center;
		align-items: flex-start;
		overflow: auto;
		/* Matches upstream's 24px viewport gap, which the fit modes subtract. */
		padding: 24px;
		box-sizing: border-box;
		background: var(--pdf-editor-canvas-bg);
		/* Fit modes size pages from this width, so wide pages must not widen it. */
		contain: inline-size;
	}

	.pdf-editor-zoom {
		position: relative;
		display: inline-flex;
	}

	/* The select keeps the native list; its own text is hidden under the percentage. */
	.pdf-editor-zoom-select {
		width: 104px;
		padding: 0.375rem 0.5rem;
		border: 1px solid var(--pdf-editor-border);
		border-radius: 0.375rem;
		background: transparent;
		color: transparent;
		font: inherit;
		cursor: pointer;
	}

	.pdf-editor-zoom-select:disabled {
		opacity: 0.45;
		cursor: default;
	}

	.pdf-editor-zoom-select option {
		color: var(--pdf-editor-fg);
		background: var(--pdf-editor-bg);
	}

	.pdf-editor-zoom-value {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		padding: 0 0.625rem;
		pointer-events: none;
		color: var(--pdf-editor-fg);
	}

	.pdf-editor-zoom-select:disabled + .pdf-editor-zoom-value {
		opacity: 0.45;
	}
</style>
