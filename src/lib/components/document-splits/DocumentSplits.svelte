<!--
	MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
	Ported from apps/v4/components/extend/document-splits.tsx.

	Deliberate changes from the React version:
	- dnd-kit is replaced with native HTML5 drag-and-drop (no DnD library):
	  page thumbnails and split handles are `draggable`, drops reorder pages
	  within a group, move pages across groups, and reorder the groups.
	- Every drag operation also has a button control (move up/down/left/right,
	  move to previous/next split) so reordering works by keyboard and in
	  automated tests where native drag events are impractical.
	- `class` is accepted alongside the upstream `className`. splits,
	  activePage, onSelectPage, and onSplitsChange are required as in the
	  upstream API table. Like upstream, splits are controlled: the component
	  renders only what the parent passes and reports edits to onSplitsChange.
	  Mutations are pure helpers in ./splits.js.
	- New operations upstream inlines or lacks: rename via a title input,
	  `Split <title> in two` (midpoint cut), and an `activePage` highlight
	  (0 for none; upstream documents the prop but never renders it).
	- Page thumbnails reuse FileThumbnail; pass `thumbnailImages` for cached
	  data URLs exactly like upstream, or `pdfUrl` to render real PDF pages.
	  Like upstream's lazy PDF page thumbnails, the document loads once per
	  `pdfUrl` and each page renders to an image only when it scrolls near the
	  viewport (IntersectionObserver; all pages render where it is missing).
	- Dark mode follows the repo-wide contract (isDark + onIsDarkChange);
	  this component renders no theme switcher, so it reflects `isDark` and
	  never invokes the callback.
-->
<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import {
		FileThumbnail,
		renderLoadedPdfThumbnail
	} from '../file-thumbnail/index.js';
	import type { PdfEngine } from '../../engines/pdf/index.js';
	import { resolveIsDark } from '../../dark-mode.js';
	import {
		addSplit,
		areSplitGroupsEqual,
		createPageRangeLabel,
		findGroupId,
		getGroupPages,
		getPageNumber,
		movePage,
		movePageToAdjacentGroup,
		movePageToGroup,
		removeSplit,
		renameSplit,
		reorderPageInGroup,
		reorderSplits,
		splitGroup,
		type DocumentSplit,
		type DocumentSplitPageId
	} from './splits.js';

	interface Props {
		/** Split groups. Required and controlled, like upstream. */
		splits: DocumentSplit[];
		/** 1-based page number highlighted as active (0 for none). Required, like upstream's docs. */
		activePage: number;
		/** Cached page images by page id, e.g. `{ 'page-1': 'data:...' }`. */
		thumbnailImages?: Record<DocumentSplitPageId, string>;
		/** PDF URL rendered into each page thumbnail via FileThumbnail. */
		pdfUrl?: string | null;
		/** Whether the frame divider border is shown. Defaults to `true`. */
		withFrameDivider?: boolean;
		className?: string;
		/** Alias of the upstream `className`. */
		class?: string;
		/** Called with the 1-based page number when a page is selected. Required, like upstream. */
		onSelectPage: (pageNumber: number) => void;
		/** Called with the next splits after every mutation. Required, like upstream. */
		onSplitsChange: (splits: DocumentSplit[]) => void;
		isDark?: boolean;
		/** Accepted for contract parity; the component renders no theme switch, so it is never called. */
		onIsDarkChange?: (isDark: boolean) => void;
	}

	let {
		splits,
		activePage,
		thumbnailImages = {},
		pdfUrl = null,
		withFrameDivider = true,
		className,
		class: classProp,
		onSelectPage,
		onSplitsChange,
		isDark = false
	}: Props = $props();

	const dark = $derived(resolveIsDark(isDark));

	type DragPayload =
		| { type: 'page'; pageId: DocumentSplitPageId }
		| { type: 'split'; splitId: string };

	const PAGE_MIME = 'application/x-document-split-page';
	const SPLIT_MIME = 'application/x-document-split';

	let dragPayload = $state<DragPayload | null>(null);
	let dropTargetPage = $state<DocumentSplitPageId | null>(null);
	let dropTargetGroup = $state<string | null>(null);

	function commit(next: DocumentSplit[]): void {
		// Controlled, like upstream: the parent decides whether the edit lands.
		if (areSplitGroupsEqual(splits, next)) return;
		onSplitsChange?.(next);
	}

	function clearDragState(): void {
		dragPayload = null;
		dropTargetPage = null;
		dropTargetGroup = null;
	}

	function setDragData(event: DragEvent, mime: string, value: string): void {
		const transfer = event.dataTransfer;
		if (!transfer) return;
		try {
			transfer.setData(mime, value);
			transfer.effectAllowed = 'move';
		} catch {
			// jsdom and other non-drag environments: component state carries the payload.
		}
	}

	function hasDragData(event: DragEvent, mime: string): boolean {
		return event.dataTransfer?.types.includes(mime) ?? false;
	}

	function draggedPageId(event: DragEvent): DocumentSplitPageId | null {
		if (dragPayload?.type === 'page') return dragPayload.pageId;
		const raw = event.dataTransfer?.getData(PAGE_MIME);
		return raw?.startsWith('page-') ? (raw as DocumentSplitPageId) : null;
	}

	function draggedSplitId(event: DragEvent): string | null {
		if (dragPayload?.type === 'split') return dragPayload.splitId;
		const raw = event.dataTransfer?.getData(SPLIT_MIME);
		return raw ? raw : null;
	}

	function onPageDragStart(event: DragEvent, pageId: DocumentSplitPageId): void {
		dragPayload = { type: 'page', pageId };
		dropTargetGroup = null;
		setDragData(event, PAGE_MIME, pageId);
	}

	function onPageDragOver(event: DragEvent, pageId: DocumentSplitPageId): void {
		if (dragPayload?.type !== 'page' && !hasDragData(event, PAGE_MIME)) return;
		event.preventDefault();
		dropTargetPage = pageId;
	}

	// Split drags fall through to the group's drop handler, so only page drags stop here.
	function onPageDrop(event: DragEvent, targetPageId: DocumentSplitPageId): void {
		const dragged = draggedPageId(event);
		if (!dragged) return;
		event.preventDefault();
		event.stopPropagation();
		clearDragState();
		if (dragged === targetPageId) return;

		const sourceGroupId = findGroupId(splits, dragged);
		const targetGroupId = findGroupId(splits, targetPageId);
		if (!sourceGroupId || !targetGroupId) return;

		if (sourceGroupId === targetGroupId) {
			commit(
				reorderPageInGroup({ draggedPageId: dragged, groups: splits, overPageId: targetPageId })
			);
			return;
		}

		const targetPages = getGroupPages(splits, targetGroupId);
		const overIndex = targetPages.indexOf(targetPageId);
		commit(
			movePageToGroup({
				draggedPageId: dragged,
				groups: splits,
				insertIndex: overIndex === -1 ? targetPages.length : overIndex,
				targetGroupId
			})
		);
	}

	function onDropzoneDragOver(event: DragEvent, groupId: string): void {
		if (dragPayload?.type !== 'page' && !hasDragData(event, PAGE_MIME)) return;
		event.preventDefault();
		dropTargetGroup = groupId;
	}

	function onDropzoneDrop(event: DragEvent, groupId: string): void {
		const dragged = draggedPageId(event);
		if (!dragged) return;
		event.preventDefault();
		event.stopPropagation();
		clearDragState();

		const sourceGroupId = findGroupId(splits, dragged);
		if (!sourceGroupId) return;
		const targetPages = getGroupPages(splits, groupId);

		if (sourceGroupId === groupId) {
			if (targetPages.at(-1) === dragged) return;
			commit(
				movePageToGroup({
					draggedPageId: dragged,
					groups: splits,
					insertIndex: targetPages.length - 1,
					targetGroupId: groupId
				})
			);
			return;
		}

		commit(
			movePageToGroup({
				draggedPageId: dragged,
				groups: splits,
				insertIndex: targetPages.length,
				targetGroupId: groupId
			})
		);
	}

	function onSplitDragStart(event: DragEvent, splitId: string): void {
		dragPayload = { type: 'split', splitId };
		setDragData(event, SPLIT_MIME, splitId);
	}

	function onGroupDragOver(event: DragEvent, groupId: string): void {
		if (dragPayload?.type !== 'split' && !hasDragData(event, SPLIT_MIME)) return;
		event.preventDefault();
		dropTargetGroup = groupId;
	}

	function onGroupDrop(event: DragEvent, groupId: string): void {
		event.preventDefault();
		const dragged = draggedSplitId(event);
		clearDragState();
		if (!dragged || dragged === groupId) return;

		const fromIndex = splits.findIndex((group) => group.id === dragged);
		const toIndex = splits.findIndex((group) => group.id === groupId);
		if (fromIndex === -1 || toIndex === -1) return;
		commit(reorderSplits(splits, fromIndex, toIndex));
	}

	function moveSplit(groupId: string, direction: -1 | 1): void {
		const fromIndex = splits.findIndex((group) => group.id === groupId);
		if (fromIndex === -1) return;
		commit(reorderSplits(splits, fromIndex, fromIndex + direction));
	}

	// Page thumbnail box, matching upstream THUMBNAIL_WIDTH / THUMBNAIL_HEIGHT.
	const THUMBNAIL_WIDTH = 72;
	const THUMBNAIL_HEIGHT = 92;

	// Page images rendered from pdfUrl; null marks a page that failed to render.
	let pdfImages = $state<Partial<Record<DocumentSplitPageId, string | null>>>({});
	let pdfDocument: Promise<{ engine: PdfEngine; pageCount: number }> | null = null;
	let pdfRun = 0;
	// Pages render one at a time, in the order they scroll into view.
	let renderQueue: Promise<void> = Promise.resolve();
	const requestedPages = new Set<DocumentSplitPageId>();
	const visiblePages = new Set<DocumentSplitPageId>();
	const observedPages = new Map<Element, DocumentSplitPageId>();
	let pageObserver: IntersectionObserver | null = null;

	function requestPageImage(pageId: DocumentSplitPageId): void {
		const documentPromise = pdfDocument;
		if (!documentPromise || thumbnailImages[pageId] || requestedPages.has(pageId)) return;
		requestedPages.add(pageId);
		const run = pdfRun;
		renderQueue = renderQueue.then(async () => {
			if (run !== pdfRun) return;
			try {
				const { engine, pageCount } = await documentPromise;
				const pageNumber = getPageNumber(pageId);
				if (pageNumber > pageCount) throw new RangeError(`No page ${pageNumber}`);
				if (run !== pdfRun) return;
				const canvas = document.createElement('canvas');
				await renderLoadedPdfThumbnail(engine, pageCount, canvas, {
					pageNumber,
					width: THUMBNAIL_WIDTH,
					dpr: window.devicePixelRatio || 1
				});
				if (run !== pdfRun) return;
				pdfImages = { ...pdfImages, [pageId]: canvas.toDataURL() };
			} catch {
				if (run === pdfRun) pdfImages = { ...pdfImages, [pageId]: null };
			}
		});
	}

	// Load the document once per pdfUrl; every page thumbnail shares it.
	$effect(() => {
		const url = pdfUrl;
		pdfImages = {};
		requestedPages.clear();
		if (!url) return;
		// Browser-only: the engine (and PDF.js behind it) loads on the client.
		const loading = import('../../engines/pdf/index.js').then(async (module) => {
			const engine = module.createPdfEngine();
			return { engine, pageCount: await engine.load(url) };
		});
		pdfDocument = loading;
		// Pages already near the viewport will not report again; render them now.
		untrack(() => visiblePages.forEach(requestPageImage));
		return () => {
			pdfRun += 1;
			pdfDocument = null;
			void loading.then(
				({ engine }) => engine.destroy(),
				() => undefined
			);
		};
	});

	function observePage(node: HTMLElement, pageId: DocumentSplitPageId) {
		if (typeof IntersectionObserver === 'undefined') {
			visiblePages.add(pageId);
			requestPageImage(pageId);
			return;
		}
		pageObserver ??= new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					const id = observedPages.get(entry.target);
					if (!id) continue;
					if (entry.isIntersecting) {
						visiblePages.add(id);
						requestPageImage(id);
					} else {
						visiblePages.delete(id);
					}
				}
			},
			{ rootMargin: '200px' }
		);
		observedPages.set(node, pageId);
		pageObserver.observe(node);
		return {
			destroy() {
				observedPages.delete(node);
				visiblePages.delete(pageId);
				pageObserver?.unobserve(node);
			}
		};
	}

	onMount(() => () => pageObserver?.disconnect());
</script>

<aside
	data-testid="document-splits"
	data-dark={dark ? 'true' : 'false'}
	data-frame-divider={withFrameDivider ? 'true' : 'false'}
	class={['document-splits', classProp, className]}
	class:dark
	class:with-frame-divider={withFrameDivider}
>
	<div class="splits-header">
		<button
			type="button"
			class="add-split"
			aria-label="Add split"
			onclick={() => commit(addSplit(splits))}
		>
			<span aria-hidden="true">+</span> Add split
		</button>
	</div>
	<div class="splits-list">
		{#each splits as group, groupIndex (group.id)}
			{@const isFirstGroup = groupIndex === 0}
			{@const isLastGroup = groupIndex === splits.length - 1}
			<section
				data-testid="split-group"
				data-split-id={group.id}
				data-drop-target={dropTargetGroup === group.id ? 'true' : 'false'}
				aria-label={group.title}
				class="split-group"
				ondragover={(event) => onGroupDragOver(event, group.id)}
				ondrop={(event) => onGroupDrop(event, group.id)}
			>
				<div class="split-group-header">
					<button
						type="button"
						class="drag-handle"
						draggable="true"
						aria-label={`Reorder ${group.title}`}
						title="Drag to reorder"
						ondragstart={(event) => onSplitDragStart(event, group.id)}
						ondragend={clearDragState}
					>
						⠿
					</button>
					<div class="split-group-titles">
						<label class="split-title-label">
							<span class="visually-hidden">Split title</span>
							<input
								type="text"
								class="split-title-input"
								value={group.title}
								oninput={(event) =>
									commit(renameSplit(splits, group.id, event.currentTarget.value))}
							/>
						</label>
						<div class="split-range">{createPageRangeLabel(group.pages)}</div>
					</div>
					<div class="split-group-actions">
						<span class="split-count">
							{group.pages.length}<span class="visually-hidden">{' pages'}</span>
						</span>
						<button
							type="button"
							aria-label={`Move ${group.title} up`}
							title="Move split up"
							disabled={isFirstGroup}
							onclick={() => moveSplit(group.id, -1)}
						>
							↑
						</button>
						<button
							type="button"
							aria-label={`Move ${group.title} down`}
							title="Move split down"
							disabled={isLastGroup}
							onclick={() => moveSplit(group.id, 1)}
						>
							↓
						</button>
						<button
							type="button"
							aria-label={`Split ${group.title} in two`}
							title="Split into two at the midpoint"
							disabled={group.pages.length < 2}
							onclick={() => commit(splitGroup(splits, group.id))}
						>
							Split
						</button>
						<button
							type="button"
							aria-label={`Remove ${group.title}`}
							title="Remove split"
							disabled={splits.length <= 1}
							onclick={() => commit(removeSplit(splits, group.id))}
						>
							Remove
						</button>
					</div>
				</div>
				<div
					data-testid="split-dropzone"
					data-drop-target={dropTargetGroup === group.id ? 'true' : 'false'}
					class="split-dropzone"
					role="group"
					aria-label={`Pages of ${group.title}`}
					ondragover={(event) => onDropzoneDragOver(event, group.id)}
					ondrop={(event) => onDropzoneDrop(event, group.id)}
				>
					{#if group.pages.length > 0}
						<div class="split-pages">
							{#each group.pages as pageId, pageIndex (pageId)}
								{@const pageNumber = getPageNumber(pageId)}
								{@const isFirstPage = pageIndex === 0}
								{@const isLastPage = pageIndex === group.pages.length - 1}
								{@const imageUrl = thumbnailImages[pageId] ?? pdfImages[pageId] ?? null}
								<div class="split-page">
									<button
										type="button"
										data-testid={`split-page-${pageId}`}
										data-drop-target={dropTargetPage === pageId ? 'true' : 'false'}
										class="split-page-select"
										draggable="true"
										aria-label={`Select page ${pageNumber}`}
										aria-current={activePage === pageNumber ? 'true' : undefined}
										onclick={() => onSelectPage?.(pageNumber)}
										ondragstart={(event) => onPageDragStart(event, pageId)}
										ondragover={(event) => onPageDragOver(event, pageId)}
										ondrop={(event) => onPageDrop(event, pageId)}
										ondragend={clearDragState}
										use:observePage={pageId}
									>
										<FileThumbnail
											file={{ name: `page-${pageNumber}.pdf`, type: 'application/pdf' }}
											previewImageUrl={imageUrl}
											isLoading={!imageUrl && pdfImages[pageId] !== null}
											hasError={!imageUrl && pdfImages[pageId] === null}
											previewAspectRatio={THUMBNAIL_WIDTH / THUMBNAIL_HEIGHT}
											isDark={dark}
										/>
										<span class="split-page-badge">{pageNumber}</span>
									</button>
									<div class="split-page-actions" role="group" aria-label={`Page ${pageNumber} actions`}>
										<button
											type="button"
											class="page-move"
											aria-label={`Move page ${pageNumber} left`}
											disabled={isFirstPage}
											onclick={() => commit(movePage(splits, pageId, -1))}
										>
											←
										</button>
										<button
											type="button"
											class="page-move"
											aria-label={`Move page ${pageNumber} right`}
											disabled={isLastPage}
											onclick={() => commit(movePage(splits, pageId, 1))}
										>
											→
										</button>
										<button
											type="button"
											class="page-move"
											aria-label={`Move page ${pageNumber} to previous split`}
											disabled={isFirstGroup}
											onclick={() => commit(movePageToAdjacentGroup(splits, pageId, -1))}
										>
											⇤
										</button>
										<button
											type="button"
											class="page-move"
											aria-label={`Move page ${pageNumber} to next split`}
											disabled={isLastGroup}
											onclick={() => commit(movePageToAdjacentGroup(splits, pageId, 1))}
										>
											⇥
										</button>
									</div>
								</div>
							{/each}
						</div>
					{:else}
						<div class="split-empty">Drop pages here</div>
					{/if}
				</div>
			</section>
		{/each}
	</div>
</aside>

<style>
	.document-splits {
		--splits-bg: #ffffff;
		--splits-muted: #f4f4f5;
		--splits-border: #e4e4e7;
		--splits-text: #18181b;
		--splits-subtle: #71717a;
		--splits-accent: #e9e9ec;
		display: flex;
		height: 100%;
		min-height: 0;
		flex-direction: column;
		background: var(--splits-muted);
		color: var(--splits-text);
	}

	.document-splits.dark {
		--splits-bg: #18181b;
		--splits-muted: #27272a;
		--splits-border: #3f3f46;
		--splits-text: #f4f4f5;
		--splits-subtle: #a1a1aa;
		--splits-accent: #3f3f46;
	}

	/* Like upstream: the divider sits on top when stacked, on the left from md up. */
	.document-splits.with-frame-divider {
		border-top: 1px solid var(--splits-border);
	}

	@media (min-width: 768px) {
		.document-splits.with-frame-divider {
			border-top: 0;
			border-left: 1px solid var(--splits-border);
		}
	}

	.splits-header {
		display: flex;
		min-height: 3rem;
		align-items: center;
		justify-content: flex-end;
		gap: 0.75rem;
		border-bottom: 1px solid var(--splits-border);
		background: var(--splits-bg);
		padding: 0.5rem 0.75rem;
	}

	.add-split {
		border: 1px solid var(--splits-border);
		border-radius: 0.375rem;
		background: var(--splits-bg);
		color: var(--splits-text);
		padding: 0.25rem 0.625rem;
		font-size: 0.8125rem;
		cursor: pointer;
	}

	.splits-list {
		display: flex;
		flex: 1;
		min-height: 0;
		flex-direction: column;
		gap: 0.75rem;
		overflow-y: auto;
		padding: 0.75rem;
	}

	.split-group {
		width: 100%;
		border: 1px solid var(--splits-border);
		border-radius: 0.5rem;
		background: var(--splits-bg);
	}

	.split-group[data-drop-target='true'] {
		outline: 2px solid #3b82f6;
		outline-offset: 2px;
	}

	.split-group-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		border-bottom: 1px solid var(--splits-border);
		padding: 0.5rem 0.75rem;
	}

	.drag-handle {
		cursor: grab;
		border: 0;
		border-radius: 0.375rem;
		background: transparent;
		color: var(--splits-subtle);
		font-size: 1rem;
		line-height: 1;
		padding: 0.25rem;
	}

	.drag-handle:active {
		cursor: grabbing;
	}

	.split-group-titles {
		min-width: 0;
		flex: 1;
	}

	.split-title-input {
		width: 100%;
		border: 1px solid transparent;
		border-radius: 0.375rem;
		background: transparent;
		color: var(--splits-text);
		font-size: 0.875rem;
		font-weight: 600;
		padding: 0.125rem 0.375rem;
	}

	.split-title-input:hover {
		border-color: var(--splits-border);
	}

	.split-title-input:focus-visible {
		border-color: #3b82f6;
		outline: none;
	}

	.split-range {
		margin-top: 0.125rem;
		font-size: 0.75rem;
		color: var(--splits-subtle);
	}

	.split-group-actions {
		display: flex;
		flex-shrink: 0;
		align-items: center;
		gap: 0.25rem;
	}

	.split-group-actions button {
		border: 1px solid transparent;
		border-radius: 0.375rem;
		background: transparent;
		color: var(--splits-text);
		cursor: pointer;
		font-size: 0.75rem;
		padding: 0.25rem 0.375rem;
	}

	.split-group-actions button:hover:not(:disabled) {
		background: var(--splits-accent);
	}

	.split-group-actions button:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.split-count {
		border-radius: 9999px;
		background: var(--splits-muted);
		color: var(--splits-subtle);
		font-size: 0.75rem;
		padding: 0.125rem 0.5rem;
	}

	.split-dropzone {
		min-height: 7.25rem;
		border-radius: 0 0 0.5rem 0.5rem;
		padding: 0.5rem;
	}

	.split-dropzone[data-drop-target='true'] {
		background: var(--splits-accent);
		box-shadow: inset 0 0 0 1px var(--splits-border);
	}

	.split-pages {
		display: flex;
		gap: 0.5rem;
		overflow-x: auto;
		padding: 0.25rem 1.5rem 0.25rem 0.25rem;
	}

	.split-page {
		position: relative;
		flex-shrink: 0;
		width: 4.5rem;
		border-radius: 0.5rem;
	}

	.split-page-select[data-drop-target='true'] {
		outline: 2px solid #3b82f6;
		outline-offset: 2px;
	}

	.split-page-select {
		position: relative;
		display: block;
		width: 100%;
		height: 5.75rem;
		padding: 0;
		border: 1px solid var(--splits-border);
		border-radius: 0.5rem;
		background: var(--splits-bg);
		cursor: pointer;
		overflow: hidden;
	}

	.split-page-select[aria-current='true'] {
		border-color: #3b82f6;
		box-shadow: 0 0 0 2px #3b82f6;
	}

	.split-page-badge {
		position: absolute;
		right: 0.25rem;
		bottom: 0.25rem;
		border-radius: 0.25rem;
		background: var(--splits-bg);
		border: 1px solid var(--splits-border);
		font-size: 0.625rem;
		font-weight: 600;
		padding: 0.0625rem 0.375rem;
	}

	.split-page-actions {
		display: flex;
		justify-content: center;
		gap: 0.125rem;
		margin-top: 0.25rem;
	}

	.page-move {
		border: 1px solid transparent;
		border-radius: 0.25rem;
		background: transparent;
		color: var(--splits-subtle);
		cursor: pointer;
		font-size: 0.75rem;
		line-height: 1;
		padding: 0.125rem 0.25rem;
	}

	.page-move:hover:not(:disabled) {
		background: var(--splits-accent);
		color: var(--splits-text);
	}

	.page-move:disabled {
		opacity: 0.35;
		cursor: default;
	}

	.split-empty {
		display: grid;
		height: 6.5rem;
		place-items: center;
		border-radius: 0.5rem;
		background: var(--splits-muted);
		color: var(--splits-subtle);
		font-size: 0.75rem;
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}
</style>
