<!--
	MIT License — Svelte 5 port of Extend UI pdf-editor. Upstream: extend-hq/ui (MIT).
	Deliberate changes vs the React PDFEditor:
	- The upstream editor is built on the React-only @embedpdf plugin stack
	  (annotations, forms, redaction, signatures, search); this port covers
	  document-level edits only: per-page rotate, delete, reorder, and export.
	- Rendering runs on the shared PDF.js engine wrapper (#lib/engines/pdf)
	  and export runs on pdf-lib, both loaded on the client.
	- Dark mode is parent-controlled (isDark + onIsDarkChange) per project contract.
	- `onDocumentLoadSuccess` reports the page count as a number, matching the
	  local PdfViewer instead of the upstream info object.
	- `class` replaces React's `className`, matching the other Svelte ports.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { VirtualList } from '#lib/virtual-list/index.js';
	import type { PdfEngine } from '#lib/engines/pdf/index.js';
	import PdfPage from '#lib/components/pdf-viewer/PdfPage.svelte';
	import {
		formatZoomPercent,
		getPdfDownloadFileName,
		resolveInitialZoom,
		zoomStepIn,
		zoomStepOut,
		type PdfViewerZoomLevel
	} from '#lib/components/pdf-viewer/zoom.js';
	import {
		createEditState,
		deleteEditPage,
		exportEditedPdf,
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

	export interface PdfEditorProps {
		/** PDF URL to load. Empty renders the upload prompt. */
		src?: string;
		/** Download file name (without the .pdf extension is fine). */
		fileName?: string;
		/** Initial preview zoom; fit modes start at 1. */
		defaultZoom?: PdfEditorZoomLevel;
		/** Show the toolbar. */
		showToolbar?: boolean;
		/** Show the export/download button. */
		showDownload?: boolean;
		/** Show the upload control. */
		showUpload?: boolean;
		/** Called with the page count once the document loads. */
		onDocumentLoadSuccess?: (numPages: number) => void;
		/** Called with the failure message when the document fails to load. */
		onDocumentLoadError?: (message: string) => void;
		/** Called when the selected (active) page changes. */
		onActivePageChange?: (pageNumber: number) => void;
		/** Called with the edited page list after every edit operation. */
		onPagesChange?: (pages: EditedPdfPage[]) => void;
		/** Called with the exported bytes and file name after export. */
		onSave?: (result: PdfEditorSaveResult) => void;
		/** Called with the file chosen through the upload control. */
		onPdfUpload?: (file: File) => void;
		/** Parent-controlled dark mode flag. */
		isDark?: boolean;
		/** Called when the user toggles dark mode. */
		onIsDarkChange?: (isDark: boolean) => void;
		/** Body height in px. */
		height?: number;
		/** Preview page CSS width in px at zoom 1. */
		pageWidth?: number;
		/** Preview page CSS height in px at zoom 1. */
		pageHeight?: number;
		class?: string;
	}

	const THUMBNAIL_WIDTH = 96;
	const THUMBNAIL_HEIGHT = 124;
	const ROW_HEIGHT = 208;

	let {
		src,
		fileName,
		defaultZoom = 1,
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
		onIsDarkChange,
		height = 600,
		pageWidth = 612,
		pageHeight = 792,
		class: className = ''
	}: PdfEditorProps = $props();

	type LoadStatus = 'empty' | 'loading' | 'ready' | 'error';

	function initialStatus(source: string | undefined): LoadStatus {
		return source ? 'loading' : 'empty';
	}

	let engine: PdfEngine | null = $state.raw(null);
	// svelte-ignore state_referenced_locally: `src` intentionally seeds the initial status only.
	let status: LoadStatus = $state(initialStatus(src));
	let loadError = $state('');
	let numPages = $state(0);
	let editState: PdfEditState = $state({ pages: [] });
	let selectedIndex = $state(0);
	// svelte-ignore state_referenced_locally: `defaultZoom` is intentionally uncontrolled after mount.
	let zoom = $state(resolveInitialZoom(defaultZoom));
	let uploadUrl: string | null = $state(null);
	let exporting = $state(false);
	let exportError = $state('');

	const effectiveSrc = $derived(uploadUrl ?? src);
	const canEdit = $derived(status === 'ready');
	const selectedSafeIndex = $derived(
		editState.pages.length === 0 ? -1 : Math.min(selectedIndex, editState.pages.length - 1)
	);
	const activePage = $derived(selectedSafeIndex < 0 ? 0 : selectedSafeIndex + 1);
	const selectedPage = $derived(
		selectedSafeIndex < 0 ? null : editState.pages[selectedSafeIndex]
	);

	// Browser-only: the engine (and PDF.js behind it) loads on the client.
	onMount(() => {
		let cancelled = false;
		(async () => {
			const { createPdfEngine } = await import('#lib/engines/pdf/index.js');
			if (cancelled) return;
			engine = createPdfEngine();
		})();
		return () => {
			cancelled = true;
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
			editState = { pages: [] };
			selectedIndex = 0;
			return;
		}
		let cancelled = false;
		status = 'loading';
		loadError = '';
		eng.load(source).then(
			(count) => {
				if (cancelled) return;
				numPages = count;
				editState = createEditState(count);
				selectedIndex = 0;
				status = 'ready';
				onDocumentLoadSuccess?.(count);
				if (count > 0) onActivePageChange?.(1);
			},
			(failure: unknown) => {
				if (cancelled) return;
				numPages = 0;
				editState = { pages: [] };
				status = 'error';
				loadError =
					failure instanceof Error ? failure.message : 'Unable to load the PDF document.';
				onDocumentLoadError?.(loadError);
			}
		);
		return () => {
			cancelled = true;
		};
	});

	function applyEdit(next: PdfEditState): void {
		editState = next;
		onPagesChange?.(next.pages);
	}

	function rotateSelected(index: number, direction: 'clockwise' | 'counter-clockwise'): void {
		applyEdit(rotateEditPage(editState, index, direction));
	}

	function deleteAt(index: number): void {
		const next = deleteEditPage(editState, index);
		if (next === editState) return;
		if (selectedIndex >= next.pages.length) {
			selectedIndex = Math.max(0, next.pages.length - 1);
		}
		applyEdit(next);
	}

	function move(index: number, delta: -1 | 1): void {
		applyEdit(moveEditPage(editState, index, index + delta));
		if (index === selectedIndex) {
			const target = Math.min(Math.max(index + delta, 0), editState.pages.length - 1);
			selectedIndex = target;
		}
	}

	function select(index: number): void {
		if (index === selectedIndex) return;
		selectedIndex = index;
		onActivePageChange?.(index + 1);
	}

	function reset(): void {
		selectedIndex = 0;
		applyEdit(createEditState(numPages));
		onActivePageChange?.(1);
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

	async function exportDocument(): Promise<void> {
		const source = effectiveSrc;
		if (!source || exporting || editState.pages.length === 0) return;
		exporting = true;
		exportError = '';
		try {
			const response = await fetch(source);
			if (!response.ok) {
				throw new Error(`Export failed with status ${response.status}.`);
			}
			const sourceBytes = new Uint8Array(await response.arrayBuffer());
			const edited = await exportEditedPdf(sourceBytes, editState);
			const buffer = edited.buffer.slice(
				edited.byteOffset,
				edited.byteOffset + edited.byteLength
			) as ArrayBuffer;
			const name = getPdfDownloadFileName(fileName, src ?? source);
			onSave?.({ buffer, fileName: name });
			const url = URL.createObjectURL(new Blob([buffer], { type: 'application/pdf' }));
			const anchor = document.createElement('a');
			anchor.href = url;
			anchor.setAttribute('download', name);
			document.body.appendChild(anchor);
			anchor.click();
			anchor.remove();
			URL.revokeObjectURL(url);
		} catch (failure: unknown) {
			exportError = failure instanceof Error ? failure.message : 'Export failed.';
		} finally {
			exporting = false;
		}
	}
</script>

<div
	class={`pdf-editor${isDark ? ' dark' : ''}${className ? ` ${className}` : ''}`}
	data-dark={String(isDark)}
	data-testid="pdf-editor"
>
	{#if showToolbar}
		<div role="toolbar" aria-label="PDF editor toolbar" class="pdf-editor-toolbar">
			<span class="pdf-editor-indicator" data-testid="pdf-editor-page-indicator">
				Page {activePage} of {editState.pages.length}
			</span>
			<span class="pdf-editor-separator" aria-hidden="true"></span>
			<button
				type="button"
				class="pdf-editor-button"
				aria-label="Zoom out"
				disabled={!canEdit}
				onclick={() => (zoom = zoomStepOut(zoom))}
			>
				&minus;
			</button>
			<span class="pdf-editor-indicator" data-testid="pdf-editor-zoom-label">
				{formatZoomPercent(zoom)}
			</span>
			<button
				type="button"
				class="pdf-editor-button"
				aria-label="Zoom in"
				disabled={!canEdit}
				onclick={() => (zoom = zoomStepIn(zoom))}
			>
				+
			</button>
			{#if showDownload}
				<button
					type="button"
					class="pdf-editor-button pdf-editor-export"
					aria-label="Export edited PDF"
					disabled={!canEdit || editState.pages.length === 0 || exporting}
					onclick={() => void exportDocument()}
				>
					{exporting ? 'Exporting…' : 'Export'}
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
			<button
				type="button"
				class="pdf-editor-button pdf-editor-theme-toggle"
				role="switch"
				aria-checked={isDark}
				aria-label="Toggle dark mode"
				onclick={() => onIsDarkChange?.(!isDark)}
			>
				{isDark ? 'Light' : 'Dark'}
			</button>
		</div>
	{/if}

	{#if status === 'loading'}
		<div class="pdf-editor-state" role="status">Loading PDF…</div>
	{:else if status === 'error'}
		<div class="pdf-editor-state pdf-editor-error" role="alert">
			{loadError || 'Unable to load the PDF document.'}
		</div>
	{:else if !effectiveSrc}
		<div class="pdf-editor-state">
			<p class="pdf-editor-state-title">Upload a PDF to edit</p>
			<p class="pdf-editor-state-hint">
				Pass a PDF URL with the <code>src</code> prop or use the upload control.
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
										scale={THUMBNAIL_WIDTH / 612}
										rotation={page.rotation}
										width={THUMBNAIL_WIDTH}
										height={THUMBNAIL_HEIGHT}
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
			<div class="pdf-editor-preview" data-testid="pdf-editor-preview">
				{#if selectedPage && engine}
					<PdfPage
						engine={engine}
						pageNumber={selectedPage.sourcePage}
						scale={zoom}
						rotation={selectedPage.rotation}
						width={pageWidth * zoom}
						height={pageHeight * zoom}
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
		display: flex;
		justify-content: center;
		align-items: flex-start;
		overflow: auto;
		padding: 1rem;
		background: var(--pdf-editor-canvas-bg);
	}
</style>
