<!-- MIT License — Svelte 5 port of Extend UI schema-builder. Upstream: extend-hq/ui (MIT). -->
<script lang="ts">
	import SchemaBuilder from '#lib/components/schema-builder/SchemaBuilder.svelte';
	import type {
		SchemaBuilderSchema,
		SerializedSchema
	} from '#lib/components/schema-builder/SchemaBuilder.svelte';

	let isDark = $state(false);
	let schema = $state<SchemaBuilderSchema>({
		properties: [
			{ id: 'demo-vendor', key: 'vendor', type: 'string', description: 'Invoice vendor' },
			{ id: 'demo-total', key: 'total', type: 'number', description: '', required: true }
		]
	});
	let serialized = $state<SerializedSchema | null>(null);
</script>

<h1>Schema Builder</h1>
<p>
	Svelte 5 port of the Extend UI schema-builder: a visual JSON-schema field builder with native
	drag-and-drop reorder, nested objects, arrays, enums, required flags, and a live serialized
	output.
</p>

<p>
	<label>
		<input type="checkbox" bind:checked={isDark} />
		Dark mode
	</label>
</p>

<SchemaBuilder
	{schema}
	{isDark}
	onSchemaChange={(next) => (schema = next)}
	onSerializedSchemaChange={(next) => (serialized = next)}
/>

{#if serialized}
	<h2>Emitted schema</h2>
	<pre data-testid="schema-builder-docs-output">{JSON.stringify(serialized, null, 2)}</pre>
{/if}

<section aria-labelledby="differences-from-upstream">
	<h2 id="differences-from-upstream">Differences from upstream</h2>
	<ul>
		<li>
			Exported as both <code>SchemaBuilder</code> and the upstream name
			<code>SchemaBuilderPanel</code>; <code>className</code> and <code>class</code> are both
			accepted.
		</li>
		<li>
			Theme: <code>isDark</code> follows the repo-wide parent-controlled contract. The upstream
			<code>theme</code> prop (<code>"light" | "dark"</code>) is still accepted and wins when
			given; without either, the builder is light (it does not read an app theme).
		</li>
		<li>
			The form and the serialized JSON show side by side instead of in Form and JSON tabs, and
			the JSON is plain text instead of a highlighted code block.
		</li>
		<li>
			Drag-and-drop reorders top-level fields only (native HTML5 drag-and-drop instead of
			dnd-kit). Dragging fields into or out of nested objects, reordering enum values, and
			collapsing nested editors are not ported.
		</li>
		<li>
			The add buttons read <code>Add field</code> and <code>Add nested field</code> instead of
			upstream's <code>Add property</code>.
		</li>
		<li>
			Port additions: a per-field <code>required</code> flag (upstream has none), serialized as a
			<code>required</code> list on its parent object at every level, including array item
			objects; <code>onSerializedSchemaChange</code>; and the <code>Remove field</code> and
			<code>Remove enum value</code> buttons (upstream has no way to remove a field or an enum
			value).
		</li>
		<li>
			<code>SchemaJsonView</code> is exported like upstream, but renders plain preformatted JSON
			instead of the syntax-highlighted, virtualized code file.
		</li>
		<li>
			Port-only exports, the component under its port name, its props type, and the field factory helpers and type lists: <code>SchemaBuilder</code>, <code>SchemaBuilderProps</code>, <code>createSchemaBuilderEnumValue</code>, <code>createSchemaBuilderId</code>, <code>createSchemaBuilderProperty</code>, <code>normalizePropertyForType</code>, <code>SCHEMA_BUILDER_ARRAY_ITEM_TYPES</code>, and <code>SCHEMA_BUILDER_FIELD_TYPES</code>.
		</li>
	</ul>
</section>

<p><a href="/">Back to all components</a></p>
