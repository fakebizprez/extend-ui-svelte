// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).

/**
 * Shared dark-mode contract for every ported component.
 *
 * Dark mode stays controlled by the parent: the parent owns the theme state
 * and passes it down through `isDark`. Components reflect it (a `dark` class
 * on their root element, for Tailwind class-based dark mode) and never change
 * it themselves, so `onIsDarkChange` is accepted for contract parity but is
 * only invoked by components that render their own theme switcher control.
 */
export interface DarkModeProps {
	/** Whether the parent renders the tree in dark mode. Defaults to `false`. */
	isDark?: boolean;
	/**
	 * Called when the user changes the theme through a control rendered by the
	 * component itself. Primitives without such a control accept this prop and
	 * never invoke it; the parent remains the source of truth.
	 */
	onIsDarkChange?: (isDark: boolean) => void;
}

/** Default theme when the parent passes no flag: light mode. */
export const DEFAULT_IS_DARK = false;

/** Passes an explicit flag through; falls back to the default when undefined. */
export function resolveIsDark(isDark?: boolean): boolean {
	return isDark ?? DEFAULT_IS_DARK;
}

/**
 * Flips the theme flag (treating undefined as the default), notifies through
 * the callback when one is given, and returns the next value.
 */
export function toggleIsDark(
	isDark: boolean | undefined,
	onIsDarkChange?: (isDark: boolean) => void
): boolean {
	const next = !resolveIsDark(isDark);
	onIsDarkChange?.(next);
	return next;
}
