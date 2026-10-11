<!--
	MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
	Test-only composition host for ToggleGroup interaction tests: snippets in
	unit tests cannot instantiate components, so group behaviour is exercised
	through this host. Not exported from the barrel.
-->
<script lang="ts">
	import ToggleGroup, { type ToggleGroupProps } from './ToggleGroup.svelte';
	import ToggleGroupItem, { type ToggleGroupItemProps } from './ToggleGroupItem.svelte';

	interface HarnessItem {
		value: string;
		label: string;
		disabled?: boolean;
	}

	let {
		itemClassName,
		itemOnclick,
		itemOnPressedChange,
		items = [
			{ value: 'bold', label: 'Bold' },
			{ value: 'italic', label: 'Italic' }
		],
		...rest
	}: ToggleGroupProps & {
		itemClassName?: string;
		itemOnclick?: (event: MouseEvent) => void;
		itemOnPressedChange?: ToggleGroupItemProps['onPressedChange'];
		items?: HarnessItem[];
	} = $props();
</script>

<ToggleGroup {...rest}>
	{#each items as item (item.value)}
		<ToggleGroupItem value={item.value} disabled={item.disabled} className={itemClassName}
			onclick={itemOnclick}
			onPressedChange={itemOnPressedChange}
		>
			{item.label}
		</ToggleGroupItem>
	{/each}
</ToggleGroup>
