<!--
	MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
	Test-only host: a group of plain items in a keyed each, so tests can reorder
	or rename items after mount. Not exported from the barrel.
-->
<script lang="ts">
	import ToggleGroup from './ToggleGroup.svelte';
	import ToggleGroupItem from './ToggleGroupItem.svelte';

	let { items }: { items: { label: string; value?: string }[] } = $props();
</script>

<ToggleGroup multiple>
	{#each items as item (item.label)}
		<ToggleGroupItem value={item.value}>{item.label}</ToggleGroupItem>
	{/each}
</ToggleGroup>
