<!--
	MIT License — Svelte 5 port of Extend UI WorkbookSheetTabs (xlsx-viewer). Upstream: extend-hq/ui (MIT).
	The sheet tab strip shared by XlsxViewer and XlsxEditor. Like upstream it
	renders nothing for a single-sheet workbook and behaves like Base UI Tabs
	with its defaults (upstream sets no activateOnFocus): the arrow keys, Home,
	and End move focus only, looping at the ends; Enter or Space activates the
	focused tab; clicking the active tab does nothing. Only the focused tab is
	in the tab order, and it returns to the active tab when focus leaves.
	Differences from upstream: it takes the sheet names and the active index as
	props (upstream reads them from the react-xlsx context and takes only
	workbookIdentity), and has no hover thumbnail previews.
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
	let list: HTMLDivElement | null = $state(null);
	// The tab in the tab order: follows keyboard focus, else the active tab.
	let highlighted = $state(0);

	// Keep the highlight on the active tab unless focus is inside the list.
	$effect(() => {
		const active = activeSheetIndex;
		if (!list?.contains(document.activeElement)) highlighted = active;
	});

	function handleKeydown(event: KeyboardEvent): void {
		const last = sheets.length - 1;
		const next =
			event.key === 'ArrowRight'
				? highlighted >= last
					? 0
					: highlighted + 1
				: event.key === 'ArrowLeft'
					? highlighted <= 0
						? last
						: highlighted - 1
					: event.key === 'Home'
						? 0
						: event.key === 'End'
							? last
							: null;
		if (next === null) return;
		event.preventDefault();
		highlighted = next;
		tabs[next]?.focus();
	}

	// Enter and Space reach here as native button clicks.
	function activate(index: number): void {
		highlighted = index;
		if (index !== activeSheetIndex) onActiveSheetIndexChange(index);
	}

	function handleFocusout(event: FocusEvent): void {
		if (!list?.contains(event.relatedTarget as Node | null)) highlighted = activeSheetIndex;
	}
</script>

{#if sheets.length > 1}
	<div
		class="xlsx-tabs"
		role="tablist"
		aria-label="Sheets"
		bind:this={list}
		onfocusout={handleFocusout}
	>
		{#each sheets as name, i (name)}
			<button
				type="button"
				role="tab"
				data-testid="sheet-tab"
				aria-selected={i === activeSheetIndex}
				tabindex={i === highlighted ? 0 : -1}
				class:active={i === activeSheetIndex}
				bind:this={tabs[i]}
				onclick={() => activate(i)}
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
