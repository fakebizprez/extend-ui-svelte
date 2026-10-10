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

<SchemaBuilder
	bind:schema
	bind:isDark
	onSchemaChange={(next) => (schema = next)}
	onSerializedSchemaChange={(next) => (serialized = next)}
	onIsDarkChange={(value) => (isDark = value)}
/>

{#if serialized}
	<h2>Emitted schema</h2>
	<pre data-testid="schema-builder-docs-output">{JSON.stringify(serialized, null, 2)}</pre>
{/if}

<p><a href="/">Back to all components</a></p>
