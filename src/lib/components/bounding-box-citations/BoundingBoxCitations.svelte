<!--
	MIT License — Svelte 5 port of Extend UI bounding-box-citations. Upstream: extend-hq/ui (MIT).
	Port of the upstream HumanReviewBlock (blocks/bounding-box-citations-block):
	the PDF viewer beside HumanReviewPanel in a resizable split. Focusing a
	field highlights its bounding box and scrolls the PDF there; hovering a
	field or array cell previews its box.
	Deliberate changes vs the React block:
	- Every located field also gets a faint box on the page; clicking one
	  focuses that field in the panel (upstream draws only the active box).
	- Rendering runs on the shared PdfViewer (#lib/components/pdf-viewer) with
	  a `pageOverlay` snippet instead of the @embedpdf plugin stack.
	- Dark mode is parent-controlled (isDark + onIsDarkChange), replacing the
	  upstream `theme` prop.
	- Scroll-to-area computes the offset from the rendered page slots, because
	  PdfViewer does not expose the upstream scrollToPageArea handle.
	- `src` is the primary PDF prop; upstream's `file` is accepted as an alias.
	- `class` and `className` are both accepted and merged.
	- Additions: `bind:activeFieldKey`, `onActiveFieldChange`, `onFieldFocus`,
	  `onLocationHover`, `bind:values`, `fileName`, and `height` (PDF viewport px).
	- The split stacks vertically below 900px instead of switching to a
	  vertical resizable layout.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import PdfViewer from '../pdf-viewer/PdfViewer.svelte';
	import { cn } from '../../utils.js';
	import {
		boxesForPage,
		findReviewField,
		getMetadataLocation,
		getReviewFieldLocation,
		getReviewLocationKey,
		type JsonObject,
		type JsonValue,
		type ReviewField,
		type ReviewLocation,
		type ReviewMetadataEntry
	} from './citations.js';
	import HumanReviewHighlight from './HumanReviewHighlight.svelte';
	import HumanReviewPanel from './HumanReviewPanel.svelte';
	import { REVIEW_FIELDS } from './review.js';

	export interface BoundingBoxCitationsProps {
		/** PDF URL to load. Empty renders the viewer upload prompt. */
		src?: string;
		/** Upstream name for `src`. */
		file?: string;
		/** Download file name (without the .pdf extension is fine). */
		fileName?: string;
		/** Review fields; defaults to upstream's bank statement sample. */
		fields?: ReviewField[];
		/** Edited expected values keyed by field key. Two-way bindable. */
		values?: JsonObject;
		/** Key of the focused field. Two-way bindable; defaults to the first field. */
		activeFieldKey?: string | null;
		/** Called with the focused field. */
		onFieldFocus?: (field: ReviewField) => void;
		/** Called with the new active field key. */
		onActiveFieldChange?: (fieldKey: string | null) => void;
		/** Called with the hovered location, `undefined` on leave. */
		onLocationHover?: (location?: ReviewLocation) => void;
		/** Citation metadata keyed by metadata path, for location resolution. */
		metadata?: Record<string, ReviewMetadataEntry>;
		/** Maps an array row to its metadata path (default `${path}[${row}]`). */
		resolveArrayItemMetadataPath?: (
			metadataPath: string,
			rowIndex: number,
			rowValue: JsonValue
		) => string | undefined;
		/** Custom metadata-path resolver; falls back to `metadata`. */
		resolveLocation?: (metadataPath: string) => ReviewLocation | undefined;
		/** Show expected values, undo, Set to NULL, and the diff. */
		showExpected?: boolean;
		/** Parent-controlled dark mode flag. */
		isDark?: boolean;
		/** Called when the user toggles dark mode from the viewer. */
		onIsDarkChange?: (isDark: boolean) => void;
		/** PDF viewport height in px. */
		height?: number;
		class?: string;
		/** Alias of `class`, matching the React prop name. */
		className?: string;
	}

	let {
		src,
		file,
		fileName,
		fields = REVIEW_FIELDS,
		values = $bindable(),
		activeFieldKey = $bindable(null),
		onFieldFocus,
		onActiveFieldChange,
		onLocationHover,
		metadata,
		resolveArrayItemMetadataPath,
		resolveLocation,
		showExpected = true,
		isDark = false,
		onIsDarkChange,
		height = 600,
		class: klass = '',
		className = ''
	}: BoundingBoxCitationsProps = $props();

	// Upstream PdfBlockResizableShell settings for this block.
	const AUTO_SAVE_ID = 'pdf-block-bounding-box-citations';
	const RIGHT_MIN = 30;
	const RIGHT_MAX = 60;

	let root: HTMLDivElement | null = $state(null);
	let shell: HTMLDivElement | null = $state(null);
	let rightSize = $state(42);
	let dragging = false;
	let hoverLocation: ReviewLocation | null = $state(null);
	let hoverLocationKey: string | null = null;

	// svelte-ignore state_referenced_locally: like upstream, start on the first field.
	if (!activeFieldKey && fields[0]) activeFieldKey = fields[0].key;

	const pdfSrc = $derived(src ?? file);
	const activeField = $derived(findReviewField(fields, activeFieldKey ?? undefined) ?? fields[0]);
	const activeLocation = $derived(
		hoverLocation ?? getReviewFieldLocation(activeField, resolveFieldLocation)
	);

	onMount(() => {
		try {
			const saved = Number(localStorage.getItem(AUTO_SAVE_ID));
			if (saved >= RIGHT_MIN && saved <= RIGHT_MAX) rightSize = saved;
		} catch {
			// Storage can be blocked; keep the default split.
		}
	});

	function resolveFieldLocation(metadataPath: string): ReviewLocation | undefined {
		return resolveLocation?.(metadataPath) ?? getMetadataLocation(metadata, metadataPath);
	}

	/** Content offset (scrollTop space) of an element inside the PDF viewport. */
	function offsetInViewport(viewport: HTMLElement, element: HTMLElement): number {
		return (
			viewport.scrollTop +
			element.getBoundingClientRect().top -
			viewport.getBoundingClientRect().top
		);
	}

	/**
	 * Centre of an area as fractions of the displayed page, after the page is
	 * turned clockwise by `rotation` degrees (overlays turn with the page).
	 */
	function rotatedCenter(location: ReviewLocation, rotation: number): { x: number; y: number } {
		const x = (location.area.left + location.area.width / 2) / 100;
		const y = (location.area.top + location.area.height / 2) / 100;
		const turns = ((Math.round(rotation / 90) % 4) + 4) % 4;
		return [
			{ x, y },
			{ x: 1 - y, y: x },
			{ x: 1 - x, y: 1 - y },
			{ x: y, y: 1 - x }
		][turns]!;
	}

	/** Content offset (scrollLeft space) of an element inside the PDF viewport. */
	function leftInViewport(viewport: HTMLElement, element: HTMLElement): number {
		return (
			viewport.scrollLeft +
			element.getBoundingClientRect().left -
			viewport.getBoundingClientRect().left
		);
	}

	/**
	 * Centers a page area in the PDF viewport, measuring the rendered page so
	 * the viewer's gaps and per-page sizes are respected. Pages outside the
	 * viewer's render window are reached in two steps: jump to an estimate from
	 * a rendered page, then aim exactly once the target page renders.
	 */
	function scrollToPageArea(location: ReviewLocation, behavior: ScrollBehavior, retry = true): void {
		const viewport = root?.querySelector<HTMLElement>('[data-testid="pdf-viewport"]');
		if (!viewport) return;
		const page = viewport.querySelector<HTMLElement>(`[data-page-number="${location.page}"]`);
		if (page) {
			const center = rotatedCenter(location, Number(page.dataset.rotation ?? 0));
			viewport.scrollTo?.({
				top: Math.max(
					0,
					offsetInViewport(viewport, page) + center.y * page.offsetHeight - viewport.clientHeight / 2
				),
				left: Math.max(
					0,
					leftInViewport(viewport, page) + center.x * page.offsetWidth - viewport.clientWidth / 2
				),
				behavior
			});
			return;
		}

		const rendered = [...viewport.querySelectorAll<HTMLElement>('[data-page-number]')];
		if (!retry || !rendered.length) return;
		const first = rendered[0];
		const last = rendered[rendered.length - 1];
		const firstNumber = Number(first.dataset.pageNumber);
		const lastNumber = Number(last.dataset.pageNumber);
		const pitch =
			lastNumber > firstNumber
				? (offsetInViewport(viewport, last) - offsetInViewport(viewport, first)) /
					(lastNumber - firstNumber)
				: first.offsetHeight;
		viewport.scrollTo?.({
			top: Math.max(0, offsetInViewport(viewport, first) + (location.page - firstNumber) * pitch),
			behavior: 'auto'
		});
		requestAnimationFrame(() =>
			requestAnimationFrame(() => scrollToPageArea(location, behavior, false))
		);
	}

	function focusField(field: ReviewField): void {
		if (field.key === activeFieldKey) return;
		activeFieldKey = field.key;
		onFieldFocus?.(field);
		onActiveFieldChange?.(field.key);
		const location = getReviewFieldLocation(field, resolveFieldLocation);
		if (location) scrollToPageArea(location, 'smooth');
	}

	function handleLocationHover(location?: ReviewLocation): void {
		hoverLocation = location ?? null;
		onLocationHover?.(location);
		if (!location) {
			hoverLocationKey = null;
			return;
		}
		const key = getReviewLocationKey(location);
		if (key === hoverLocationKey) return;
		hoverLocationKey = key;
		scrollToPageArea(location, 'auto');
	}

	function handleBoxClick(field: ReviewField): void {
		focusField(field);
		root
			?.querySelector(`[data-review-field="${field.key.replace(/["\\]/g, "\\$&")}"]`)
			?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
	}

	function setRightSize(size: number): void {
		rightSize = Math.round(Math.min(Math.max(size, RIGHT_MIN), RIGHT_MAX) * 10) / 10;
		try {
			localStorage.setItem(AUTO_SAVE_ID, String(rightSize));
		} catch {
			// Storage can be blocked; the size still applies for this session.
		}
	}

	function handlePointerMove(event: PointerEvent): void {
		if (!dragging || !shell) return;
		const rect = shell.getBoundingClientRect();
		if (rect.width) setRightSize(((rect.right - event.clientX) / rect.width) * 100);
	}

	function handleHandleKeydown(event: KeyboardEvent): void {
		const next: Record<string, number> = {
			ArrowLeft: rightSize + 2,
			ArrowRight: rightSize - 2,
			Home: RIGHT_MIN,
			End: RIGHT_MAX
		};
		if (!(event.key in next)) return;
		event.preventDefault();
		setRightSize(next[event.key]);
	}
</script>

<div
	class={cn('bounding-box-citations', isDark && 'dark', klass, className)}
	data-dark={String(isDark)}
	data-testid="bounding-box-citations"
	bind:this={root}
>
	<div class="bbc-shell" style={`--bbc-right: ${rightSize}%;`} bind:this={shell}>
		<div class="bbc-left" data-testid="citations-viewer-pane">
			<PdfViewer src={pdfSrc} {fileName} defaultZoom={1} {isDark} {onIsDarkChange} {height}>
				{#snippet pageOverlay(overlay)}
					{#each boxesForPage(fields, overlay.pageNumber, resolveFieldLocation) as box (box.field.key)}
						{@const isActive = box.field.key === activeField?.key}
						<button
							type="button"
							class={`citation-box${isActive ? ' active' : ''}`}
							data-testid="citation-box"
							data-field-key={box.field.key}
							data-active={String(isActive)}
							aria-pressed={isActive}
							aria-label={`Citation ${box.field.schema.title ?? box.field.key}, page ${box.location.page}`}
							style={`left: ${box.location.area.left}%; top: ${box.location.area.top}%; width: ${box.location.area.width}%; height: ${box.location.area.height}%;`}
							onclick={() => handleBoxClick(box.field)}
						></button>
					{/each}
					{#if activeLocation?.page === overlay.pageNumber}
						<HumanReviewHighlight location={activeLocation} />
					{/if}
				{/snippet}
			</PdfViewer>
		</div>
		<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions: a focusable separator is the ARIA window-splitter pattern. -->
		<div
			class="bbc-handle"
			role="separator"
			tabindex="0"
			aria-label="Resize review panel"
			aria-orientation="vertical"
			aria-valuenow={rightSize}
			aria-valuemin={RIGHT_MIN}
			aria-valuemax={RIGHT_MAX}
			onpointerdown={(event) => {
				dragging = true;
				event.currentTarget.setPointerCapture?.(event.pointerId);
			}}
			onpointermove={handlePointerMove}
			onpointerup={() => (dragging = false)}
			onpointercancel={() => (dragging = false)}
			onkeydown={handleHandleKeydown}
		>
			<span class="bbc-grip" aria-hidden="true"></span>
		</div>
		<aside class="bbc-right" aria-label="Review">
			<div class="bbc-panel">
				<HumanReviewPanel
					{fields}
					bind:values
					activeFieldKey={activeField?.key}
					{showExpected}
					{isDark}
					onFieldFocus={focusField}
					onLocationHover={handleLocationHover}
					{resolveArrayItemMetadataPath}
					resolveLocation={resolveFieldLocation}
				/>
			</div>
		</aside>
	</div>
</div>

<style>
	.bounding-box-citations {
		--bbc-bg: #ffffff;
		--bbc-border: #e5e5e5;
		container-type: inline-size;
		background: var(--bbc-bg);
	}

	.bounding-box-citations.dark {
		--bbc-bg: #0a0a0a;
		--bbc-border: rgb(255 255 255 / 0.1);
	}

	.bbc-shell {
		position: relative;
		display: grid;
		grid-template-columns: minmax(0, 1fr) 1px var(--bbc-right);
		min-height: 420px;
		overflow: hidden;
	}

	.bbc-left {
		min-width: 0;
		overflow: hidden;
	}

	.bbc-handle {
		position: relative;
		z-index: 10;
		background: var(--bbc-border);
		cursor: col-resize;
		touch-action: none;
		outline: none;
	}

	/* Wider invisible hit area around the 1px line. */
	.bbc-handle::before {
		content: '';
		position: absolute;
		inset: 0 -4px;
	}

	.bbc-handle:focus-visible {
		box-shadow: 0 0 0 2px rgb(59 130 246 / 0.5);
	}

	.bbc-grip {
		position: absolute;
		top: 50%;
		left: 50%;
		width: 12px;
		height: 16px;
		transform: translate(-50%, -50%);
		border: 1px solid var(--bbc-border);
		border-radius: 3px;
		background: var(--bbc-border);
	}

	.bbc-right {
		position: relative;
		min-width: 0;
		background: var(--bbc-bg);
	}

	.bbc-panel {
		position: absolute;
		inset: 0;
		--human-review-panel-height: 100%;
	}

	@container (max-width: 899px) {
		.bbc-shell {
			grid-template-columns: minmax(0, 1fr);
		}

		.bbc-handle {
			display: none;
		}

		.bbc-right {
			height: 560px;
			border-top: 1px solid var(--bbc-border);
		}
	}

	.citation-box {
		position: absolute;
		/* The PdfViewer overlay layer disables pointer events; re-enable them so
		   boxes are clickable in both sync directions. */
		pointer-events: auto;
		box-sizing: border-box;
		padding: 0;
		border: 1px dashed rgb(59 130 246 / 0.35);
		background: transparent;
		cursor: pointer;
	}

	.citation-box:hover,
	.citation-box:focus-visible {
		background: rgb(59 130 246 / 0.08);
		outline: none;
	}

	.citation-box.active {
		border-color: transparent;
	}
</style>
