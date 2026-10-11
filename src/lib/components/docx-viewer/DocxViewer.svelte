<!--
	MIT License — Svelte 5 port of Extend UI docx-viewer. Upstream: extend-hq/ui (MIT).
	Ported from apps/v4/components/extend/docx-viewer.tsx (DocxViewerPreview).

	Deliberate changes vs the React version:
	- Also exported as the upstream name DocxViewerPreview; `className` is an
	  alias of `class`.
	- Rendering is delegated to the docx engine wrapper (docx-preview) instead
	  of @extend-ai/react-docx, which is React-only; comments, tracked changes,
	  outline anchors, and canvas thumbnails are out of scope for this port.
	  Legacy .doc uploads are accepted but docx-preview cannot render them.
	- docx-preview builds every page's DOM; pages away from the viewport skip
	  layout and paint through content-visibility: auto instead of upstream's
	  windowed page rendering.
	- The page number is editable like upstream; Previous/Next buttons are a
	  port addition.
	- The thumbnail sidebar lists page numbers with text excerpts and is
	  virtualized with the shared VirtualList instead of tanstack virtual; it
	  stays inline instead of collapsing to an overlay on narrow widths.
	- The engine keeps only http(s), mailto, tel, and #anchor link targets and
	  strips scripts, frames, objects, embeds, and on* attributes.
	- toolbarActions is a Snippet instead of a React node.
	- Zoom is a CSS zoom on the rendered document. defaultZoom matches upstream
	  (number | 'fit-page' | 'fit-width' | 'automatic', default 50); the fit
	  modes are resolved here from the first page's size and the viewport
	  ('automatic' fits the width but never enlarges past 100%).
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

	/** Toolbar zoom when the parent passes no defaultZoom, matching upstream. */
	export const DEFAULT_ZOOM = 50;

	/** Zoom levels accepted by defaultZoom and the zoom select, matching upstream. */
	export type DocxViewerZoomLevel = number | 'fit-page' | 'fit-width' | 'automatic';

	export const ZOOM_MODE_LABELS = {
		'fit-page': 'Fit page',
		'fit-width': 'Fit width',
		automatic: 'Automatic'
	} as const;

	export interface DocxZoomMetrics {
		viewportWidth: number;
		viewportHeight: number;
		pageWidth: number;
		pageHeight: number;
	}

	/**
	 * Resolves a zoom level to a percentage. Fit modes need a measured page and
	 * viewport; returns null until both have a size.
	 */
	export function resolveZoomLevel(
		level: DocxViewerZoomLevel,
		metrics: DocxZoomMetrics
	): number | null {
		if (typeof level === 'number') return level;
		const { viewportWidth, viewportHeight, pageWidth, pageHeight } = metrics;
		if (!(pageWidth > 0) || !(viewportWidth > 0)) return null;
		const fitWidth = (viewportWidth / pageWidth) * 100;
		if (level === 'fit-width') return fitWidth;
		if (level === 'automatic') return Math.min(fitWidth, 100);
		if (!(pageHeight > 0) || !(viewportHeight > 0)) return null;
		return Math.min(fitWidth, (viewportHeight / pageHeight) * 100);
	}

	/**
	 * The page with the most visible height between viewportTop and
	 * viewportBottom (rendered, zoomed coordinates); the earlier page wins ties.
	 * Null when no page is visible.
	 */
	export function findMostVisiblePage(
		viewportTop: number,
		viewportBottom: number,
		pages: { pageNumber: number; top: number; bottom: number }[]
	): number | null {
		let best: number | null = null;
		let bestVisible = 0;
		for (const page of pages) {
			const visible = Math.min(page.bottom, viewportBottom) - Math.max(page.top, viewportTop);
			if (visible > bestVisible) {
				best = page.pageNumber;
				bestVisible = visible;
			}
		}
		return best;
	}

	function isZoomMode(value: string): value is keyof typeof ZOOM_MODE_LABELS {
		return value in ZOOM_MODE_LABELS;
	}

	/** Fixed sidebar row height in px; shared with tests for scroll math. */
	export const THUMBNAIL_ITEM_HEIGHT = 72;

	/** Height of the virtualized thumbnail rail in px. */
	const THUMBNAIL_RAIL_HEIGHT = 384;

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
	import { onMount, tick, untrack } from 'svelte';
	import type { Snippet } from 'svelte';
	import { VirtualList } from '../../virtual-list/index.js';
	import type { DocxSource } from '../../engines/docx/index.js';

	type EngineModule = typeof import('../../engines/docx/index.js');
	type Status = 'idle' | 'loading' | 'ready' | 'error';

	interface Props {
		/** DOCX URL to render. Matches the upstream `src` prop. */
		src?: string;
		/** Display name used for the toolbar and downloads. */
		fileName?: string;
		/** Parent-controlled dark mode flag. Required, like upstream. */
		isDark: boolean;
		/** Called when the user toggles dark mode in the toolbar. Required, like upstream. */
		onIsDarkChange: (isDark: boolean) => void;
		/** Show the toolbar (sidebar toggle, pages, zoom, actions). */
		showToolbar?: boolean;
		/** Show the download button. */
		showDownload?: boolean;
		/** Show the upload button and file input. */
		showUpload?: boolean;
		/** Initial zoom: a percentage or a fit mode. Defaults to 50, like upstream. */
		defaultZoom?: DocxViewerZoomLevel;
		class?: string;
		/** Alias of `class`, matching the upstream React prop. */
		className?: string;
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
		class: classProp = '',
		className = '',
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
	// Selected level (number or fit mode) and the resolved percentage it maps to.
	let zoomLevel = $state<DocxViewerZoomLevel>(untrack(() => defaultZoom));
	let zoom = $state(untrack(() => (typeof defaultZoom === 'number' ? defaultZoom : DEFAULT_ZOOM)));
	// Like upstream, an upload applies only while `src` is unchanged; a new src wins.
	let upload = $state.raw<{ file: File; sourceUrl: string | undefined } | null>(null);
	const uploadedFile = $derived(upload && upload.sourceUrl === src ? upload.file : null);
	let generation = 0;

	const currentSource = $derived<DocxSource | undefined>(uploadedFile ?? src);
	const pageCount = $derived(pages.length);
	const displayPage = $derived(pageCount ? activePage : 1);
	let editingPage = $state(false);
	let pageDraft = $state('1');

	/** Upstream page-number input: whole numbers jump (clamped); anything else is ignored. */
	function applyPageDraft(value: string): void {
		const trimmed = value.trim();
		if (!trimmed) return;
		const parsed = Number(trimmed);
		if (!Number.isInteger(parsed)) return;
		selectPage(parsed);
	}
	const displayFileName = $derived(
		uploadedFile?.name ?? (src ? formatDocumentName(fileName, src) : (fileName ?? 'document.docx'))
	);
	const rootClass = $derived(
		['docx-viewer', isDark && 'dark', classProp, className].filter(Boolean).join(' ')
	);
	const zoomOptions = $derived.by(() => {
		const rounded = Number(zoom.toFixed(2));
		return (ZOOM_OPTIONS as readonly number[]).includes(rounded)
			? [...ZOOM_OPTIONS]
			: [...ZOOM_OPTIONS, rounded].sort((left, right) => left - right);
	});
	const canZoomIn = $derived(zoom < ZOOM_OPTIONS[ZOOM_OPTIONS.length - 1]);
	const canZoomOut = $derived(zoom > ZOOM_OPTIONS[0]);

	// Client-only engine load: docx-preview touches canvas and layout, so the
	// wrapper is loaded with a dynamic import() inside onMount, never at the
	// top level. Importing this component stays DOM-free.
	onMount(() => {
		let cancelled = false;
		import('../../engines/docx/index.js').then(
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
			// Invalidate any render still in flight so it cannot land after the clear.
			generation += 1;
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
		// Like upstream, a load shows only the loading surface: the previous
		// document and its pages are gone until the new one is ready.
		pages = [];
		activePage = 1;
		// Last call wins down to the DOM (upstream's isCurrent import queue): each
		// load renders into its own detached element, and only the newest load's
		// output is moved into the visible container.
		const staging = document.createElement('div');
		loaded.renderDocx(source, staging, { showThumbnails: sidebarFlag }).then(
			() => {
				if (id !== generation) return;
				element.replaceChildren(...Array.from(staging.childNodes));
				pages = collectPages(element);
				activePage = 1;
				status = 'ready';
				// Like upstream, every new document starts at defaultZoom. Fit modes
				// measure the page, so they wait until the container is shown.
				const level = untrack(() => defaultZoom);
				setZoomLevel(level);
				if (typeof level !== 'number') {
					void tick().then(() => {
						if (id === generation) fitZoom();
					});
				}
			},
			(failure: unknown) => {
				if (id !== generation) return;
				loaded.clearDocx(element);
				pages = [];
				status = 'error';
				errorMessage = failure instanceof Error ? failure.message : String(failure);
			}
		);
	});

	// Fit modes follow the viewport size.
	$effect(() => {
		const viewport = viewportEl;
		if (!viewport || typeof ResizeObserver === 'undefined') return;
		const observer = new ResizeObserver(() => fitZoom());
		observer.observe(viewport);
		return () => observer.disconnect();
	});

	function setZoomLevel(level: DocxViewerZoomLevel): void {
		zoomLevel = level;
		if (typeof level === 'number') zoom = level;
		else fitZoom();
	}

	/** Re-resolves a fit mode from the first page's natural size and the viewport. */
	function fitZoom(): void {
		const level = zoomLevel;
		const viewport = viewportEl;
		const page = containerEl?.querySelector<HTMLElement>('[data-docx-page]');
		if (typeof level === 'number' || !viewport || !page) return;
		const px = (value: string) => Number.parseFloat(value) || 0;
		const outer = getComputedStyle(viewport);
		// docx-preview pads the page wrapper; the padding zooms with the page.
		const wrapper = page.parentElement ? getComputedStyle(page.parentElement) : null;
		const resolved = resolveZoomLevel(level, {
			viewportWidth: viewport.clientWidth - px(outer.paddingLeft) - px(outer.paddingRight),
			viewportHeight: viewport.clientHeight - px(outer.paddingTop) - px(outer.paddingBottom),
			// offsetWidth/offsetHeight are unaffected by the CSS zoom on the container.
			pageWidth:
				page.offsetWidth + px(wrapper?.paddingLeft ?? '') + px(wrapper?.paddingRight ?? ''),
			pageHeight:
				page.offsetHeight + px(wrapper?.paddingTop ?? '') + px(wrapper?.paddingBottom ?? '')
		});
		if (resolved !== null) zoom = resolved;
	}

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

	const listboxId = $props.id();
	let thumbnailListEl = $state<HTMLDivElement | null>(null);

	/** Upstream thumbnail keys: ArrowUp/ArrowDown step, Home/End jump to the ends. */
	function handleThumbnailKeydown(event: KeyboardEvent): void {
		if (pageCount < 1) return;
		const next =
			event.key === 'ArrowDown'
				? Math.min(pageCount, activePage + 1)
				: event.key === 'ArrowUp'
					? Math.max(1, activePage - 1)
					: event.key === 'Home'
						? 1
						: event.key === 'End'
							? pageCount
							: null;
		if (next === null) return;
		event.preventDefault();
		selectPage(next);
	}

	// Like upstream's scrollToIndex(align: auto): keep the active thumbnail in view.
	$effect(() => {
		const rail = thumbnailListEl?.querySelector<HTMLElement>('[data-testid="virtual-viewport"]');
		if (!rail || !sidebarOpen) return;
		const top = (activePage - 1) * THUMBNAIL_ITEM_HEIGHT;
		const bottom = top + THUMBNAIL_ITEM_HEIGHT;
		const viewHeight = rail.clientHeight || THUMBNAIL_RAIL_HEIGHT;
		let next = rail.scrollTop;
		if (top < next) next = top;
		else if (bottom > next + viewHeight) next = bottom - viewHeight;
		if (next === rail.scrollTop) return;
		rail.scrollTop = next;
		// The virtual list windows on scroll events; jsdom never fires one for this.
		rail.dispatchEvent(new Event('scroll'));
	});

	// A page jump in progress: its scroll event keeps that page active even when
	// the page cannot reach the top (the last pages), instead of re-deriving it.
	let pendingPage: number | null = null;
	let pendingLanding: number | null = null;

	// Positions come from getBoundingClientRect, which includes the CSS zoom;
	// offsetTop does not, so it cannot be compared with scrollTop.
	function selectPage(pageNumber: number): void {
		const clamped = Math.min(Math.max(1, Math.round(pageNumber)), Math.max(1, pageCount));
		activePage = clamped;
		const viewport = viewportEl;
		const target = containerEl?.querySelector<HTMLElement>(`[data-docx-page="${clamped}"]`);
		if (!viewport?.scrollTo) return;
		const top = target
			? viewport.scrollTop +
				target.getBoundingClientRect().top -
				viewport.getBoundingClientRect().top
			: 0;
		pendingPage = clamped;
		pendingLanding = null;
		viewport.scrollTo({ top });
		if (pendingPage !== null) pendingLanding = viewport.scrollTop;
	}

	function handleViewportScroll(): void {
		const viewport = viewportEl;
		const element = containerEl;
		if (!viewport || !element || pages.length === 0) return;
		if (pendingPage !== null) {
			const ours = pendingLanding === null || Math.abs(viewport.scrollTop - pendingLanding) < 2;
			const page = pendingPage;
			pendingPage = null;
			pendingLanding = null;
			if (ours) {
				activePage = page;
				return;
			}
		}
		const bounds = viewport.getBoundingClientRect();
		const current = findMostVisiblePage(
			bounds.top,
			bounds.top + viewport.clientHeight,
			Array.from(element.querySelectorAll<HTMLElement>('[data-docx-page]')).map((section) => {
				const rect = section.getBoundingClientRect();
				return { pageNumber: Number(section.dataset.docxPage), top: rect.top, bottom: rect.bottom };
			})
		);
		if (current !== null) activePage = current;
	}

	function handleUpload(event: Event): void {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0] ?? null;
		input.value = '';
		if (!file) return;
		upload = { file, sourceUrl: src };
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

	let preparingDownload = $state(false);

	// Like upstream: a URL source is fetched and saved as a blob, so the
	// download name holds even for cross-origin files.
	async function handleDownload(): Promise<void> {
		const name = ensureDocxExtension(displayFileName);
		if (uploadedFile) {
			downloadBlob(uploadedFile, name);
			return;
		}
		if (!src || preparingDownload) return;
		preparingDownload = true;
		try {
			const response = await fetch(src);
			if (!response.ok) throw new Error(`Failed to download DOCX (${response.status})`);
			downloadBlob(await response.blob(), name);
		} catch (error) {
			console.error(error);
		} finally {
			preparingDownload = false;
		}
	}
</script>

<div
	class={rootClass}
	data-dark={String(isDark)}
	data-testid="docx-viewer"
>
	<!-- Always mounted, like upstream: the empty-state button uses it even when showUpload is off. -->
	<input
		type="file"
		data-testid="docx-file-input"
		accept={DOCX_UPLOAD_ACCEPT}
		hidden
		bind:this={fileInputEl}
		onchange={handleUpload}
	/>
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
				<span class="docx-page-control" data-testid="docx-page-indicator">
					Page
					{#if editingPage}
						<input
							class="docx-page-input"
							type="text"
							aria-label="Page number"
							inputmode="numeric"
							pattern="[0-9]*"
							value={pageDraft}
							{@attach (node: HTMLInputElement) => {
								node.focus();
								node.select();
							}}
							onblur={() => (editingPage = false)}
							oninput={(event) => {
								pageDraft = event.currentTarget.value;
								applyPageDraft(pageDraft);
							}}
							onkeydown={(event) => {
								if (event.key === 'Enter' || event.key === 'Escape') event.currentTarget.blur();
							}}
						/>
					{:else}
						<button
							type="button"
							class="docx-page-button"
							aria-label={`Current page ${displayPage}. Edit page number`}
							disabled={status !== 'ready' || !pageCount}
							onclick={() => {
								pageDraft = String(displayPage);
								editingPage = true;
							}}
						>
							{displayPage}
						</button>
					{/if}
					of {pageCount || '-'}
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
					onclick={() => setZoomLevel(stepZoom(zoom, -1))}
				>
					−
				</button>
				<select
					aria-label="Zoom level"
					disabled={status !== 'ready'}
					value={String(zoomLevel)}
					onchange={(event) => {
						const value = event.currentTarget.value;
						setZoomLevel(isZoomMode(value) ? value : Number(value));
					}}
				>
					{#each Object.entries(ZOOM_MODE_LABELS) as [value, label] (value)}
						<option {value}>{label}</option>
					{/each}
					{#each zoomOptions as value (value)}
						<option value={String(value)}>{value}%</option>
					{/each}
				</select>
				<span data-testid="docx-zoom-level">{Math.round(zoom)}%</span>
				<button
					type="button"
					aria-label="Zoom in"
					disabled={status !== 'ready' || !canZoomIn}
					onclick={() => setZoomLevel(stepZoom(zoom, 1))}
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
						disabled={!currentSource || preparingDownload}
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
					disabled={status !== 'ready'}
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
					<!-- Upstream focus model: the listbox takes focus and points at the
					     active page through aria-activedescendant; options are not tab stops. -->
					<div
						bind:this={thumbnailListEl}
						class="docx-thumbnail-list"
						role="listbox"
						tabindex="0"
						aria-label="DOCX pages"
						aria-activedescendant={`${listboxId}-page-${activePage}`}
						onkeydown={handleThumbnailKeydown}
						onmousedown={(event) => event.currentTarget.focus({ preventScroll: true })}
					>
						<VirtualList tabindex={null} items={pages} itemHeight={THUMBNAIL_ITEM_HEIGHT} height={THUMBNAIL_RAIL_HEIGHT}>
							{#snippet children(page, index)}
								<!-- svelte-ignore a11y_click_events_have_key_events, a11y_interactive_supports_focus -->
								<div
									id={`${listboxId}-page-${page.pageNumber}`}
									role="option"
									aria-current={page.pageNumber === activePage ? 'page' : undefined}
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
								</div>
							{/snippet}
						</VirtualList>
					</div>
				{/if}
			</aside>
		{/if}

		<!-- svelte-ignore a11y_no_noninteractive_tabindex (Scrollable regions need a keyboard focus target.) -->
		<div
			class="docx-viewport"
			data-testid="docx-viewport"
			role="group"
			aria-label="Document pages"
			tabindex="0"
			bind:this={viewportEl}
			onscroll={handleViewportScroll}
		>
			{#if !currentSource}
				<div class="docx-state">
					<p class="docx-state-title">Upload a Word document to preview</p>
					<p class="docx-state-hint">
						Pass a DOCX URL with the <code>src</code> prop or upload a file.
					</p>
					<p class="docx-state-hint">
						Legacy <code>.doc</code> files cannot be rendered here; convert them to DOCX.
					</p>
					<button type="button" onclick={() => fileInputEl?.click()}>
						Upload Word document
					</button>
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
				hidden={status !== 'ready'}
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

	.docx-toolbar button,
	.docx-toolbar select {
		padding: 0.25rem 0.5rem;
		border: 1px solid var(--docx-border);
		border-radius: 0.375rem;
		background: transparent;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}

	.docx-toolbar button:disabled,
	.docx-toolbar select:disabled {
		opacity: 0.45;
		cursor: default;
	}

	.docx-page-control {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		white-space: nowrap;
	}

	.docx-page-input {
		width: 3.5rem;
		padding: 0.25rem;
		border: 1px solid var(--docx-border);
		border-radius: 0.375rem;
		background: var(--docx-bg);
		color: inherit;
		font: inherit;
		text-align: center;
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

	.docx-thumbnail-list:focus-visible {
		outline: none;
	}

	.docx-thumbnail-list:focus-visible .docx-thumbnail[data-active='true'] {
		outline: 2px solid var(--docx-fg);
		outline-offset: 1px;
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
		/* Zoomed pages scroll here instead of widening the viewer and its parents. */
		contain: inline-size;
	}

	.docx-document {
		display: flex;
		justify-content: center;
	}

	/* display: flex would otherwise override the hidden attribute. */
	.docx-document[hidden] {
		display: none;
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

	/* Page virtualization (upstream pageVirtualization): docx-preview builds every
	   page, so pages away from the viewport skip layout and paint. The intrinsic
	   size (US Letter until a page has rendered once) keeps the scroll height. */
	.docx-viewer :global(.docx-wrapper > section) {
		content-visibility: auto;
		contain-intrinsic-size: auto 816px auto 1056px;
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

	[data-testid="docx-viewport"]:focus-visible {
		outline: 2px solid currentColor;
		outline-offset: -2px;
	}
</style>
