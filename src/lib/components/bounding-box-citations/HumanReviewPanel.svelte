<!--
	MIT License — Svelte 5 port of Extend UI bounding-box-citations. Upstream: extend-hq/ui (MIT).
	Port of upstream HumanReviewPanel: Form and JSON tabs over one reviewed
	output. The Form tab lists editable field cards (actual beside expected,
	undo, Set to NULL, nested objects, array grids with drill-in); the JSON tab
	diffs actual against the edited expected output, or shows the actual JSON
	alone when `showExpected` is false.
	Deliberate changes vs the React component:
	- Dark mode is parent-controlled (isDark + onIsDarkChange), replacing the
	  upstream `theme` prop.
	- `class` and `className` are both accepted and merged.
	- `bind:values` exposes the edited expected output (upstream keeps it
	  internal although its usage sample passes `values`).
	- Array grids are a DOM table instead of glide-data-grid: single-cell
	  selection (no range or drag selection).
	- The JSON diff is a built-in line diff instead of @pierre/diffs (no
	  word-level highlights).
	- Panel height comes from `--human-review-panel-height` (default 560px).
-->
<script lang="ts">
	import { cn } from '#lib/utils.js';
	import type { JsonObject, JsonValue, ReviewField, ReviewLocation } from './citations.js';
	import HumanReviewFieldCard from './HumanReviewFieldCard.svelte';
	import JsonCodeView from './JsonCodeView.svelte';
	import JsonDiffView from './JsonDiffView.svelte';
	import ReviewIcon from './ReviewIcon.svelte';
	import { REVIEW_FIELDS, valuesFromFields } from './review.js';

	export interface HumanReviewPanelProps {
		/** Review fields; defaults to upstream's bank statement sample. */
		fields?: ReviewField[];
		/** Edited expected values keyed by field key. Two-way bindable. */
		values?: JsonObject;
		/** Key of the focused field (dotted for nested object properties). */
		activeFieldKey?: string;
		/** Called with the field (or nested property) that gains focus. */
		onFieldFocus?: (field: ReviewField) => void;
		/** Called with a field or array cell location on hover/focus, `undefined` on leave. */
		onLocationHover?: (location?: ReviewLocation) => void;
		/** Maps an array row to its metadata path (default `${path}[${row}]`). */
		resolveArrayItemMetadataPath?: (
			metadataPath: string,
			rowIndex: number,
			rowValue: JsonValue
		) => string | undefined;
		/** Resolves a metadata path to a page location. */
		resolveLocation?: (metadataPath: string) => ReviewLocation | undefined;
		/** Show expected values, undo, Set to NULL, and the diff. */
		showExpected?: boolean;
		/** Parent-controlled dark mode flag. */
		isDark?: boolean;
		/** Accepted for contract parity; the panel renders no theme control. */
		onIsDarkChange?: (isDark: boolean) => void;
		class?: string;
		/** Alias of `class`, matching the React prop name. */
		className?: string;
	}

	let {
		fields = REVIEW_FIELDS,
		values = $bindable(),
		activeFieldKey,
		onFieldFocus,
		onLocationHover,
		resolveArrayItemMetadataPath,
		resolveLocation,
		showExpected = true,
		isDark = false,
		onIsDarkChange: _onIsDarkChange,
		class: klass = '',
		className = ''
	}: HumanReviewPanelProps = $props();

	const id = $props.id();
	let activeTab: 'form' | 'json' = $state('form');
	const tabs = ['form', 'json'] as const;

	// Like upstream, new `fields` reset the edits to their expected values.
	// svelte-ignore state_referenced_locally: seeds the reset check only.
	let seenFields = fields;
	// svelte-ignore state_referenced_locally: fills unbound values once at init.
	if (values === undefined) values = valuesFromFields(fields, 'expected');
	$effect.pre(() => {
		if (fields === seenFields) return;
		seenFields = fields;
		values = valuesFromFields(fields, 'expected');
	});

	const expected = $derived(values ?? {});
	const actualValues = $derived(valuesFromFields(fields, 'actual'));

	function updateValue(key: string, value: JsonValue): void {
		if (Object.is(expected[key], value)) return;
		values = { ...expected, [key]: value };
	}

	function handleTabKeydown(event: KeyboardEvent): void {
		const index = tabs.indexOf(activeTab);
		const next =
			event.key === 'ArrowRight'
				? tabs[(index + 1) % tabs.length]
				: event.key === 'ArrowLeft'
					? tabs[(index + tabs.length - 1) % tabs.length]
					: event.key === 'Home'
						? tabs[0]
						: event.key === 'End'
							? tabs[tabs.length - 1]
							: null;
		if (!next) return;
		event.preventDefault();
		activeTab = next;
		document.getElementById(`${id}-tab-${next}`)?.focus();
	}
</script>

<div
	class={cn('human-review-panel', isDark && 'dark', klass, className)}
	data-testid="human-review-panel"
	data-dark={String(isDark)}
>
	<div class="hr-header">
		<div class="hr-tabs" role="tablist" aria-label="Review view" tabindex="-1" onkeydown={handleTabKeydown}>
			{#each tabs as tab (tab)}
				<button
					type="button"
					role="tab"
					id={`${id}-tab-${tab}`}
					class="hr-tab"
					aria-selected={activeTab === tab}
					aria-controls={`${id}-panel-${tab}`}
					tabindex={activeTab === tab ? 0 : -1}
					onclick={() => (activeTab = tab)}
				>
					<ReviewIcon name={tab === 'form' ? 'captions' : 'square-code'} />
					{tab === 'form' ? 'Form' : 'JSON'}
				</button>
			{/each}
		</div>
	</div>
	<!-- Both tabs stay mounted (upstream keepMounted). -->
	<div
		class="hr-tabpanel hr-form"
		role="tabpanel"
		id={`${id}-panel-form`}
		aria-labelledby={`${id}-tab-form`}
		hidden={activeTab !== 'form'}
	>
		<div class="hr-fields">
			{#each fields as field (field.key)}
				<HumanReviewFieldCard
					{field}
					value={showExpected ? (expected[field.key] ?? null) : field.actual}
					originalValue={showExpected ? field.expected : field.actual}
					active={field.key === activeFieldKey || Boolean(activeFieldKey?.startsWith(`${field.key}.`))}
					{activeFieldKey}
					{showExpected}
					onChange={(value) => updateValue(field.key, value)}
					{onFieldFocus}
					{onLocationHover}
					onUndo={() => updateValue(field.key, field.expected)}
					onSetNull={() => updateValue(field.key, null)}
					{resolveArrayItemMetadataPath}
					{resolveLocation}
				/>
			{/each}
		</div>
	</div>
	<div
		class="hr-tabpanel"
		role="tabpanel"
		id={`${id}-panel-json`}
		aria-labelledby={`${id}-tab-json`}
		hidden={activeTab !== 'json'}
	>
		{#if showExpected}
			<JsonDiffView actual={actualValues} {expected} {isDark} />
		{:else}
			<JsonCodeView value={actualValues} {isDark} />
		{/if}
	</div>
</div>

<style>
	.human-review-panel {
		--hr-bg: #ffffff;
		--hr-fg: #0a0a0a;
		--hr-muted: #f5f5f5;
		--hr-muted-half: rgb(245 245 245 / 0.5);
		--hr-muted-third: rgb(245 245 245 / 0.3);
		--hr-muted-quarter: rgb(245 245 245 / 0.25);
		--hr-muted-fg: #737373;
		--hr-border: #e5e5e5;
		--hr-input: #e5e5e5;
		--hr-input-bg: #ffffff;
		--hr-ring: #a1a1a1;
		--hr-ring-soft: rgb(161 161 161 / 0.3);
		--hr-bool-on: #ffffff;
		--hr-accent: rgb(37 99 235);
		--hr-accent-light: rgb(219 234 254);
		--hr-blue-text: rgb(37 99 235);
		--hr-cell-selected: rgb(219 234 254 / 0.85);
		--hr-cell-mirrored: rgb(237 233 254 / 0.9);
		--hr-mirror-border: rgb(167 139 250);
		--hr-grid-bg: rgb(255 255 255);
		--hr-grid-header-bg: rgb(250 250 250);
		--hr-grid-header-focus: rgb(245 245 245);
		--hr-grid-border: rgb(229 229 229);
		--hr-grid-text: rgb(23 23 23);
		--hr-grid-header-text: rgb(23 23 23);
		--hr-grid-text-light: rgb(163 163 163);
		display: flex;
		height: var(--human-review-panel-height, 560px);
		flex-direction: column;
		background: var(--hr-bg);
		color: var(--hr-fg);
		font-family:
			system-ui,
			-apple-system,
			'Segoe UI',
			sans-serif;
		font-size: 14px;
	}

	.human-review-panel.dark {
		--hr-bg: #0a0a0a;
		--hr-fg: #fafafa;
		--hr-muted: #262626;
		--hr-muted-half: rgb(38 38 38 / 0.5);
		--hr-muted-third: rgb(38 38 38 / 0.3);
		--hr-muted-quarter: rgb(38 38 38 / 0.25);
		--hr-muted-fg: #a1a1a1;
		--hr-border: rgb(255 255 255 / 0.1);
		--hr-input: rgb(255 255 255 / 0.15);
		--hr-input-bg: rgb(255 255 255 / 0.045);
		--hr-ring: #737373;
		--hr-ring-soft: rgb(115 115 115 / 0.5);
		--hr-bool-on: rgb(255 255 255 / 0.15);
		--hr-accent: rgb(96 165 250);
		--hr-accent-light: rgb(29 78 216 / 0.15);
		--hr-blue-text: rgb(147 197 253);
		--hr-cell-selected: rgb(37 99 235 / 0.2);
		--hr-cell-mirrored: rgb(167 139 250 / 0.18);
		--hr-grid-bg: rgb(10 10 10);
		--hr-grid-header-bg: rgb(23 23 23);
		--hr-grid-header-focus: rgb(38 38 38);
		--hr-grid-border: rgb(38 38 38);
		--hr-grid-text: rgb(229 229 229);
		--hr-grid-header-text: rgb(245 245 245);
		--hr-grid-text-light: rgb(115 115 115);
		color-scheme: dark;
	}

	.hr-header {
		display: flex;
		min-height: 3rem;
		flex: none;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		border-bottom: 1px solid var(--hr-border);
		padding: 0 0.75rem;
	}

	.hr-tabs {
		display: inline-flex;
		height: 28px;
		align-items: center;
		border-radius: 10px;
		background: var(--hr-muted);
		padding: 2px;
		outline: none;
	}

	.hr-tab {
		display: inline-flex;
		height: 24px;
		align-items: center;
		gap: 0.375rem;
		border: 1px solid transparent;
		border-radius: 8px;
		background: transparent;
		padding: 0 0.5rem;
		color: var(--hr-muted-fg);
		font: inherit;
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
	}

	.hr-tab :global(svg) {
		width: 16px;
		height: 16px;
	}

	.hr-tab[aria-selected='true'] {
		background: var(--hr-bool-on);
		box-shadow: 0 1px 2px rgb(0 0 0 / 0.08);
		color: var(--hr-fg);
	}

	.hr-tab:focus-visible {
		outline: 2px solid rgb(59 130 246 / 0.5);
	}

	.hr-tabpanel {
		min-height: 0;
		flex: 1;
	}

	.hr-tabpanel[hidden] {
		display: none;
	}

	.hr-form {
		overflow-y: auto;
	}

	.hr-fields {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 0.75rem;
		padding: 0.75rem;
	}
</style>
