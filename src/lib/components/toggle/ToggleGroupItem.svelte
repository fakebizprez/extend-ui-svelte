<!--
	MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
	Ported from apps/v4/components/ui/toggle.tsx (ToggleGroupItem): a Toggle
	that participates in the enclosing ToggleGroup selection and renders the
	`toggle-group-item` data slot.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import Toggle, { type ToggleProps } from './Toggle.svelte';

	export interface ToggleGroupItemProps extends Omit<ToggleProps, 'children' | 'pressed' | 'defaultPressed' | 'onPressedChange'> {
		/** Item value tracked in the group selection. */
		value: string;
		children?: Snippet;
	}

	let { value, children, ...rest }: ToggleGroupItemProps = $props();
</script>

<Toggle {...rest} {value} data-slot="toggle-group-item">
	{@render children?.()}
</Toggle>
