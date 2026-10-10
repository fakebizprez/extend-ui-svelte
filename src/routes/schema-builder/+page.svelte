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
	bind:schema
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
			Port additions: a per-field <code>required</code> flag (serialized as
			<code>required</code>), <code>onSerializedSchemaChange</code>, and
			<code>bind:schema</code>.
		</li>
	</ul>
</section>

<p><a href="/">Back to all components</a></p>
