<!--
	MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
	Ported from apps/v4/components/ui/group.tsx (GroupText).
	Deliberate API changes vs React:
	- `class` instead of `className`; `children` is a Svelte snippet.
	- No `render` prop polymorphism (Base UI `useRender` has no Svelte
	  equivalent); always renders a `div`.
	- Accepts the shared dark-mode contract; the parent owns the theme.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { DarkModeProps } from '../../dark-mode.js';
	import { cn } from '../../utils.js';

	export interface GroupTextProps extends DarkModeProps {
		class?: string;
		children: Snippet;
		[key: string]: unknown;
	}

	let {
		class: className = '',
		children,
		isDark = false,
		// Shared-contract parity; intentionally unused, the parent owns the theme.
		onIsDarkChange: _onIsDarkChange,
		...rest
	}: GroupTextProps = $props();
</script>

<div
	class={cn(
		'relative inline-flex items-center gap-2 rounded-lg border border-input bg-muted px-[calc(--spacing(3)-1px)] text-base whitespace-nowrap text-muted-foreground shadow-xs/5 transition-shadow outline-none sm:text-sm [&_svg]:-mx-0.5 [&_svg]:shrink-0',
		className,
		isDark && 'dark'
	)}
	data-slot="group-text"
	{...rest}
>
	{@render children()}
</div>
