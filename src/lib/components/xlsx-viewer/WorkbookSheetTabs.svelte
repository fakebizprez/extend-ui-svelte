<!--
	MIT License — Svelte 5 port of Extend UI WorkbookSheetTabs (xlsx-viewer). Upstream: extend-hq/ui (MIT).
	The sheet tab strip shared by XlsxViewer and XlsxEditor. Like upstream it
	renders nothing for a single-sheet workbook and behaves like Radix Tabs:
	only the active tab is in the tab order, and the arrow keys, Home, and End
	switch sheets. Differences from upstream: it takes the sheet names and the
	active index as props (upstream reads them from the react-xlsx context and
	takes only workbookIdentity), and has no hover thumbnail previews.
	Colors come from the host's --xlsx-* custom properties.
-->
<script lang="ts">
	interface Props {
		/** Sheet names in workbook order. */
		sheets: string[];
		/** Zero-based index of the active sheet. */
		activeSheetIndex: number;
		/** Called with the index of the sheet the user picks. */
		onActiveSheetIndexChange: (index: number) => void;
	}

	let { sheets, activeSheetIndex, onActiveSheetIndexChange }: Props = $props();

	let tabs: HTMLButtonElement[] = $state([]);

	function handleKeydown(event: KeyboardEvent): void {
		const last = sheets.length - 1;
		const next =
			event.key === 'ArrowRight'
				? activeSheetIndex >= last
					? 0
					: activeSheetIndex + 1
				: event.key === 'ArrowLeft'
					? activeSheetIndex <= 0
						? last
						: activeSheetIndex - 1
					: event.key === 'Home'
						? 0
						: event.key === 'End'
							? last
							: null;
		if (next === null) return;
		event.preventDefault();
		onActiveSheetIndexChange(next);
		tabs[next]?.focus();
	}
</script>

{#if sheets.length > 1}
	<div class="xlsx-tabs" role="tablist" aria-label="Sheets">
		{#each sheets as name, i (name)}
			<button
				type="button"
				role="tab"
				data-testid="sheet-tab"
				aria-selected={i === activeSheetIndex}
				tabindex={i === activeSheetIndex ? 0 : -1}
				class:active={i === activeSheetIndex}
				bind:this={tabs[i]}
				onclick={() => onActiveSheetIndexChange(i)}
				onkeydown={handleKeydown}
			>
				{name}
			</button>
		{/each}
	</div>
{/if}

<style>
	.xlsx-tabs {
		display: flex;
		gap: 0.25rem;
		overflow-x: auto;
		padding: 0.5rem 0.75rem;
		border-top: 1px solid var(--xlsx-border);
	}

	[role='tab'] {
		flex: none;
		max-width: 12rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		padding: 0.375rem 0.75rem;
		border: 1px solid transparent;
		border-radius: 0.375rem;
		background: transparent;
		color: var(--xlsx-muted);
		font: inherit;
		cursor: pointer;
	}

	[role='tab'].active {
		border-color: var(--xlsx-border);
		color: var(--xlsx-tab-active);
		font-weight: 600;
	}
</style>
