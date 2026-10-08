// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
// Internal context shared by ToggleGroup and its items. Not part of the public API.
import { getContext, setContext } from 'svelte';

export interface ToggleGroupContext {
	isSelected: (itemValue: string) => boolean;
	toggleValue: (itemValue: string) => void;
	isDisabled: () => boolean;
}

const TOGGLE_GROUP_KEY = Symbol('extend-ui-toggle-group');

/** Computes the next group value. Pure so the selection rules stay testable. */
export function nextGroupValue(current: string[], itemValue: string, multiple: boolean): string[] {
	const selected = current.includes(itemValue);
	if (multiple) {
		return selected ? current.filter((entry) => entry !== itemValue) : [...current, itemValue];
	}
	return selected ? [] : [itemValue];
}

export function setToggleGroupContext(context: ToggleGroupContext): void {
	setContext(TOGGLE_GROUP_KEY, context);
}

export function getToggleGroupContext(): ToggleGroupContext | undefined {
	return getContext<ToggleGroupContext | undefined>(TOGGLE_GROUP_KEY) ?? undefined;
}
