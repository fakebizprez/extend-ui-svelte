<!--
	MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
	Test-only composition host for ToggleGroup interaction tests: snippets in
	unit tests cannot instantiate components, so group behaviour is exercised
	through this host. Not exported from the barrel.
-->
<script lang="ts">
	import ToggleGroup, { type ToggleGroupProps } from './ToggleGroup.svelte';
	import ToggleGroupItem from './ToggleGroupItem.svelte';

	let { ...rest }: ToggleGroupProps = $props();
</script>

<ToggleGroup {...rest}>
	<ToggleGroupItem value="bold">Bold</ToggleGroupItem>
	<ToggleGroupItem value="italic">Italic</ToggleGroupItem>
</ToggleGroup>
