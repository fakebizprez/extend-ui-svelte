// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).

export { default as DocumentSplits } from './DocumentSplits.svelte';
export { default } from './DocumentSplits.svelte';
export {
	addSplit,
	areSplitGroupsEqual,
	arrayMove,
	createInitialSplits,
	createPageRangeLabel,
	findGroupId,
	getGroupPages,
	getPageNumber,
	INITIAL_SPLITS,
	movePage,
	movePageToAdjacentGroup,
	movePageToGroup,
	nextSplitId,
	removeSplit,
	renameSplit,
	reorderPageInGroup,
	reorderSplits,
	splitGroup
} from './splits.js';
export type { DocumentSplit, DocumentSplitPageId } from './splits.js';
