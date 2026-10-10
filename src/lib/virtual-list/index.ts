// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
export { default as VirtualList } from './VirtualList.svelte';
export {
	computeVariableWindow,
	computeWindow,
	DEFAULT_OVERSCAN,
	offsetTopForIndex,
	prefixOffsets,
	totalHeight
} from './window';
export type { VariableWindowOptions, VirtualWindow, VirtualWindowOptions } from './window';
