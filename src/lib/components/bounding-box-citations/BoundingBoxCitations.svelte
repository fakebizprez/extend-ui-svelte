<!--
	MIT License — Svelte 5 port of Extend UI bounding-box-citations. Upstream: extend-hq/ui (MIT).
	Deliberate changes vs the React HumanReviewBlock:
	- The review panel is a plain citation list (no glide-data-grid editing or
	  diff views); the port scope is the box list synced with page overlays.
	- Rendering runs on the shared PdfViewer (#lib/components/pdf-viewer) with
	  a `pageOverlay` snippet instead of the @embedpdf plugin stack.
	- Dark mode is parent-controlled (isDark + onIsDarkChange) per project
	  contract, replacing the upstream `theme` prop.
	- Scroll-to-page uses scrollIntoView on the rendered page slot, because
	  PdfViewer does not expose the upstream scrollToPageArea handle.
	- `class` replaces React's `className`.
-->
<script lang="ts">
	import PdfViewer from '#lib/components/pdf-viewer/PdfViewer.svelte';
	import {
		boxesForPage,
		findReviewField,
		formatCitationValue,
		getMetadataLocation,
		getReviewFieldLocation,
		type JsonValue,
		type ReviewField,
		type ReviewLocation,
		type ReviewMetadataEntry
	} from './citations.js';

	export interface BoundingBoxCitationsProps {
		/** PDF URL to load. Empty renders the viewer upload prompt. */
		src?: string;
		/** Download file name (without the .pdf extension is fine). */
		fileName?: string;
		/** Citation fields; boxes render for fields with a resolved location. */
		fields?: ReviewField[];
		/** Key of the active citation. Two-way bindable. */
		activeFieldKey?: string | null;
		/** Called with the focused field (upstream `onFieldFocus`). */
		onFieldFocus?: (field: ReviewField) => void;
		/** Active citation event: called with the new active key. */
		onActiveFieldChange?: (fieldKey: string | null) => void;
		/** Called when the pointer enters/leaves a citation (upstream `onLocationHover`). */
		onLocationHover?: (location?: ReviewLocation) => void;
		/** Metadata records keyed by metadata path, for citation resolution. */
		metadata?: Record<string, ReviewMetadataEntry>;
		/** Custom metadata-path resolver; falls back to `metadata`. */
		resolveLocation?: (metadataPath: string) => ReviewLocation | undefined;
		/** Show `expected` values in the list instead of `actual`. */
		showExpected?: boolean;
		/** Parent-controlled dark mode flag. */
		isDark?: boolean;
		/** Called when the user toggles dark mode. */
		onIsDarkChange?: (isDark: boolean) => void;
		/** Viewer viewport height in px. */
		height?: number;
		class?: string;
	}

	let {
		src,
		fileName,
		fields = [],
		activeFieldKey = $bindable(null),
		onFieldFocus,
		onActiveFieldChange,
		onLocationHover,
		metadata,
		resolveLocation,
		showExpected = true,
		isDark = false,
		onIsDarkChange,
		height = 600,
		class: className = ''
	}: BoundingBoxCitationsProps = $props();

	let root: HTMLDivElement | null = $state(null);

	function resolveFieldLocation(metadataPath: string): ReviewLocation | undefined {
		return resolveLocation?.(metadataPath) ?? getMetadataLocation(metadata, metadataPath);
	}

	const locations = $derived(
		new Map(
			fields.map((field) => [
				field.key,
				getReviewFieldLocation(field, resolveFieldLocation)
			] as const)
		)
	);
	const activeField = $derived(findReviewField(fields, activeFieldKey ?? undefined));

	function scrollToPage(pageNumber: number): void {
		const page = root?.querySelector(`[data-page-number="${pageNumber}"]`);
		if (page instanceof HTMLElement && typeof page.scrollIntoView === 'function') {
			page.scrollIntoView({ block: 'start' });
		}
	}

	function focusField(field: ReviewField): void {
		if (field.key === activeFieldKey) return;
		activeFieldKey = field.key;
		onFieldFocus?.(field);
		onActiveFieldChange?.(field.key);
		const location = getReviewFieldLocation(field, resolveFieldLocation);
		if (location) {
			scrollToPage(location.page);
		}
	}

	function displayValue(field: ReviewField): JsonValue {
		return showExpected ? field.expected : field.actual;
	}
</script>

<div
	class={`bounding-box-citations${isDark ? ' dark' : ''}${className ? ` ${className}` : ''}`}
	data-dark={String(isDark)}
	data-testid="bounding-box-citations"
	bind:this={root}
>
	<div class="citations-viewer" data-testid="citations-viewer-pane">
		<PdfViewer
			{src}
			{fileName}
			{isDark}
			{onIsDarkChange}
			{height}
		>
			{#snippet pageOverlay(overlay)}
				{@const boxes = boxesForPage(fields, overlay.pageNumber, resolveFieldLocation)}
				{#each boxes as box (box.field.key)}
					{@const isActive = box.field.key === activeFieldKey}
					<button
						type="button"
						class={`citation-box${isActive ? ' active' : ''}`}
						data-testid="citation-box"
						data-field-key={box.field.key}
						data-active={String(isActive)}
						aria-pressed={isActive}
						aria-label={`Citation ${box.field.schema.title ?? box.field.key}, page ${box.location.page}`}
						style={`left: ${box.location.area.left}%; top: ${box.location.area.top}%; width: ${box.location.area.width}%; height: ${box.location.area.height}%;`}
						onclick={() => focusField(box.field)}
						onmouseenter={() => onLocationHover?.(box.location)}
						onmouseleave={() => onLocationHover?.(undefined)}
					></button>
				{/each}
			{/snippet}
		</PdfViewer>
	</div>
	<aside class="citations-panel" aria-label="Citations">
		<ul class="citations-list" data-testid="citation-list">
			{#each fields as field (field.key)}
				{@const location = locations.get(field.key)}
				{@const isActive = field.key === activeFieldKey}
				<li>
					<button
						type="button"
						class={`citation-item${isActive ? ' active' : ''}`}
						aria-current={isActive ? 'true' : undefined}
						onclick={() => focusField(field)}
						onmouseenter={() => onLocationHover?.(location)}
						onmouseleave={() => onLocationHover?.(undefined)}
					>
						<span class="citation-title">{field.schema.title ?? field.key}</span>
						{#if location}
							<span class="citation-page">p. {location.page}</span>
						{/if}
						<span class="citation-value">{formatCitationValue(displayValue(field))}</span>
					</button>
				</li>
			{/each}
		</ul>
		{#if activeField}
			<p class="citations-active" data-testid="citation-active">
				Active: {activeField.schema.title ?? activeField.key}
			</p>
		{/if}
	</aside>
</div>

<style>
	.bounding-box-citations {
		--citations-bg: #ffffff;
		--citations-fg: #171717;
		--citations-muted: #525252;
		--citations-border: #e5e5e5;
		--citations-box-border: rgb(37 99 235 / 0.7);
		--citations-box-bg: rgb(59 130 246 / 0.12);
		--citations-box-active-border: rgb(29 78 216 / 0.9);
		--citations-box-active-bg: rgb(59 130 246 / 0.25);
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(12rem, 18rem);
		gap: 1rem;
		align-items: start;
		color: var(--citations-fg);
		font-family:
			system-ui,
			-apple-system,
			'Segoe UI',
			sans-serif;
		font-size: 13px;
	}

	.bounding-box-citations.dark {
		--citations-bg: #0a0a0a;
		--citations-fg: #e5e5e5;
		--citations-muted: #a3a3a3;
		--citations-border: #262626;
	}

	.citations-viewer {
		min-width: 0;
	}

	.citations-panel {
		border: 1px solid var(--citations-border);
		border-radius: 0.75rem;
		background: var(--citations-bg);
		padding: 0.75rem;
	}

	.citations-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		max-height: 32rem;
		overflow-y: auto;
	}

	.citation-item {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.25rem 0.5rem;
		width: 100%;
		text-align: left;
		padding: 0.5rem 0.625rem;
		border: 1px solid var(--citations-border);
		border-radius: 0.5rem;
		background: transparent;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}

	.citation-item.active {
		border-color: var(--citations-box-border);
		background: var(--citations-box-bg);
	}

	.citation-title {
		font-weight: 600;
	}

	.citation-page {
		margin-left: auto;
		color: var(--citations-muted);
		font-size: 12px;
		white-space: nowrap;
	}

	.citation-value {
		flex-basis: 100%;
		color: var(--citations-muted);
		font-size: 12px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.citations-active {
		margin: 0.75rem 0 0;
		color: var(--citations-muted);
		font-size: 12px;
	}

	.citation-box {
		position: absolute;
		/* The PdfViewer overlay layer disables pointer events; re-enable them so
		   boxes are clickable in both sync directions. */
		pointer-events: auto;
		padding: 0;
		border: 1px solid var(--citations-box-border);
		background: var(--citations-box-bg);
		box-shadow: 0 4px 16px rgb(59 130 246 / 0.1);
		cursor: pointer;
	}

	.citation-box.active {
		border-color: var(--citations-box-active-border);
		background: var(--citations-box-active-bg);
	}
</style>
