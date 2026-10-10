<!--
	MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
	Ported from apps/v4/components/ui/color-picker.tsx (ColorPickerPanel): a
	ColorPicker pinned to the inline `panel` variant.
	Deliberate API changes vs React: `class` for `className`, plus the shared
	dark-mode contract (the parent owns the theme).
-->
<script lang="ts">
	import type { DarkModeProps } from '../../dark-mode.js';
	import ColorPicker from './ColorPicker.svelte';

	export interface ColorPickerPanelProps extends DarkModeProps {
		class?: string;
		color: string;
		label: string;
		onChange: (color: string) => void;
		showAlpha?: boolean;
	}

	let {
		class: className = '',
		color,
		label,
		onChange,
		showAlpha = false,
		isDark = false,
		// Shared-contract parity; intentionally unused, the parent owns the theme.
		onIsDarkChange: _onIsDarkChange
	}: ColorPickerPanelProps = $props();
</script>

<ColorPicker
	value={color}
	{label}
	{onChange}
	{showAlpha}
	variant="panel"
	class={className}
	{isDark}
/>
