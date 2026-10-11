<!-- MIT License — Svelte 5 port of Extend UI schema-builder. Upstream: extend-hq/ui (MIT). -->
<!-- Test page: a controlled builder whose parent ignores every change. -->
<script lang="ts">
	import { docsTheme } from '../../_shell/theme.svelte.js';
	import SchemaBuilder from '#lib/components/schema-builder/SchemaBuilder.svelte';
	import type { SchemaBuilderSchema } from '#lib/components/schema-builder/SchemaBuilder.svelte';

	const schema: SchemaBuilderSchema = {
		properties: [{ id: 'fixed', key: 'vendor', type: 'string', description: '' }]
	};
	let rejected = $state(0);
</script>

<h1>Schema Builder, rejected edits</h1>
<SchemaBuilder {schema} onSchemaChange={() => (rejected += 1)} isDark={docsTheme.isDark} />
<p data-testid="rejected-count">Rejected edits: {rejected}</p>
