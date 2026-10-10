<!--
	MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
	Ported from apps/v4/components/ui/group.tsx (GroupSeparator) and the
	new-york-v4 separator it wraps.
	Deliberate API changes vs React:
	- `class` and `className` are both accepted and merged onto the root.
	- Accepts the shared dark-mode contract; the parent owns the theme.
-->
<script lang="ts">
	import type { DarkModeProps } from '../../dark-mode.js';
	import { cn } from '../../utils.js';

	export type GroupSeparatorOrientation = 'horizontal' | 'vertical';

	export interface GroupSeparatorProps extends DarkModeProps {
		orientation?: GroupSeparatorOrientation;
		class?: string;
		/** Alias of `class`, matching the upstream React prop name. Both are merged. */
		className?: string;
		[key: string]: unknown;
	}

	let {
		orientation = 'vertical',
		class: className = '',
		className: classNameAlias = '',
		isDark = false,
		// Shared-contract parity; intentionally unused, the parent owns the theme.
		onIsDarkChange: _onIsDarkChange,
		...rest
	}: GroupSeparatorProps = $props();
</script>

<div
	class={cn(
		'shrink-0 bg-border data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:w-px data-[orientation=vertical]:self-stretch',
		'pointer-events-none relative z-2 bg-input',
		className,
		classNameAlias,
		isDark && 'dark'
	)}
	data-orientation={orientation}
	data-slot="separator"
	aria-orientation={orientation}
	role="separator"
	{...rest}
></div>
