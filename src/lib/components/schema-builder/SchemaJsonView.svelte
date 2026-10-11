<!--
	MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
	SchemaJsonView: the serialized schema as formatted JSON (apps/v4/components/
	extend/schema-builder.tsx, SchemaJsonView).

	Deliberate changes vs the React version: plain preformatted text instead of
	the syntax-highlighted, virtualized code file.
-->
<script lang="ts">
	import {
		serializeSchema,
		type SchemaBuilderSchema,
		type SchemaBuilderTheme
	} from './SchemaBuilder.svelte';

	interface Props {
		schema: SchemaBuilderSchema;
		theme?: SchemaBuilderTheme;
		/** A new value scrolls the view back to the top, like upstream. */
		scrollResetKey?: string | number;
		class?: string;
	}

	let { schema, theme = 'light', scrollResetKey = 0, class: classProp = '' }: Props = $props();

	const json = $derived(JSON.stringify(serializeSchema(schema), null, 2));
</script>

{#key scrollResetKey}
	<pre
		class={['schema-json-view', theme === 'dark' && 'dark', classProp].filter(Boolean).join(' ')}
		data-theme={theme}
		data-testid="schema-builder-output">{json}</pre>
{/key}

<style>
	.schema-json-view {
		margin: 0;
		overflow: auto;
		max-height: 32rem;
		border: 1px solid var(--color-border, #e5e7eb);
		border-radius: 0.5rem;
		padding: 0.75rem;
		font-size: 0.8rem;
	}
</style>
