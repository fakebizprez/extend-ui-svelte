<!--
	MIT License — Svelte 5 port of Extend UI docx-viewer. Upstream: extend-hq/ui (MIT).
	Ported from apps/v4/components/extend/docx-viewer.tsx (DocxViewerPreview).

	Deliberate changes vs the React version:
	- Rendering is delegated to the docx engine wrapper (docx-preview) instead
	  of @extend-ai/react-docx, which is React-only; comments, tracked changes,
	  and canvas thumbnails are out of scope for this port.
	- The thumbnail sidebar lists page numbers with text excerpts and is
	  virtualized with the shared VirtualList instead of tanstack virtual.
	- Zoom is a CSS zoom on the rendered document (defaultZoom, default 100)
	  instead of the editor's zoom modes (fit-page/fit-width/automatic).
	- Dark mode stays parent-controlled (isDark + onIsDarkChange) per the
	  repo contract; the night render is CSS overrides on docx-preview output.
-->
<script module lang="ts">
	/** One rendered page: its number and a text excerpt for the sidebar. */
	export interface DocxViewerPage {
		pageNumber: number;
		excerpt: string;
	}

	/** Zoom steps offered by the toolbar, in percent. */
	export const ZOOM_OPTIONS = [50, 75, 100, 125, 150, 175, 200] as const;

	/** Toolbar zoom when the parent passes no defaultZoom. */
	export const DEFAULT_ZOOM = 100;

	/** Fixed sidebar row height in px; shared with tests for scroll math. */
	export const THUMBNAIL_ITEM_HEIGHT = 72;

	export const DOCX_MIME_TYPE =
		'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

	export const DOCX_UPLOAD_ACCEPT = [
		'.doc',
		'.docx',
		'application/msword',
		DOCX_MIME_TYPE
	].join(',');

	/** Prefers an explicit fileName, else the last URL path segment. */
	export function formatDocumentName(fileName: string | undefined, url: string): string {
		if (fileName?.trim()) return fileName;
		const rawName = url.split('?')[0]?.split('/').pop() ?? 'document.docx';
		try {
			return decodeURIComponent(rawName);
		} catch {
			return rawName;
		}
	}

	/** Appends .docx unless the name already ends with it. */
	export function ensureDocxExtension(fileName: string): string {
		return fileName.toLowerCase().endsWith('.docx') ? fileName : `${fileName}.docx`;
	}

	/** Nearest zoom step at or above/below the current value. */
	export function stepZoom(current: number, direction: 1 | -1): number {
		if (direction > 0) {
			return ZOOM_OPTIONS.find((value) => value > current) ?? current;
		}
		for (let index = ZOOM_OPTIONS.length - 1; index >= 0; index -= 1) {
			const value = ZOOM_OPTIONS[index];
			if (value < current) return value;
		}
		return current;
	}
</script>

<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import type { Snippet } from 'svelte';
	import { VirtualList } from '#lib/virtual-list/index.js';
	import type { DocxSource } from '#lib/engines/docx/index.js';

	type EngineModule = typeof import('#lib/engines/docx/index.js');
	type Status = 'idle' | 'loading' | 'ready' | 'error';

	interface Props {
		/** DOCX URL to render. Matches the upstream `src` prop. */
		src?: string;
		/** Display name used for the toolbar and downloads. */
		fileName?: string;
		/** Parent-controlled dark mode flag. */
		isDark?: boolean;
		/** Called when the user toggles dark mode in the toolbar. */
		onIsDarkChange?: (isDark: boolean) => void;
		/** Show the toolbar (sidebar toggle, pages, zoom, actions). */
		showToolbar?: boolean;
		/** Show the download button. */
		showDownload?: boolean;
		/** Show the upload button and file input. */
		showUpload?: boolean;
		/** Initial zoom in percent. */
		defaultZoom?: number;
		class?: string;
		/** Extra toolbar content, matching the upstream `toolbarActions` prop. */
		toolbarActions?: Snippet;
	}

	let {
		src,
		fileName,
		isDark = false,
		onIsDarkChange,
		showToolbar = true,
		showDownload = true,
		showUpload = true,
		defaultZoom = DEFAULT_ZOOM,
		class: className = '',
		toolbarActions
	}: Props = $props();

	let engine = $state<EngineModule | null>(null);
	let engineError = $state('');
	let containerEl = $state<HTMLDivElement | null>(null);
	let viewportEl = $state<HTMLDivElement | null>(null);
	let fileInputEl = $state<HTMLInputElement | null>(null);
	let status = $state<Status>('idle');
	let errorMessage = $state('');
	let pages = $state.raw<DocxViewerPage[]>([]);
	let activePage = $state(1);
	let sidebarOpen = $state(false);
	let zoom = $state(defaultZoom);
	let uploadedFile = $state.raw<File | null>(null);
	let generation = 0;

	const currentSource = $derived<DocxSource | undefined>(uploadedFile ?? src);
	const pageCount = $derived(pages.length);
	const displayFileName = $derived(
		uploadedFile?.name ?? (src ? formatDocumentName(fileName, src) : (fileName ?? 'document.docx'))
	);
	const canZoomIn = $derived(zoom < ZOOM_OPTIONS[ZOOM_OPTIONS.length - 1]);
	const canZoomOut = $derived(zoom > ZOOM_OPTIONS[0]);

	// Client-only engine load: docx-preview touches canvas and layout, so the
	// wrapper is loaded with a dynamic import() inside onMount, never at the
	// top level. Importing this component stays DOM-free.
	onMount(() => {
		let cancelled = false;
		import('#lib/engines/docx/index.js').then(
			(loaded) => {
				if (!cancelled) engine = loaded;
			},
			(failure: unknown) => {
				if (cancelled) return;
				engineError = failure instanceof Error ? failure.message : String(failure);
			}
		);
		return () => {
			cancelled = true;
			generation += 1;
			const loaded = engine;
			const element = containerEl;
			if (loaded && element) {
				try {
					loaded.clearDocx(element);
				} catch {
					// Clearing is best-effort during teardown.
				}
			}
		};
	});

	// Renders whenever the engine becomes ready or the source changes. Reads
	// sidebarOpen untracked: toggling the sidebar must not re-render the doc.
	$effect(() => {
		const loaded = engine;
		const loadError = engineError;
		const element = containerEl;
		const source = uploadedFile ?? src;
		if (!source) {
			if (loaded && element) loaded.clearDocx(element);
			pages = [];
			activePage = 1;
			status = 'idle';
			errorMessage = '';
			return;
		}
		if (!loaded || !element) {
			if (loadError) {
				status = 'error';
				errorMessage = loadError;
			} else {
				status = 'loading';
			}
			return;
		}
		const id = (generation += 1);
		const sidebarFlag = untrack(() => sidebarOpen);
		status = 'loading';
		errorMessage = '';
		loaded.renderDocx(source, element, { showThumbnails: sidebarFlag }).then(
			() => {
				if (id !== generation) return;
				pages = collectPages(element);
				activePage = 1;
				status = 'ready';
			},
			(failure: unknown) => {
				if (id !== generation) return;
				pages = [];
				status = 'error';
				errorMessage = failure instanceof Error ? failure.message : String(failure);
			}
		);
	});

	/** Reads docx-preview sections back as sidebar pages with text excerpts. */
	function collectPages(element: HTMLElement): DocxViewerPage[] {
		let sections = Array.from(element.querySelectorAll('.docx-wrapper > section'));
		if (sections.length === 0) {
			sections = Array.from(element.querySelectorAll('section'));
		}
		if (sections.length === 0) {
			const text = (element.textContent ?? '').trim();
			if (!text) return [];
			element.setAttribute('data-docx-page', '1');
			return [{ pageNumber: 1, excerpt: text.slice(0, 80) }];
		}
		return sections.map((section, index) => {
			const pageNumber = index + 1;
			(section as HTMLElement).setAttribute('data-docx-page', String(pageNumber));
			const text = (section.textContent ?? '').trim().replace(/\s+/g, ' ');
			return { pageNumber, excerpt: text.slice(0, 80) || `Page ${pageNumber}` };
		});
	}

	function selectPage(pageNumber: number): void {
		const clamped = Math.min(Math.max(1, Math.round(pageNumber)), Math.max(1, pageCount));
		activePage = clamped;
		const target = containerEl?.querySelector(`[data-docx-page="${clamped}"]`);
		if (target) {
			target.scrollIntoView?.({ block: 'start' });
		} else {
			viewportEl?.scrollTo?.({ top: 0 });
		}
	}

	function handleViewportScroll(): void {
		const viewport = viewportEl;
		const element = containerEl;
		if (!viewport || !element || pages.length === 0) return;
		const top = viewport.scrollTop;
		let current = 1;
		for (const section of Array.from(element.querySelectorAll('[data-docx-page]'))) {
			const pageNumber = Number((section as HTMLElement).dataset.docxPage);
			if (!Number.isFinite(pageNumber)) continue;
			if ((section as HTMLElement).offsetTop <= top + 24) current = pageNumber;
			else break;
		}
		activePage = current;
	}

	function handleUpload(event: Event): void {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0] ?? null;
		input.value = '';
		if (!file) return;
		uploadedFile = file;
		activePage = 1;
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

	function handleDownload(): void {
		const name = ensureDocxExtension(displayFileName);
		if (uploadedFile) {
			downloadBlob(uploadedFile, name);
			return;
		}
		if (!src) return;
		const anchor = document.createElement('a');
		anchor.href = src;
		anchor.download = name;
		anchor.rel = 'noopener';
		document.body.append(anchor);
		anchor.click();
		anchor.remove();
	}
</script>

<div
	class={`docx-viewer${isDark ? ' dark' : ''}${className ? ` ${className}` : ''}`}
	data-dark={String(isDark)}
	data-testid="docx-viewer"
>
	{#if showUpload}
		<input
			type="file"
			data-testid="docx-file-input"
			accept={DOCX_UPLOAD_ACCEPT}
			hidden
			bind:this={fileInputEl}
			onchange={handleUpload}
		/>
	{/if}
	{#if showToolbar}
		<div class="docx-toolbar" data-testid="docx-toolbar">
			<div class="docx-toolbar-group">
				<button
					type="button"
					aria-label="Toggle thumbnails"
					disabled={status !== 'ready'}
					onclick={() => (sidebarOpen = !sidebarOpen)}
				>
					Thumbnails
				</button>
				<button
					type="button"
					aria-label="Previous page"
					disabled={status !== 'ready' || activePage <= 1}
					onclick={() => selectPage(activePage - 1)}
				>
					‹
				</button>
				<span data-testid="docx-page-indicator">
					Page {pageCount ? activePage : 1} of {pageCount || '-'}
				</span>
				<button
					type="button"
					aria-label="Next page"
					disabled={status !== 'ready' || activePage >= pageCount}
					onclick={() => selectPage(activePage + 1)}
				>
					›
				</button>
			</div>
			<div class="docx-toolbar-group">
				<button
					type="button"
					aria-label="Zoom out"
					disabled={status !== 'ready' || !canZoomOut}
					onclick={() => (zoom = stepZoom(zoom, -1))}
				>
					−
				</button>
				<span data-testid="docx-zoom-level">{zoom}%</span>
				<button
					type="button"
					aria-label="Zoom in"
					disabled={status !== 'ready' || !canZoomIn}
					onclick={() => (zoom = stepZoom(zoom, 1))}
				>
					+
				</button>
				{#if toolbarActions}
					{@render toolbarActions()}
				{/if}
				{#if showUpload}
					<button type="button" aria-label="Upload" onclick={() => fileInputEl?.click()}>
						Upload
					</button>
				{/if}
				{#if showDownload}
					<button
						type="button"
						aria-label="Download"
						disabled={!currentSource}
						onclick={handleDownload}
					>
						Download
					</button>
				{/if}
				<button
					type="button"
					role="switch"
					aria-checked={isDark}
					aria-label="Toggle dark mode"
					onclick={() => onIsDarkChange?.(!isDark)}
				>
					{isDark ? 'Light' : 'Dark'}
				</button>
			</div>
		</div>
	{/if}

	<div class="docx-body">
		{#if sidebarOpen}
			<aside class="docx-sidebar" data-testid="docx-thumbnails" aria-label="DOCX thumbnails">
				{#if pages.length === 0}
					<p class="docx-state">No pages to preview.</p>
				{:else}
					<div role="listbox" aria-label="DOCX pages">
						<VirtualList items={pages} itemHeight={THUMBNAIL_ITEM_HEIGHT} height={384}>
							{#snippet children(page, index)}
								<button
									type="button"
									role="option"
									aria-selected={page.pageNumber === activePage}
									aria-label={`Page ${page.pageNumber}`}
									aria-posinset={page.pageNumber}
									aria-setsize={pageCount}
									data-testid={`docx-thumbnail-${page.pageNumber}`}
									data-active={page.pageNumber === activePage ? 'true' : 'false'}
									class="docx-thumbnail"
									onclick={() => selectPage(page.pageNumber)}
								>
									<span class="docx-thumbnail-page">{index + 1}</span>
									<span class="docx-thumbnail-excerpt">{page.excerpt}</span>
								</button>
							{/snippet}
						</VirtualList>
					</div>
				{/if}
			</aside>
		{/if}

		<div
			class="docx-viewport"
			data-testid="docx-viewport"
			bind:this={viewportEl}
			onscroll={handleViewportScroll}
		>
			{#if !currentSource}
				<div class="docx-state">
					<p class="docx-state-title">Upload a Word document to preview</p>
					<p class="docx-state-hint">
						Pass a DOCX URL with the <code>src</code> prop or upload a file.
					</p>
					{#if showUpload}
						<button type="button" onclick={() => fileInputEl?.click()}>
							Upload Word document
						</button>
					{/if}
				</div>
			{:else if status === 'error'}
				<div class="docx-state" role="alert" data-testid="docx-error">
					<p class="docx-state-title">Unable to display DOCX</p>
					{#if errorMessage}
						<p class="docx-state-hint">{errorMessage}</p>
					{/if}
				</div>
			{:else if status === 'loading'}
				<div class="docx-state" role="status">Loading document…</div>
			{/if}
			<!-- Always mounted: unmounting the container on state changes would
			     rebind containerEl, retrigger the render effect, and loop. -->
			<div
				class="docx-document"
				data-testid="docx-container"
				style={`zoom: ${zoom}%;`}
				hidden={!currentSource || status === 'error'}
				bind:this={containerEl}
			></div>
		</div>
	</div>
</div>

<style>
	.docx-viewer {
		--docx-bg: #ffffff;
		--docx-fg: #171717;
		--docx-muted: #525252;
		--docx-border: #e5e5e5;
		--docx-shell: #f5f5f5;
		display: flex;
		flex-direction: column;
		height: 640px;
		min-height: 0;
		overflow: hidden;
		background: var(--docx-bg);
		color: var(--docx-fg);
		border: 1px solid var(--docx-border);
		border-radius: 0.75rem;
		font-family:
			system-ui,
			-apple-system,
			'Segoe UI',
			sans-serif;
		font-size: 13px;
	}

	.docx-viewer.dark {
		--docx-bg: #0a0a0a;
		--docx-fg: #e5e5e5;
		--docx-muted: #a3a3a3;
		--docx-border: #262626;
		--docx-shell: #111111;
	}

	.docx-toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		border-bottom: 1px solid var(--docx-border);
	}

	.docx-toolbar-group {
		display: flex;
		align-items: center;
		gap: 0.375rem;
	}

	.docx-toolbar button {
		padding: 0.25rem 0.5rem;
		border: 1px solid var(--docx-border);
		border-radius: 0.375rem;
		background: transparent;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}

	.docx-toolbar button:disabled {
		opacity: 0.45;
		cursor: default;
	}

	.docx-body {
		display: flex;
		min-height: 0;
		flex: 1;
	}

	.docx-sidebar {
		flex: 0 0 13rem;
		min-height: 0;
		overflow: hidden;
		border-right: 1px solid var(--docx-border);
		background: var(--docx-shell);
		padding: 0.5rem;
	}

	.docx-thumbnail {
		display: flex;
		gap: 0.5rem;
		align-items: flex-start;
		width: 100%;
		height: 100%;
		padding: 0.5rem;
		border: 1px solid transparent;
		border-radius: 0.5rem;
		background: transparent;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
		overflow: hidden;
	}

	.docx-thumbnail[data-active='true'] {
		border-color: var(--docx-border);
		background: var(--docx-bg);
	}

	.docx-thumbnail-page {
		flex: none;
		font-weight: 600;
	}

	.docx-thumbnail-excerpt {
		overflow: hidden;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		color: var(--docx-muted);
	}

	.docx-viewport {
		flex: 1;
		min-width: 0;
		min-height: 0;
		overflow: auto;
		background: var(--docx-shell);
		padding: 1.5rem 1rem;
	}

	.docx-document {
		display: flex;
		justify-content: center;
	}

	.docx-state {
		display: grid;
		place-items: center;
		align-content: center;
		gap: 0.25rem;
		min-height: 200px;
		padding: 1rem;
		text-align: center;
	}

	.docx-state-title {
		margin: 0;
		font-weight: 600;
	}

	.docx-state-hint {
		margin: 0;
		color: var(--docx-muted);
	}

	/* docx-preview injects its page styles into the head; these overrides keep
	   the rendered pages readable when the parent enables dark mode. */
	.docx-viewer.dark :global(.docx-wrapper) {
		background: transparent !important;
	}

	.docx-viewer.dark :global(.docx-wrapper > section.docx) {
		background: #171717 !important;
		color: #e5e5e5 !important;
		box-shadow: 0 0 10px rgba(0, 0, 0, 0.8) !important;
	}
</style>
