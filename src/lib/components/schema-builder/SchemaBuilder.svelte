<!--
	MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
	SchemaBuilder: visual JSON-schema field builder (rewrite of the React version,
	apps/v4/components/extend/schema-builder.tsx, SchemaBuilderPanel).

	Deliberate changes vs the React version:
	- Also exported as the upstream name SchemaBuilderPanel; `className` is an
	  alias of `class`. defaultSchema defaults to SAMPLE_SCHEMA like upstream.
	- Dark mode is parent-controlled (isDark); the upstream `theme` prop is
	  accepted and wins when given. No app-theme lookup, and no theme switch,
	  so onIsDarkChange is never called.
	- Form and serialized JSON render side by side instead of in tabs.
	- Native HTML5 drag-and-drop reorders top-level fields only; nested moves,
	  enum reordering, and collapsible nested editors are not ported.
	- "Add field" / "Add nested field" buttons instead of upstream's "Add property".
	- Port additions: per-field `required` (serialized as `required` on its parent
	  object at every level), onSerializedSchemaChange.
-->
<script module lang="ts">
	export type SchemaBuilderScalarType = 'string' | 'number' | 'integer' | 'boolean' | 'null';
	export type SchemaBuilderFieldType = SchemaBuilderScalarType | 'object' | 'array' | 'enum';
	export type SchemaBuilderArrayScalarType = Exclude<SchemaBuilderScalarType, 'null'>;
	export type SchemaBuilderArrayItemType = SchemaBuilderArrayScalarType | 'object' | 'enum';

	export interface SchemaBuilderEnumValue {
		id: string;
		value: string;
		description: string;
	}

	export interface SchemaBuilderProperty {
		id: string;
		key: string;
		type: SchemaBuilderFieldType;
		description: string;
		required?: boolean;
		enumValues?: SchemaBuilderEnumValue[];
		properties?: SchemaBuilderProperty[];
		items?: {
			type: SchemaBuilderArrayItemType;
			properties?: SchemaBuilderProperty[];
			enumValues?: SchemaBuilderEnumValue[];
		};
	}

	export interface SchemaBuilderSchema {
		properties: SchemaBuilderProperty[];
	}

	/** Upstream theme prop values. */
	export type SchemaBuilderTheme = 'light' | 'dark';

	export interface SerializedSchemaProperty {
		type: string;
		description?: string;
		enum?: string[];
		enumDescriptions?: Record<string, string>;
		properties?: Record<string, SerializedSchemaProperty>;
		required?: string[];
		items?: SerializedSchemaProperty;
	}

	export interface SerializedSchema {
		type: 'object';
		properties: Record<string, SerializedSchemaProperty>;
		required?: string[];
	}

	export const SCHEMA_BUILDER_FIELD_TYPES: SchemaBuilderFieldType[] = [
		'string',
		'number',
		'integer',
		'boolean',
		'null',
		'object',
		'array',
		'enum'
	];

	export const SCHEMA_BUILDER_ARRAY_ITEM_TYPES: SchemaBuilderArrayItemType[] = [
		'string',
		'number',
		'integer',
		'boolean',
		'object',
		'enum'
	];

	/** Upstream's sample bank-statement schema; the default for defaultSchema. */
	export const SAMPLE_SCHEMA: SchemaBuilderSchema = {
		properties: [
			{
				id: 'statement-period',
				key: 'statement_period',
				type: 'string',
				description: 'Date range covered by the bank statement.'
			},
			{
				id: 'account-type',
				key: 'account_type',
				type: 'enum',
				description: 'Account product shown on the statement.',
				enumValues: [
					{
						id: 'account-type-checking',
						value: 'checking',
						description: 'Standard checking account.'
					},
					{
						id: 'account-type-savings',
						value: 'savings',
						description: 'Savings or money market account.'
					}
				]
			},
			{
				id: 'account-holder',
				key: 'account_holder',
				type: 'object',
				description: 'Person or business that owns the account.',
				properties: [
					{
						id: 'holder-name',
						key: 'name',
						type: 'string',
						description: 'Full account holder name.'
					},
					{
						id: 'holder-address',
						key: 'address',
						type: 'object',
						description: 'Mailing address for the account holder.',
						properties: [
							{
								id: 'holder-address-line-1',
								key: 'line_1',
								type: 'string',
								description: 'Street address line.'
							},
							{
								id: 'holder-address-city',
								key: 'city',
								type: 'string',
								description: 'City from the mailing address.'
							}
						]
					}
				]
			},
			{
				id: 'transactions',
				key: 'transactions',
				type: 'array',
				description: 'Posted account activity during the statement period.',
				items: {
					type: 'object',
					properties: [
						{
							id: 'transaction-date',
							key: 'date',
							type: 'string',
							description: 'Posting date for the transaction.'
						},
						{
							id: 'transaction-description',
							key: 'description',
							type: 'string',
							description: 'Statement transaction description.'
						},
						{
							id: 'transaction-amount',
							key: 'amount',
							type: 'number',
							description: 'Signed transaction amount.'
						}
					]
				}
			}
		]
	};

	let nextId = 0;

	export function createSchemaBuilderId(prefix = 'field'): string {
		nextId += 1;
		if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
			return `${prefix}-${crypto.randomUUID()}`;
		}
		return `${prefix}-${Date.now().toString(36)}-${nextId}`;
	}

	export function createSchemaBuilderProperty(
		type: SchemaBuilderFieldType = 'string'
	): SchemaBuilderProperty {
		const base: SchemaBuilderProperty = {
			id: createSchemaBuilderId(),
			key: '',
			type,
			description: ''
		};
		return normalizePropertyForType(base, type);
	}

	export function createSchemaBuilderEnumValue(): SchemaBuilderEnumValue {
		return { id: createSchemaBuilderId('enum'), value: '', description: '' };
	}

	export function normalizePropertyForType(
		property: SchemaBuilderProperty,
		type: SchemaBuilderFieldType
	): SchemaBuilderProperty {
		const base = { ...property, type };
		if (type === 'enum') {
			return {
				...base,
				enumValues: base.enumValues?.length ? base.enumValues : [createSchemaBuilderEnumValue()],
				properties: undefined,
				items: undefined
			};
		}
		if (type === 'object') {
			return {
				...base,
				enumValues: undefined,
				properties: base.properties?.length
					? base.properties
					: [{ ...createSchemaBuilderProperty('string'), key: '' }],
				items: undefined
			};
		}
		if (type === 'array') {
			return {
				...base,
				enumValues: undefined,
				properties: undefined,
				// Like upstream: new arrays hold objects with one blank field.
				items: base.items ?? { type: 'object', properties: [createSchemaBuilderProperty('string')] }
			};
		}
		return { ...base, enumValues: undefined, properties: undefined, items: undefined };
	}

	function serializeProperty(property: SchemaBuilderProperty): SerializedSchemaProperty {
		const description = property.description.trim();
		const base = description ? { description } : {};

		if (property.type === 'enum') {
			const enumValues = property.enumValues ?? [];
			return {
				type: 'string',
				...base,
				enum: enumValues.map((option) => option.value),
				enumDescriptions: Object.fromEntries(
					enumValues
						.filter((option) => option.description.trim())
						.map((option) => [option.value, option.description])
				)
			};
		}

		if (property.type === 'object') {
			return { type: 'object', ...base, ...serializeObject(property.properties ?? []) };
		}

		if (property.type === 'array') {
			const items = property.items ?? { type: 'string' as const };
			if (items.type === 'object') {
				return {
					type: 'array',
					...base,
					items: { type: 'object', ...serializeObject(items.properties ?? []) }
				};
			}
			if (items.type === 'enum') {
				const enumValues = items.enumValues ?? [];
				return {
					type: 'array',
					...base,
					items: {
						type: 'string',
						enum: enumValues.map((option) => option.value),
						enumDescriptions: Object.fromEntries(
							enumValues
								.filter((option) => option.description.trim())
								.map((option) => [option.value, option.description])
						)
					}
				};
			}
			return { type: 'array', ...base, items: { type: items.type } };
		}

		return { type: property.type, ...base };
	}

	function serializeProperties(
		properties: SchemaBuilderProperty[]
	): Record<string, SerializedSchemaProperty> {
		return Object.fromEntries(
			properties
				.filter((property) => property.key.trim())
				.map((property) => [property.key.trim(), serializeProperty(property)])
		);
	}

	// Port addition: per-field required flags serialize at every object level.
	function serializeObject(properties: SchemaBuilderProperty[]): {
		properties: Record<string, SerializedSchemaProperty>;
		required?: string[];
	} {
		const required = properties
			.filter((property) => property.required && property.key.trim())
			.map((property) => property.key.trim());
		return {
			properties: serializeProperties(properties),
			...(required.length > 0 ? { required } : {})
		};
	}

	export function serializeSchema(schema: SchemaBuilderSchema): SerializedSchema {
		return { type: 'object', ...serializeObject(schema.properties) };
	}
</script>

<script lang="ts">
	import { tick, untrack } from 'svelte';

	interface Props {
		/** Uncontrolled starting schema. Defaults to SAMPLE_SCHEMA, like upstream. */
		defaultSchema?: SchemaBuilderSchema;
		/** Controlled schema: the builder renders only this; edits go to onSchemaChange. */
		schema?: SchemaBuilderSchema;
		onSchemaChange?: (schema: SchemaBuilderSchema) => void;
		/** Port addition: called with the serialized JSON schema on every change. */
		onSerializedSchemaChange?: (schema: SerializedSchema) => void;
		/** Parent-controlled dark mode flag. */
		isDark?: boolean;
		/** Accepted for contract parity; the builder renders no theme switch, so it is never called. */
		onIsDarkChange?: (isDark: boolean) => void;
		/** Upstream theme prop; when given it wins over isDark. */
		theme?: SchemaBuilderTheme;
		class?: string;
		/** Alias of `class`, matching the upstream React prop. */
		className?: string;
	}

	let {
		defaultSchema = SAMPLE_SCHEMA,
		schema,
		onSchemaChange,
		onSerializedSchemaChange,
		isDark = false,
		theme,
		class: classProp = '',
		className = ''
	}: Props = $props();

	const dark = $derived(theme ? theme === 'dark' : isDark);

	// Raw: edits replace the schema immutably, so it never holds $state proxies.
	let uncontrolled = $state.raw<SchemaBuilderSchema>(untrack(() => defaultSchema));
	const current = $derived<SchemaBuilderSchema>(schema ?? uncontrolled);
	const serialized = $derived<SerializedSchema>(serializeSchema(current));

	let lastSerializedSource: SchemaBuilderSchema | undefined = undefined;
	$effect(() => {
		const source = current;
		if (source !== lastSerializedSource) {
			lastSerializedSource = source;
			onSerializedSchemaChange?.(serializeSchema(source));
		}
	});

	// Like a React controlled input: after an edit in controlled mode, each field
	// shows what the schema says, so an edit the parent rejected does not linger.
	const controlledFields = new Map<HTMLInputElement | HTMLSelectElement, () => string | boolean>();
	function syncField(read: () => string | boolean) {
		return (node: HTMLInputElement | HTMLSelectElement) => {
			controlledFields.set(node, read);
			return () => controlledFields.delete(node);
		};
	}

	function resyncFields(): void {
		for (const [node, read] of controlledFields) {
			const value = read();
			if (typeof value === 'boolean') {
				if (node instanceof HTMLInputElement && node.checked !== value) node.checked = value;
			} else if (node.value !== value) {
				node.value = value;
			}
		}
	}

	// Like upstream: controlled mode only reports the edit; the parent decides.
	function commit(next: SchemaBuilderSchema): void {
		const plain = $state.snapshot(next) as SchemaBuilderSchema;
		if (schema === undefined) uncontrolled = plain;
		onSchemaChange?.(plain);
		// Runs after the parent's update (if any) has rendered.
		if (schema !== undefined) void tick().then(resyncFields);
	}

	function updateProperties(
		updater: (properties: SchemaBuilderProperty[]) => SchemaBuilderProperty[]
	): void {
		commit({ properties: updater(current.properties) });
	}

	function updatePropertyById(
		properties: SchemaBuilderProperty[],
		id: string,
		update: (property: SchemaBuilderProperty) => SchemaBuilderProperty
	): SchemaBuilderProperty[] {
		return properties.map((property) => {
			if (property.id === id) return update(property);
			let next = property;
			if (property.properties) {
				const nested = updatePropertyById(property.properties, id, update);
				if (nested !== property.properties) next = { ...next, properties: nested };
			}
			if (property.items?.properties) {
				const nested = updatePropertyById(property.items.properties, id, update);
				if (nested !== property.items.properties) {
					next = { ...next, items: { ...property.items, properties: nested } };
				}
			}
			return next === property
				? property
				: { ...next, properties: next.properties, items: next.items };
		});
	}

	function patchProperty(id: string, patch: Partial<SchemaBuilderProperty>): void {
		updateProperties((properties) =>
			updatePropertyById(properties, id, (property) => ({ ...property, ...patch }))
		);
	}

	function setPropertyType(id: string, type: SchemaBuilderFieldType): void {
		updateProperties((properties) =>
			updatePropertyById(properties, id, (property) => normalizePropertyForType(property, type))
		);
	}

	function addField(): void {
		updateProperties((properties) => [...properties, createSchemaBuilderProperty('string')]);
	}

	function addNestedField(parentId: string): void {
		updateProperties((properties) =>
			updatePropertyById(properties, parentId, (property) => ({
				...property,
				properties: [...(property.properties ?? []), createSchemaBuilderProperty('string')]
			}))
		);
	}

	function addArrayItemField(arrayId: string): void {
		updateProperties((properties) =>
			updatePropertyById(properties, arrayId, (property) => ({
				...property,
				items: {
					type: 'object',
					...property.items,
					properties: [...(property.items?.properties ?? []), createSchemaBuilderProperty('string')]
				}
			}))
		);
	}

	function removeProperty(id: string): void {
		const removeFrom = (properties: SchemaBuilderProperty[]): SchemaBuilderProperty[] =>
			properties
				.filter((property) => property.id !== id)
				.map((property) => ({
					...property,
					properties: property.properties ? removeFrom(property.properties) : property.properties,
					items:
						property.items?.properties !== undefined && property.items
							? { ...property.items, properties: removeFrom(property.items.properties) }
							: property.items
				}));
		updateProperties(removeFrom);
	}

	function moveProperty(activeId: string, overId: string): void {
		if (activeId === overId) return;
		updateProperties((properties) => {
			const from = properties.findIndex((property) => property.id === activeId);
			const to = properties.findIndex((property) => property.id === overId);
			if (from === -1 || to === -1) return properties;
			const next = [...properties];
			const [moved] = next.splice(from, 1);
			next.splice(to, 0, moved);
			return next;
		});
	}

	function handleDragStart(event: DragEvent, id: string): void {
		event.dataTransfer?.setData('text/plain', id);
		if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
	}

	function handleDrop(event: DragEvent, overId: string): void {
		event.preventDefault();
		const activeId = event.dataTransfer?.getData('text/plain');
		if (activeId) moveProperty(activeId, overId);
	}

	function setEnumValues(propertyId: string, enumValues: SchemaBuilderEnumValue[]): void {
		patchProperty(propertyId, { enumValues });
	}

	function setArrayItemEnumValues(propertyId: string, enumValues: SchemaBuilderEnumValue[]): void {
		updateProperties((properties) =>
			updatePropertyById(properties, propertyId, (property) => ({
				...property,
				items: { type: 'enum', ...property.items, enumValues }
			}))
		);
	}

	function setArrayItemType(propertyId: string, type: SchemaBuilderArrayItemType): void {
		updateProperties((properties) =>
			updatePropertyById(properties, propertyId, (property) => {
				const previous = property.items;
				if (type === 'object') {
					return {
						...property,
						items: {
							type,
							properties: previous?.properties?.length
								? previous.properties
								: [createSchemaBuilderProperty('string')]
						}
					};
				}
				if (type === 'enum') {
					return {
						...property,
						items: {
							type,
							enumValues: previous?.enumValues?.length
								? previous.enumValues
								: [createSchemaBuilderEnumValue()]
						}
					};
				}
				return { ...property, items: { type } };
			})
		);
	}
</script>

{#snippet enumEditor(
	values: SchemaBuilderEnumValue[],
	onChange: (values: SchemaBuilderEnumValue[]) => void
)}
	<div class="schema-builder-enum" data-testid="schema-builder-enum-editor">
		{#each values as enumValue (enumValue.id)}
			<div class="schema-builder-enum-row" data-testid="schema-builder-enum-value">
				<input
					type="text"
					aria-label="Enum value"
					placeholder="Value"
					value={enumValue.value}
					{@attach syncField(() => enumValue.value)}
					oninput={(event) =>
						onChange(
							values.map((value) =>
								value.id === enumValue.id ? { ...value, value: event.currentTarget.value } : value
							)
						)}
				/>
				<input
					type="text"
					aria-label="Enum description"
					placeholder="Description (optional)"
					value={enumValue.description}
					{@attach syncField(() => enumValue.description)}
					oninput={(event) =>
						onChange(
							values.map((value) =>
								value.id === enumValue.id
									? { ...value, description: event.currentTarget.value }
									: value
							)
						)}
				/>
				<button
					type="button"
					onclick={() => onChange(values.filter((value) => value.id !== enumValue.id))}
				>
					Remove enum value
				</button>
			</div>
		{/each}
		<button type="button" onclick={() => onChange([...values, createSchemaBuilderEnumValue()])}>
			Add enum value
		</button>
	</div>
{/snippet}

{#snippet fieldRows(properties: SchemaBuilderProperty[], nested: boolean)}
	{#each properties as property (property.id)}
		{@const rowTestId = nested ? 'schema-builder-nested-field' : 'schema-builder-field'}
		<div
			class="schema-builder-field"
			role="listitem"
			data-testid={rowTestId}
			data-field-id={property.id}
			draggable={nested ? undefined : true}
			ondragstart={nested ? undefined : (event) => handleDragStart(event, property.id)}
			ondragover={nested ? undefined : (event) => event.preventDefault()}
			ondrop={nested ? undefined : (event) => handleDrop(event, property.id)}
		>
			{#if !nested}
				<span class="schema-builder-drag-handle" aria-hidden="true">⠿</span>
			{/if}
			<input
				type="text"
				aria-label="Field key"
				placeholder="Field name"
				value={property.key}
				{@attach syncField(() => property.key)}
				oninput={(event) => patchProperty(property.id, { key: event.currentTarget.value })}
			/>
			<select
				aria-label="Field type"
				value={property.type}
				{@attach syncField(() => property.type)}
				onchange={(event) =>
					setPropertyType(property.id, event.currentTarget.value as SchemaBuilderFieldType)}
			>
				{#each SCHEMA_BUILDER_FIELD_TYPES as type (type)}
					<option value={type}>{type}</option>
				{/each}
			</select>
			<label>
				<input
					type="checkbox"
					aria-label="Required"
					checked={property.required ?? false}
					{@attach syncField(() => property.required ?? false)}
					onchange={(event) => patchProperty(property.id, { required: event.currentTarget.checked })}
				/>
				Required
			</label>
			<input
				type="text"
				aria-label="Description"
				placeholder="Description (optional)"
				value={property.description}
				{@attach syncField(() => property.description)}
				oninput={(event) => patchProperty(property.id, { description: event.currentTarget.value })}
			/>
			<button type="button" onclick={() => removeProperty(property.id)}>Remove field</button>
			{#if property.type === 'enum'}
				{@render enumEditor(property.enumValues ?? [], (values) => setEnumValues(property.id, values))}
			{:else if property.type === 'object'}
				<div class="schema-builder-nested" data-testid="schema-builder-nested">
					{@render fieldRows(property.properties ?? [], true)}
					<button type="button" onclick={() => addNestedField(property.id)}>
						Add nested field
					</button>
				</div>
			{:else if property.type === 'array'}
				<div class="schema-builder-array" data-testid="schema-builder-array-editor">
					<label>
						Array item type
						<select
							aria-label="Array item type"
							value={property.items?.type ?? 'string'}
							{@attach syncField(() => property.items?.type ?? 'string')}
							onchange={(event) =>
								setArrayItemType(
									property.id,
									event.currentTarget.value as SchemaBuilderArrayItemType
								)}
						>
							{#each SCHEMA_BUILDER_ARRAY_ITEM_TYPES as itemType (itemType)}
								<option value={itemType}>{itemType}</option>
							{/each}
						</select>
					</label>
					{#if property.items?.type === 'object'}
						{@render fieldRows(property.items.properties ?? [], true)}
						<button type="button" onclick={() => addArrayItemField(property.id)}>
							Add nested field
						</button>
					{:else if property.items?.type === 'enum'}
						{@render enumEditor(property.items.enumValues ?? [], (values) =>
							setArrayItemEnumValues(property.id, values)
						)}
					{/if}
				</div>
			{/if}
		</div>
	{/each}
{/snippet}

<section
	data-testid="schema-builder"
	data-theme={dark ? 'dark' : 'light'}
	class={['schema-builder', dark && 'dark', classProp, className].filter(Boolean).join(' ')}
>
	<header class="schema-builder-header">
		<h2>Schema Builder</h2>
	</header>

	<div class="schema-builder-body">
		<div class="schema-builder-fields" data-testid="schema-builder-fields">
			{#if current.properties.length === 0}
				<p data-testid="schema-builder-empty">No fields yet. Add the first field to begin.</p>
			{/if}
			{@render fieldRows(current.properties, false)}
			<button type="button" onclick={addField}>Add field</button>
		</div>

		<pre
			class="schema-builder-output"
			data-testid="schema-builder-output">{JSON.stringify(serialized, null, 2)}</pre>
	</div>
</section>

<style>
	.schema-builder {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		border: 1px solid var(--color-border, #e5e7eb);
		border-radius: 0.75rem;
		padding: 1rem;
		background: var(--color-surface, #fff);
		color: var(--color-foreground, #111);
	}
	.schema-builder.dark {
		--color-border: #3f3f46;
		--color-surface: #18181b;
		--color-foreground: #fafafa;
	}
	.schema-builder-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.schema-builder-header h2 {
		margin: 0;
		font-size: 1rem;
	}
	.schema-builder-body {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
	}
	.schema-builder-fields {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.schema-builder-field {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: center;
		border: 1px solid var(--color-border, #e5e7eb);
		border-radius: 0.5rem;
		padding: 0.5rem;
	}
	.schema-builder-drag-handle {
		cursor: grab;
		user-select: none;
	}
	.schema-builder-nested,
	.schema-builder-array,
	.schema-builder-enum {
		flex-basis: 100%;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding-left: 1rem;
		border-left: 2px solid var(--color-border, #e5e7eb);
	}
	.schema-builder-enum-row {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}
	.schema-builder-output {
		margin: 0;
		overflow: auto;
		max-height: 32rem;
		border: 1px solid var(--color-border, #e5e7eb);
		border-radius: 0.5rem;
		padding: 0.75rem;
		font-size: 0.8rem;
	}
</style>
