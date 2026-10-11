<!--
	MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
	Ported from apps/v4/components/ui/toggle.tsx (ToggleGroup), which wraps the
	Base UI ToggleGroup primitive. Props mirror Base UI: `value`,
	`defaultValue`, `onValueChange`, `multiple` (default false), `loopFocus`,
	`disabled`, `orientation`, plus upstream's `spacing`.
	Deliberate API changes vs React: `class` and `className` are both
	accepted, snippet `children`, shared dark-mode contract (parent owns the
	theme), and no `ToggleGroupPrimitive` re-export (Base UI is React-only).
	Like Base UI 1.4.1, the group is one Tab stop (the last focused item, else
	the first in DOM order; a disabled first item passes it on) and arrow
	keys, Home, and End move focus inside it. Keys held with Shift, Control,
	Alt, or Meta are left alone, and only a key that moves focus is consumed
	(preventDefault + stopPropagation).
	`onPressedChange` and `onValueChange` get Base UI-style event details
	(`cancel()` skips the change). A consumer `onkeydown` runs before
	the built-in navigation; `event.preventDefault()` stands in for Base UI's
	`preventBaseUIHandler()`.
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
	import {
		findTabStop,
		nextGroupValue,
		setToggleGroupContext,
		type RegisteredItem,
		type ToggleChangeEventDetails
	} from './toggle-context.js';

	export interface ToggleGroupProps extends DarkModeProps {
		/** Controlled selection. Omit for uncontrolled mode. */
		value?: string[];
		/** Initial selection for uncontrolled mode. Defaults to `[]`. */
		defaultValue?: string[];
		/** `details.cancel()` keeps the current selection. */
		onValueChange?: (value: string[], details: ToggleChangeEventDetails) => void;
		/** Allow more than one selected item. Defaults to `false`, like Base UI. */
		multiple?: boolean;
		/** Loop arrow-key focus from the last item back to the first. Defaults to `true`. */
		loopFocus?: boolean;
		disabled?: boolean;
		orientation?: ToggleGroupOrientation;
		spacing?: ToggleGroupSpacing;
		class?: string;
		/** Alias of `class`, matching the upstream React prop name. Both are merged. */
		className?: string;
		children?: Snippet;
		[key: string]: unknown;
	}

	let {
		value: valueProp,
		defaultValue = [],
		onValueChange,
		multiple = false,
		loopFocus = true,
		disabled = false,
		orientation = 'horizontal',
		spacing,
		class: className = '',
		className: classNameAlias = '',
		children,
		onkeydown,
		isDark = false,
		// Shared-contract parity; intentionally unused, the parent owns the theme.
		onIsDarkChange: _onIsDarkChange,
		...rest
	}: ToggleGroupProps = $props();

	const resolvedSpacing = $derived(spacing ?? 'default');
	// Initial capture is intended: uncontrolled state starts from the default.
	let internalValue = $state([...defaultValue]);
	const current = $derived(valueProp ?? internalValue);

	function toggleValue(itemValue: string, details: ToggleChangeEventDetails) {
		if (disabled) return;
		const next = nextGroupValue(current, itemValue, multiple);
		onValueChange?.(next, details);
		if (details.isCanceled) return;
		if (valueProp === undefined) internalValue = next;
	}

	// Arrow keys move focus between enabled items along the group's axis, like
	// Base UI's composite toggle group. Home and End jump to the ends.
	// The consumer handler runs first, like Base UI's mergeProps; preventDefault()
	// stands in for preventBaseUIHandler() to skip ours.
	function handleKeyDown(event: KeyboardEvent) {
		(onkeydown as ((event: KeyboardEvent) => void) | undefined)?.(event);
		if (event.defaultPrevented) return;
		// Like Base UI's composite root: leave shortcuts such as Alt+Left alone.
		if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;
		const root = event.currentTarget as HTMLElement;
		const items = Array.from(
			root.querySelectorAll<HTMLButtonElement>('[data-slot="toggle-group-item"]:not(:disabled)')
		);
		const index = items.indexOf(document.activeElement as HTMLButtonElement);
		if (index < 0) return;
		const [prevKey, nextKey] =
			orientation === 'vertical' ? ['ArrowUp', 'ArrowDown'] : ['ArrowLeft', 'ArrowRight'];
		let next = index;
		if (event.key === nextKey) next = index + 1;
		else if (event.key === prevKey) next = index - 1;
		else if (event.key === 'Home') next = 0;
		else if (event.key === 'End') next = items.length - 1;
		else return;
		if (loopFocus) next = (next + items.length) % items.length;
		next = Math.min(Math.max(next, 0), items.length - 1);
		// Only a key that moves focus is consumed, as in Base UI.
		if (next === index) return;
		event.preventDefault();
		event.stopPropagation();
		items[next]?.focus();
	}

	// Roving tab stop, like Base UI's composite group: Tab enters the group
	// once, on the stop, and arrow keys move focus (and the stop) inside it.
	let items = $state.raw<RegisteredItem[]>([]);
	let focusedValue = $state<string | undefined>(undefined);
	// Keyed each blocks move buttons without touching any state, so watch the
	// DOM: after a reorder the stop goes to the new first item, as in Base UI.
	let rootEl = $state<HTMLDivElement | undefined>(undefined);
	let domVersion = $state(0);
	$effect(() => {
		if (!rootEl) return;
		const observer = new MutationObserver(() => (domVersion += 1));
		observer.observe(rootEl, { childList: true, subtree: true });
		return () => observer.disconnect();
	});
	const tabStop = $derived((void domVersion, findTabStop(items, focusedValue)));

	setToggleGroupContext({
		isSelected: (itemValue) => current.includes(itemValue),
		toggleValue,
		isDisabled: () => disabled,
		register: (itemValue, isDisabled, element) => {
			const item = { value: itemValue, isDisabled, element };
			items = [...items, item];
			return () => {
				items = items.filter((entry) => entry !== item);
			};
		},
		isTabStop: (itemValue) => itemValue === tabStop,
		setFocused: (itemValue) => {
			focusedValue = itemValue;
		}
	});
</script>

<div
	class={cn(
		toggleGroupVariants({ orientation, spacing: resolvedSpacing }),
		resolvedSpacing === 'none' && groupVariants({ orientation }),
		'inline-flex',
		className,
		classNameAlias,
		isDark && 'dark'
	)}
	data-orientation={orientation}
	data-multiple={multiple ? '' : undefined}
	data-disabled={disabled ? '' : undefined}
	data-slot="toggle-group"
	data-spacing={resolvedSpacing}
	role="group"
	bind:this={rootEl}
	onkeydown={handleKeyDown}
	{...rest}
>
	{@render children?.()}
</div>
