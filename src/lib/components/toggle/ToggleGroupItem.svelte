<!--
	MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
	Ported from apps/v4/components/ui/toggle.tsx (ToggleGroupItem): a Toggle
	that participates in the enclosing ToggleGroup selection and renders the
	`toggle-group-item` data slot.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import Toggle, { type ToggleProps } from './Toggle.svelte';

	// Pick, not Omit: Omit over ToggleProps' index signature drops every named prop.
	export interface ToggleGroupItemProps
		extends Pick<
			ToggleProps,
			'onPressedChange' | 'disabled' | 'variant' | 'size' | 'class' | 'className' | 'isDark' | 'onIsDarkChange'
		> {
		/** Item value tracked in the group selection. Defaults to a generated id, like Base UI. */
		value?: string;
		children?: Snippet;
		[key: string]: unknown;
	}

	let { value, children, ...rest }: ToggleGroupItemProps = $props();
</script>

<Toggle {...rest} {value} data-slot="toggle-group-item">
	{@render children?.()}
</Toggle>
