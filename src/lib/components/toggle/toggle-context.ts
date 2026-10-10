// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
// Internal context shared by ToggleGroup and its items. Not part of the public API.
import { getContext, setContext } from 'svelte';

export interface ToggleGroupContext {
	isSelected: (itemValue: string) => boolean;
	toggleValue: (itemValue: string) => void;
	isDisabled: () => boolean;
	/** Registers an item in DOM order; returns the unregister function. */
	register: (itemValue: string, isDisabled: () => boolean) => () => void;
	/** Whether this item is the group's single Tab stop. */
	isTabStop: (itemValue: string) => boolean;
	/** Moves the Tab stop to the focused item. */
	setFocused: (itemValue: string) => void;
}

export interface RegisteredItem {
	value: string;
	isDisabled: () => boolean;
}

/**
 * The group's single Tab stop: the last focused enabled item, else the first
 * pressed enabled item, else the first enabled item.
 */
export function findTabStop(
	items: RegisteredItem[],
	selected: string[],
	focused: string | undefined
): string | undefined {
	const enabled = items.filter((item) => !item.isDisabled());
	if (focused !== undefined && enabled.some((item) => item.value === focused)) return focused;
	return (enabled.find((item) => selected.includes(item.value)) ?? enabled[0])?.value;
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
