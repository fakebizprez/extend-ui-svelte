// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
// Internal context shared by ToggleGroup and its items. Not part of the public API.
import { getContext, setContext } from 'svelte';

/** Base UI's `Toggle.ChangeEventDetails` / `ToggleGroup.ChangeEventDetails`. */
export interface ToggleChangeEventDetails {
	reason: 'none';
	event: Event;
	/** Skips the built-in state change. */
	cancel: () => void;
	/** Parity with Base UI; nothing here stops propagation. */
	allowPropagation: () => void;
	isCanceled: boolean;
	isPropagationAllowed: boolean;
	trigger: Element | undefined;
}

export function createChangeEventDetails(event: Event): ToggleChangeEventDetails {
	const details: ToggleChangeEventDetails = {
		reason: 'none',
		event,
		cancel: () => (details.isCanceled = true),
		allowPropagation: () => (details.isPropagationAllowed = true),
		isCanceled: false,
		isPropagationAllowed: false,
		trigger: (event.currentTarget as Element | null) ?? undefined
	};
	return details;
}

export interface ToggleGroupContext {
	isSelected: (itemValue: string) => boolean;
	toggleValue: (itemValue: string, details: ToggleChangeEventDetails) => void;
	isDisabled: () => boolean;
	/** Registers an item; returns the unregister function. */
	register: (
		itemValue: string,
		isDisabled: () => boolean,
		element: () => HTMLElement | undefined
	) => () => void;
	/** Whether this item is the group's single Tab stop. */
	isTabStop: (itemValue: string) => boolean;
	/** Moves the Tab stop to the focused item. */
	setFocused: (itemValue: string) => void;
}

export interface RegisteredItem {
	value: string;
	isDisabled: () => boolean;
	/** The mounted button; undefined during SSR and before mount. */
	element: () => HTMLElement | undefined;
}

/**
 * The group's single Tab stop, like Base UI 1.4.1's composite root: the last
 * focused item, else the first item in DOM order. Pressed state plays no part.
 * Unlike Base UI, a disabled first item passes the stop to the next enabled one.
 */
export function findTabStop(items: RegisteredItem[], focused: string | undefined): string | undefined {
	const elements = items.map((item) => item.element());
	// Before mount (and on the server) registration order is the DOM order.
	const ordered = elements.every(Boolean)
		? [...items].sort((a, b) =>
				a.element()!.compareDocumentPosition(b.element()!) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
			)
		: items;
	const enabled = ordered.filter((item) => !item.isDisabled());
	if (focused !== undefined && enabled.some((item) => item.value === focused)) return focused;
	return enabled[0]?.value;
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
