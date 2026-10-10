<!--
	MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
	Ported from apps/v4/components/ui/group.tsx (Group).
	Deliberate API changes vs React:
	- `class` instead of `className` (Svelte / shadcn-svelte convention).
	- `children` is a Svelte snippet instead of ReactNode.
	- Accepts the shared dark-mode contract (`isDark`, `onIsDarkChange`); the
	  parent controls the theme, so `onIsDarkChange` is never invoked here.
-->
<script lang="ts" module>
	export type GroupOrientation = 'horizontal' | 'vertical';

	const GROUP_BASE =
		'flex w-fit *:focus-visible:z-1 *:has-focus-visible:z-1 has-[>[data-slot=group]]:gap-2';

	const GROUP_ORIENTATIONS: Record<GroupOrientation, string> = {
		horizontal:
			'*:data-slot:has-[~[data-slot]]:rounded-e-none *:data-slot:has-[~[data-slot]]:border-e-0 *:[[data-slot]~[data-slot]]:rounded-s-none *:[[data-slot]~[data-slot]]:border-s-0',
		vertical:
			'flex-col *:data-slot:has-[~[data-slot]]:rounded-b-none *:data-slot:has-[~[data-slot]]:border-b-0 *:[[data-slot]~[data-slot]]:rounded-t-none *:[[data-slot]~[data-slot]]:border-t-0'
	};

	/** Port of upstream `groupVariants` (class-variance-authority). Defaults to horizontal. */
	export function groupVariants(options?: {
		orientation?: GroupOrientation;
		class?: string;
	}): string {
		const orientation = options?.orientation ?? 'horizontal';
		return [GROUP_BASE, GROUP_ORIENTATIONS[orientation], options?.class]
			.filter(Boolean)
			.join(' ');
	}
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { DarkModeProps } from '../../dark-mode.js';
	import { cn } from '../../utils.js';

	export interface GroupProps extends DarkModeProps {
		orientation?: GroupOrientation;
		class?: string;
		children: Snippet;
		[key: string]: unknown;
	}

	let {
		orientation,
		class: className = '',
		children,
		isDark = false,
		// Accepted for shared-contract parity but intentionally unused: the
		// parent owns the theme, so this primitive never invokes the callback.
		onIsDarkChange: _onIsDarkChange,
		...rest
	}: GroupProps = $props();
</script>

<div
	class={cn(groupVariants({ orientation }), className, isDark && 'dark')}
	data-orientation={orientation}
	data-slot="group"
	role="group"
	{...rest}
>
	{@render children()}
</div>
