// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
export { default as Group, groupVariants, type GroupOrientation, type GroupProps } from './Group.svelte';
export { default as GroupText, type GroupTextProps } from './GroupText.svelte';
export {
	default as GroupSeparator,
	type GroupSeparatorOrientation,
	type GroupSeparatorProps
} from './GroupSeparator.svelte';

// Upstream aliases.
export { default as ButtonGroup } from './Group.svelte';
export { default as ButtonGroupText } from './GroupText.svelte';
export { default as ButtonGroupSeparator } from './GroupSeparator.svelte';
