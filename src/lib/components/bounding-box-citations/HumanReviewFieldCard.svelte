<!--
	MIT License — Svelte 5 port of Extend UI bounding-box-citations. Upstream: extend-hq/ui (MIT).
	Port of upstream HumanReviewFieldCard: one schema field with its actual
	value beside an editable expected value, per-field undo and Set to NULL,
	nested cards for object properties, and paired Actual/Expected grids for
	arrays whose drill-in and selection stay in sync.
-->
<script lang="ts">
	import {
		getObjectValue,
		getReviewFieldLocation,
		type JsonPrimitive,
		type JsonValue,
		type ReviewField,
		type ReviewFieldSchema,
		type ReviewLocation
	} from './citations.js';
	import HumanReviewArrayGrid from './HumanReviewArrayGrid.svelte';
	import HumanReviewFieldCard from './HumanReviewFieldCard.svelte';
	import ReviewIcon, { type ReviewIconName } from './ReviewIcon.svelte';
	import {
		formatValue,
		getPrimitiveValue,
		jsonValuesEqual,
		setObjectValue,
		type ArrayNestedView,
		type ArrayReviewSide,
		type GridItem
	} from './review.js';

	interface Props {
		field: ReviewField;
		value: JsonValue;
		originalValue: JsonValue;
		active?: boolean;
		activeFieldKey?: string;
		readOnly?: boolean;
		showExpected?: boolean;
		onChange: (value: JsonValue) => void;
		onFieldFocus?: (field: ReviewField) => void;
		onLocationHover?: (location?: ReviewLocation) => void;
		onUndo: () => void;
		onSetNull: () => void;
		resolveArrayItemMetadataPath?: (
			metadataPath: string,
			rowIndex: number,
			rowValue: JsonValue
		) => string | undefined;
		resolveLocation?: (metadataPath: string) => ReviewLocation | undefined;
	}

	let {
		field,
		value,
		originalValue,
		active = false,
		activeFieldKey,
		readOnly = false,
		showExpected = true,
		onChange,
		onFieldFocus,
		onLocationHover,
		onUndo,
		onSetNull,
		resolveArrayItemMetadataPath,
		resolveLocation
	}: Props = $props();

	let syncedNested: { activeSide: ArrayReviewSide | null; stack: ArrayNestedView[] } = $state.raw({
		activeSide: null,
		stack: []
	});
	let syncedSelection: { activeSide: ArrayReviewSide | null; depth: number; cell: GridItem | null } =
		$state.raw({ activeSide: null, depth: 0, cell: null });

	const isExpectedEditable = $derived(showExpected && !readOnly);
	const modified = $derived(showExpected && !jsonValuesEqual(value, originalValue));
	const propertyEntries = $derived(Object.entries(field.schema.properties ?? {}));
	const title = $derived(field.schema.title ?? field.key);
	const icon: ReviewIconName = $derived(
		field.schema.type === 'number' || field.schema.type === 'integer'
			? 'hash'
			: field.schema.type === 'boolean'
				? 'captions'
				: field.schema.type === 'array'
					? 'brackets'
					: field.schema.type === 'object'
						? 'square-code'
						: 'text-cursor-input'
	);

	function focusAndHoverField(): void {
		onFieldFocus?.(field);
		onLocationHover?.(getReviewFieldLocation(field, resolveLocation));
	}

	function updateSyncedNested(stack: ArrayNestedView[], side: ArrayReviewSide): void {
		syncedNested = { activeSide: stack.length ? side : null, stack };
	}

	function updateSyncedSelection(cell: GridItem | null, side: ArrayReviewSide, depth: number): void {
		syncedSelection = { activeSide: cell ? side : null, depth, cell };
	}

	function childField(propertyKey: string, schema: ReviewFieldSchema): ReviewField {
		return {
			key: `${field.key}.${propertyKey}`,
			schema,
			actual: getObjectValue(field.actual, propertyKey),
			expected: getObjectValue(originalValue, propertyKey),
			metadataPath: `${field.metadataPath ?? field.key}.${propertyKey}`
		};
	}
</script>

{#snippet valueInput(schema: ReviewFieldSchema, current: JsonPrimitive)}
	{@const label = `Expected ${field.key}`}
	{#if schema.enum?.length}
		<span class="hr-select">
			<select
				aria-label={label}
				disabled={readOnly}
				value={current === null ? '' : String(current)}
				onchange={(event) => onChange(event.currentTarget.value)}
			>
				{#each schema.enum as option (String(option))}
					<option value={String(option)}>{String(option)}</option>
				{/each}
			</select>
		</span>
	{:else if schema.type === 'number' || schema.type === 'integer'}
		<input
			class="hr-input"
			type="number"
			aria-label={label}
			readonly={readOnly}
			value={current === null ? '' : String(current)}
			oninput={(event) => {
				const next = event.currentTarget.value;
				onChange(next === '' ? null : Number(next));
			}}
		/>
	{:else if schema.type === 'boolean'}
		<div class="hr-bool" role="group" aria-label={label}>
			{#each [true, false] as option (option)}
				<button
					type="button"
					class={`hr-bool-option${current === option ? ' on' : ''}`}
					aria-pressed={current === option}
					disabled={readOnly}
					onclick={() => onChange(option)}
				>
					{option ? 'True' : 'False'}
				</button>
			{/each}
		</div>
	{:else}
		<input
			class="hr-input"
			aria-label={label}
			readonly={readOnly}
			value={current === null ? '' : String(current)}
			oninput={(event) => onChange(event.currentTarget.value)}
		/>
	{/if}
{/snippet}

<!-- svelte-ignore a11y_no_noninteractive_tabindex: cards are focusable like upstream so keyboard focus syncs the PDF highlight. -->
<div
	class={`hr-card${active ? ' active' : ''}`}
	role="group"
	tabindex="0"
	aria-label={title}
	data-review-field={field.key}
	data-active={String(active)}
	data-modified={String(modified)}
	onfocusincapture={focusAndHoverField}
	onmouseenter={focusAndHoverField}
	onmouseleave={() => onLocationHover?.(undefined)}
>
	<div class="hr-card-head">
		<div class="hr-card-titles">
			<div class="hr-card-title-row">
				<div class="hr-card-title">{title}</div>
				<span class={`hr-dot${modified ? ' on' : ''}`} aria-hidden="true"></span>
			</div>
			<div class="hr-card-key">{field.key}</div>
		</div>
		<div class="hr-card-actions">
			{#if isExpectedEditable && modified}
				<button
					type="button"
					class="hr-icon-btn"
					aria-label={`Undo ${field.key}`}
					data-tooltip="Revert changes"
					onclick={onUndo}
				>
					<ReviewIcon name="undo" />
				</button>
			{/if}
			{#if isExpectedEditable}
				<button
					type="button"
					class="hr-icon-btn"
					aria-label={`Set ${field.key} to null`}
					data-tooltip="Set to NULL"
					onclick={onSetNull}
				>
					<ReviewIcon name="circle-x" />
				</button>
			{/if}
			<div class="hr-type">
				<ReviewIcon name={icon} size={14} />
				{field.schema.type}
			</div>
		</div>
	</div>
	{#if field.schema.type === 'object'}
		<div class="hr-props">
			<div class="hr-props-head">
				<span>Properties</span>
				<span>{propertyEntries.length} fields</span>
			</div>
			<div class="hr-stack">
				{#each propertyEntries as [propertyKey, schema] (propertyKey)}
					{@const child = childField(propertyKey, schema)}
					<HumanReviewFieldCard
						field={child}
						value={getObjectValue(value, propertyKey)}
						originalValue={child.expected}
						active={child.key === activeFieldKey}
						{activeFieldKey}
						{readOnly}
						{showExpected}
						onChange={(childValue) => onChange(setObjectValue(value, propertyKey, childValue))}
						{onFieldFocus}
						{onLocationHover}
						onUndo={() => onChange(setObjectValue(value, propertyKey, child.expected))}
						onSetNull={() => onChange(setObjectValue(value, propertyKey, null))}
						{resolveArrayItemMetadataPath}
						{resolveLocation}
					/>
				{:else}
					<div class="hr-empty">No properties</div>
				{/each}
			</div>
		</div>
	{:else if field.schema.type === 'array'}
		<div class="hr-stack">
			<HumanReviewArrayGrid
				activeNestedSide={syncedNested.activeSide}
				activeSelectionSide={syncedSelection.activeSide}
				label="Actual"
				metadataPath={field.metadataPath ?? field.key}
				readOnly
				{resolveArrayItemMetadataPath}
				{resolveLocation}
				schema={field.schema}
				selectionDepth={syncedSelection.depth}
				sharedSelection={syncedSelection.cell}
				sharedNestedStack={syncedNested.stack}
				value={field.actual}
				viewSide="actual"
				onSelectionChange={updateSyncedSelection}
				{onLocationHover}
				onNestedStackChange={updateSyncedNested}
			/>
			{#if showExpected}
				<HumanReviewArrayGrid
					activeNestedSide={syncedNested.activeSide}
					activeSelectionSide={syncedSelection.activeSide}
					label="Expected"
					metadataPath={field.metadataPath ?? field.key}
					{readOnly}
					{resolveArrayItemMetadataPath}
					{resolveLocation}
					schema={field.schema}
					selectionDepth={syncedSelection.depth}
					sharedSelection={syncedSelection.cell}
					sharedNestedStack={syncedNested.stack}
					{value}
					viewSide="expected"
					{onChange}
					onSelectionChange={updateSyncedSelection}
					{onLocationHover}
					onNestedStackChange={updateSyncedNested}
				/>
			{/if}
		</div>
	{:else}
		<div class={`hr-pair${showExpected ? ' two' : ''}`}>
			<div class="hr-side">
				{#if field.schema.description}
					<p class="hr-description">{field.schema.description}</p>
				{/if}
				<div class="hr-side-label">Actual</div>
				<div class="hr-actual">{formatValue(field.actual)}</div>
			</div>
			{#if showExpected}
				<div class="hr-side">
					<div class="hr-side-label">Expected</div>
					{@render valueInput(field.schema, getPrimitiveValue(value))}
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.hr-card {
		border: 1px solid var(--hr-border);
		border-radius: 10px;
		background: var(--hr-bg);
		padding: 0.75rem;
		outline: none;
		transition:
			border-color 150ms,
			background-color 150ms,
			box-shadow 150ms;
	}

	.hr-card:hover,
	.hr-card:focus-within {
		border-color: rgb(59 130 246 / 0.5);
		background: rgb(59 130 246 / 0.05);
	}

	.hr-card:focus-visible {
		box-shadow: 0 0 0 2px rgb(59 130 246 / 0.2);
	}

	.hr-card.active {
		border-color: rgb(59 130 246 / 0.6);
		background: rgb(59 130 246 / 0.05);
		box-shadow: 0 0 0 1px rgb(59 130 246 / 0.08);
	}

	.hr-card-head {
		display: flex;
		min-height: 2rem;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.75rem;
		margin-bottom: 0.75rem;
	}

	.hr-card-titles {
		min-width: 0;
	}

	.hr-card-title-row {
		display: flex;
		min-width: 0;
		align-items: center;
		gap: 0.5rem;
	}

	.hr-card-title,
	.hr-card-key {
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}

	.hr-card-title {
		font-size: 14px;
		font-weight: 500;
	}

	.hr-card-key {
		color: var(--hr-muted-fg);
		font-size: 12px;
	}

	.hr-dot {
		width: 8px;
		height: 8px;
		flex: none;
		border-radius: 999px;
		background: #fbbf24;
		opacity: 0;
	}

	.hr-dot.on {
		opacity: 1;
	}

	.hr-card-actions {
		display: flex;
		flex: none;
		align-items: center;
		gap: 0.25rem;
	}

	.hr-icon-btn {
		position: relative;
		display: inline-flex;
		width: 32px;
		height: 32px;
		align-items: center;
		justify-content: center;
		border: none;
		border-radius: 8px;
		background: transparent;
		color: var(--hr-muted-fg);
		cursor: pointer;
	}

	.hr-icon-btn:hover {
		background: var(--hr-muted);
		color: var(--hr-fg);
	}

	.hr-icon-btn:focus-visible {
		outline: 2px solid rgb(59 130 246 / 0.5);
	}

	.hr-icon-btn[data-tooltip]:hover::after,
	.hr-icon-btn[data-tooltip]:focus-visible::after {
		content: attr(data-tooltip);
		position: absolute;
		bottom: calc(100% + 6px);
		left: 50%;
		z-index: 20;
		transform: translateX(-50%);
		border-radius: 6px;
		background: var(--hr-fg);
		padding: 0.25rem 0.5rem;
		color: var(--hr-bg);
		font-size: 12px;
		white-space: nowrap;
		pointer-events: none;
	}

	.hr-type {
		display: flex;
		height: 24px;
		align-items: center;
		gap: 0.25rem;
		border: 1px solid var(--hr-border);
		border-radius: 8px;
		background: var(--hr-muted-half);
		padding: 0 0.375rem;
		color: var(--hr-muted-fg);
		font-size: 12px;
	}

	.hr-props {
		border: 1px solid var(--hr-border);
		border-radius: 8px;
		background: var(--hr-muted-quarter);
		padding: 0.5rem;
	}

	.hr-props-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		margin-bottom: 0.5rem;
		color: var(--hr-muted-fg);
		font-size: 11px;
		font-weight: 500;
	}

	.hr-stack {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 0.5rem;
	}

	.hr-pair {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 0.5rem;
	}

	@media (min-width: 640px) {
		.hr-pair.two {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	.hr-side {
		min-width: 0;
		border: 1px solid var(--hr-border);
		border-radius: 8px;
		background: var(--hr-muted-third);
		padding: 0.5rem;
	}

	.hr-description {
		margin: 0 0 0.5rem;
		color: var(--hr-muted-fg);
		font-size: 12px;
	}

	.hr-side-label {
		margin-bottom: 0.25rem;
		color: var(--hr-muted-fg);
		font-size: 11px;
		font-weight: 500;
	}

	.hr-actual {
		min-height: 1.75rem;
		box-sizing: border-box;
		overflow-wrap: anywhere;
		white-space: pre-wrap;
		border-radius: 8px;
		background: var(--hr-bg);
		padding: 0.375rem 0.5rem;
		font-size: 14px;
	}

	.hr-input,
	.hr-select select {
		box-sizing: border-box;
		width: 100%;
		height: 30px;
		border: 1px solid var(--hr-input);
		border-radius: 10px;
		background: var(--hr-input-bg);
		box-shadow: 0 1px 2px rgb(0 0 0 / 0.05);
		padding: 0 0.75rem;
		color: var(--hr-fg);
		font: inherit;
		font-size: 14px;
		outline: none;
	}

	.hr-input:focus-visible,
	.hr-select select:focus-visible {
		border-color: var(--hr-ring);
		box-shadow: 0 0 0 3px var(--hr-ring-soft);
	}

	.hr-select {
		display: inline-flex;
		width: 100%;
	}

	.hr-select select {
		appearance: none;
	}

	.hr-bool {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.25rem;
		border-radius: 10px;
		background: var(--hr-muted);
		padding: 2px;
	}

	.hr-bool-option {
		height: 28px;
		border: 1px solid transparent;
		border-radius: 8px;
		background: transparent;
		color: var(--hr-fg);
		font: inherit;
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
	}

	.hr-bool-option.on {
		border-color: var(--hr-border);
		background: var(--hr-bool-on);
	}

	.hr-bool-option:disabled {
		cursor: default;
		opacity: 0.64;
	}

	.hr-empty {
		border-radius: 8px;
		background: var(--hr-bg);
		padding: 0.375rem 0.5rem;
		color: var(--hr-muted-fg);
		font-size: 14px;
	}
</style>
