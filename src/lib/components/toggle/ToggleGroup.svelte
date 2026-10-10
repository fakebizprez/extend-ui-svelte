<!--
	MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
	Ported from apps/v4/components/ui/toggle.tsx (ToggleGroup), which wraps the
	Base UI ToggleGroup primitive. Props mirror Base UI: `value`,
	`defaultValue`, `onValueChange`, `multiple`, `disabled`, `orientation`,
	plus upstream's `spacing`.
	Deliberate API changes vs React: `class` for `className`, snippet
	`children`, shared dark-mode contract (parent owns the theme), and no
	`ToggleGroupPrimitive` re-export (Base UI is React-only).
-->
<script lang="ts" module>
	export type ToggleGroupOrientation = 'horizontal' | 'vertical';
	export type ToggleGroupSpacing = 'default' | 'none';

	const GROUP_ORIENTATIONS: Record<ToggleGroupOrientation, string> = {
		horizontal: 'flex-row',
		vertical: 'flex-col'
	};

	const GROUP_SPACINGS: Record<ToggleGroupSpacing, string> = {
		default: 'gap-1',
		none: ''
	};

	/** Port of upstream `toggleGroupVariants` (class-variance-authority). */
	export function toggleGroupVariants(options?: {
		orientation?: ToggleGroupOrientation;
		spacing?: ToggleGroupSpacing;
		class?: string;
	}): string {
		const orientation = options?.orientation ?? 'horizontal';
		const spacing = options?.spacing ?? 'default';
		return ['inline-flex w-fit', GROUP_ORIENTATIONS[orientation], GROUP_SPACINGS[spacing], options?.class]
			.filter(Boolean)
			.join(' ');
	}
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { DarkModeProps } from '../../dark-mode.js';
	import { cn } from '../../utils.js';
	import { groupVariants } from '../group/Group.svelte';
	import { nextGroupValue, setToggleGroupContext } from './toggle-context.js';

	export interface ToggleGroupProps extends DarkModeProps {
		/** Controlled selection. Omit for uncontrolled mode. */
		value?: string[];
		/** Initial selection for uncontrolled mode. Defaults to `[]`. */
		defaultValue?: string[];
		onValueChange?: (value: string[]) => void;
		/** Allow more than one selected item. Defaults to `true`. */
		multiple?: boolean;
		disabled?: boolean;
		orientation?: ToggleGroupOrientation;
		spacing?: ToggleGroupSpacing;
		class?: string;
		children?: Snippet;
		[key: string]: unknown;
	}

	let {
		value: valueProp,
		defaultValue = [],
		onValueChange,
		multiple = true,
		disabled = false,
		orientation = 'horizontal',
		spacing,
		class: className = '',
		children,
		isDark = false,
		// Shared-contract parity; intentionally unused, the parent owns the theme.
		onIsDarkChange: _onIsDarkChange,
		...rest
	}: ToggleGroupProps = $props();

	const resolvedSpacing = $derived(spacing ?? 'default');
	// Initial capture is intended: uncontrolled state starts from the default.
	// svelte-ignore state_referenced_locally
	let internalValue = $state([...defaultValue]);
	const current = $derived(valueProp ?? internalValue);

	function toggleValue(itemValue: string) {
		if (disabled) return;
		const next = nextGroupValue(current, itemValue, multiple);
		if (valueProp === undefined) internalValue = next;
		onValueChange?.(next);
	}

	setToggleGroupContext({
		isSelected: (itemValue) => current.includes(itemValue),
		toggleValue,
		isDisabled: () => disabled
	});
</script>

<div
	class={cn(
		toggleGroupVariants({ orientation, spacing: resolvedSpacing }),
		resolvedSpacing === 'none' && groupVariants({ orientation }),
		'inline-flex',
		className,
		isDark && 'dark'
	)}
	data-orientation={orientation}
	data-slot="toggle-group"
	data-spacing={resolvedSpacing}
	role="group"
	{...rest}
>
	{@render children?.()}
</div>
