<!--
	MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
	Ported from apps/v4/components/ui/toggle.tsx (Toggle), which wraps the
	Base UI Toggle primitive. Props mirror Base UI: `pressed`,
	`defaultPressed`, `onPressedChange`, `disabled`, plus `variant`/`size`.
	Deliberate API changes vs React:
	- `class` instead of `className` (Svelte / shadcn-svelte convention).
	- `children` is a Svelte snippet instead of ReactNode.
	- Accepts the shared dark-mode contract (`isDark`, `onIsDarkChange`); the
	  parent controls the theme, so `onIsDarkChange` is never invoked here.
	- No `TogglePrimitive` re-export (Base UI is React-only).
-->
<script lang="ts" module>
	export type ToggleVariant = 'default' | 'outline';
	export type ToggleSize = 'default' | 'lg' | 'sm';

	const TOGGLE_BASE =
		'relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg border text-base font-medium whitespace-nowrap text-foreground transition-shadow outline-none select-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-64 data-pressed:bg-input/64 data-pressed:text-accent-foreground sm:text-sm';

	const TOGGLE_SIZES: Record<ToggleSize, string> = {
		default: 'h-9 min-w-9 px-[calc(--spacing(2)-1px)] sm:h-8 sm:min-w-8',
		lg: 'h-10 min-w-10 px-[calc(--spacing(2.5)-1px)] sm:h-9 sm:min-w-9',
		sm: 'h-8 min-w-8 px-[calc(--spacing(1.5)-1px)] sm:h-7 sm:min-w-7'
	};

	const TOGGLE_VARIANTS: Record<ToggleVariant, string> = {
		default: 'border-transparent',
		outline: 'border-input bg-background shadow-xs/5 dark:bg-input/32'
	};

	/** Port of upstream `toggleVariants` (class-variance-authority). */
	export function toggleVariants(options?: {
		variant?: ToggleVariant;
		size?: ToggleSize;
		class?: string;
	}): string {
		const variant = options?.variant ?? 'default';
		const size = options?.size ?? 'default';
		return [TOGGLE_BASE, TOGGLE_SIZES[size], TOGGLE_VARIANTS[variant], options?.class]
			.filter(Boolean)
			.join(' ');
	}
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { DarkModeProps } from '../../dark-mode.js';
	import { cn } from '../../utils.js';
	import { getToggleGroupContext } from './toggle-context.js';

	export interface ToggleProps extends DarkModeProps {
		/** Controlled pressed state. Omit for uncontrolled mode. */
		pressed?: boolean;
		/** Initial pressed state for uncontrolled mode. Defaults to `false`. */
		defaultPressed?: boolean;
		onPressedChange?: (pressed: boolean) => void;
		disabled?: boolean;
		variant?: ToggleVariant;
		size?: ToggleSize;
		/** Item value when used inside a ToggleGroup. */
		value?: string;
		class?: string;
		children?: Snippet;
		[key: string]: unknown;
	}

	let {
		pressed: pressedProp,
		defaultPressed = false,
		onPressedChange,
		disabled = false,
		variant = 'default',
		size = 'default',
		value,
		class: className = '',
		children,
		isDark = false,
		// Shared-contract parity; intentionally unused, the parent owns the theme.
		onIsDarkChange: _onIsDarkChange,
		...rest
	}: ToggleProps = $props();

	const group = getToggleGroupContext();
	const inGroup = $derived(group !== undefined && value !== undefined);

	// Initial capture is intended: uncontrolled state starts from the default.
	// svelte-ignore state_referenced_locally
	let internalPressed = $state(defaultPressed);
	const pressed = $derived(
		inGroup && group ? group.isSelected(value as string) : (pressedProp ?? internalPressed)
	);
	const isDisabled = $derived(disabled || (group?.isDisabled() ?? false));

	function handleClick(event: MouseEvent) {
		if (isDisabled) {
			event.preventDefault();
			return;
		}
		if (inGroup && group) {
			group.toggleValue(value as string);
			return;
		}
		const next = !pressed;
		if (pressedProp === undefined) internalPressed = next;
		onPressedChange?.(next);
	}
</script>

<button
	type="button"
	class={cn(toggleVariants({ variant, size }), className, isDark && 'dark')}
	data-slot="toggle"
	aria-pressed={pressed}
	data-pressed={pressed || undefined}
	disabled={isDisabled}
	onclick={handleClick}
	{...rest}
>
	{@render children?.()}
</button>
