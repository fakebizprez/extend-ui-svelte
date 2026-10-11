// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
// Ported from apps/v4/components/extend/document-splits.tsx.
//
// Deliberate changes from the React version:
// - The dnd-kit helpers (arrayMove, sortable ids) are replaced with small
//   framework-free equivalents in this module; drag-and-drop itself is native
//   HTML5 in DocumentSplits.svelte.
// - Extra pure operations the Svelte controls need: reorderSplits,
//   splitGroup, removeSplit, addSplit, nextSplitId, renameSplit, movePage,
//   and movePageToAdjacentGroup. Upstream inlines add/remove in handlers.

/** Page identifier used inside split groups, e.g. `page-3`. */
export type DocumentSplitPageId = `page-${number}`;

/** A named section holding an ordered list of document pages. */
export type DocumentSplit = {
	id: string;
	title: string;
	pages: DocumentSplitPageId[];
};

/** Demo splits used when no page count is known. Matches upstream. */
export const INITIAL_SPLITS: DocumentSplit[] = [
	{
		id: 'split-1',
		title: 'Abstract and intro',
		pages: ['page-1', 'page-2', 'page-3']
	},
	{
		id: 'split-2',
		title: 'Model architecture',
		pages: ['page-4', 'page-5', 'page-6', 'page-7']
	},
	{
		id: 'split-3',
		title: 'Training and results',
		pages: ['page-8', 'page-9', 'page-10']
	}
];

/** Distributes `pageCount` pages across at most three titled groups. */
export function createInitialSplits(pageCount: number): DocumentSplit[] {
	if (pageCount <= 0) return INITIAL_SPLITS;

	const pages = Array.from(
		{ length: pageCount },
		(_, index) => `page-${index + 1}` as DocumentSplitPageId
	);
	const chunkSize = Math.max(1, Math.ceil(pageCount / 3));

	return Array.from({ length: Math.ceil(pageCount / chunkSize) }, (_, index) => {
		const startIndex = index * chunkSize;
		const groupPages = pages.slice(startIndex, startIndex + chunkSize);
		const firstPage = getPageNumber(groupPages[0]);
		const lastPage = getPageNumber(groupPages[groupPages.length - 1]);

		return {
			id: `split-${index + 1}`,
			title: firstPage === lastPage ? `Page ${firstPage}` : `Pages ${firstPage}-${lastPage}`,
			pages: groupPages
		};
	});
}

/** Parses the 1-based page number out of a page id. */
export function getPageNumber(pageId: DocumentSplitPageId): number {
	return Number(pageId.replace('page-', ''));
}

/** Framework-free replacement for dnd-kit's arrayMove. Never mutates. */
export function arrayMove<T>(items: readonly T[], fromIndex: number, toIndex: number): T[] {
	const next = [...items];
	if (
		fromIndex < 0 ||
		fromIndex >= next.length ||
		toIndex < 0 ||
		toIndex >= next.length ||
		fromIndex === toIndex
	) {
		return next;
	}
	const [moved] = next.splice(fromIndex, 1);
	next.splice(toIndex, 0, moved);
	return next;
}

/** Finds the group that either has this id or contains this page id. */
export function findGroupId(groups: DocumentSplit[], id: string): string | null {
	if (groups.some((group) => group.id === id)) return id;
	return groups.find((group) => group.pages.includes(id as DocumentSplitPageId))?.id ?? null;
}

/** Returns the pages of a group, or an empty list when unknown. */
export function getGroupPages(
	groups: DocumentSplit[],
	groupId: string | null
): DocumentSplitPageId[] {
	return groups.find((group) => group.id === groupId)?.pages ?? [];
}

/** Removes a page from its group and inserts it into the target group. */
export function movePageToGroup({
	draggedPageId,
	groups,
	insertIndex,
	targetGroupId
}: {
	draggedPageId: DocumentSplitPageId;
	groups: DocumentSplit[];
	insertIndex: number;
	targetGroupId: string;
}): DocumentSplit[] {
	return groups.map((group) => {
		const pagesWithoutDragged = group.pages.filter((pageId) => pageId !== draggedPageId);

		if (group.id !== targetGroupId) {
			return { ...group, pages: pagesWithoutDragged };
		}

		const nextPages = [...pagesWithoutDragged];
		nextPages.splice(Math.max(0, Math.min(insertIndex, nextPages.length)), 0, draggedPageId);

		return { ...group, pages: nextPages };
	});
}

/** Deep value equality for split lists, used to skip no-op change events. */
export function areSplitGroupsEqual(left: DocumentSplit[], right: DocumentSplit[]): boolean {
	if (left === right) return true;
	if (left.length !== right.length) return false;

	return left.every((leftGroup, groupIndex) => {
		const rightGroup = right[groupIndex];
		if (!rightGroup) return false;

		return (
			leftGroup.id === rightGroup.id &&
			leftGroup.title === rightGroup.title &&
			leftGroup.pages.length === rightGroup.pages.length &&
			leftGroup.pages.every((pageId, pageIndex) => pageId === rightGroup.pages[pageIndex])
		);
	});
}

/** Moves the dragged page onto the target page's position in its group. */
export function reorderPageInGroup({
	draggedPageId,
	groups,
	overPageId
}: {
	draggedPageId: DocumentSplitPageId;
	groups: DocumentSplit[];
	overPageId: DocumentSplitPageId;
}): DocumentSplit[] {
	const groupId = findGroupId(groups, draggedPageId);
	const pages = getGroupPages(groups, groupId);
	const draggedIndex = pages.indexOf(draggedPageId);
	const overIndex = pages.indexOf(overPageId);

	if (!groupId || draggedIndex === -1 || overIndex === -1) return groups;

	return groups.map((group) =>
		group.id === groupId
			? { ...group, pages: arrayMove(group.pages, draggedIndex, overIndex) }
			: group
	);
}

/** Human-readable label for a group's page list. */
export function createPageRangeLabel(pageIds: DocumentSplitPageId[]): string {
	if (pageIds.length === 0) return 'No pages';

	return `Pages ${pageIds.map(getPageNumber).join(', ')}`;
}

/** Moves a split group from one position to another. Never mutates. */
export function reorderSplits(
	groups: DocumentSplit[],
	fromIndex: number,
	toIndex: number
): DocumentSplit[] {
	if (
		fromIndex < 0 ||
		fromIndex >= groups.length ||
		toIndex < 0 ||
		toIndex >= groups.length
	) {
		return groups;
	}
	return arrayMove(groups, fromIndex, toIndex);
}

/**
 * Splits a group into two at `atIndex` (default: the midpoint, rounding the
 * extra page into the first half). The first half keeps the id and title; the
 * second half becomes a new group titled `<title> (2)` right after it.
 * Returns the input unchanged when the group is unknown or has fewer than
 * two pages, or when the index is not a real cut point.
 */
export function splitGroup(
	groups: DocumentSplit[],
	groupId: string,
	atIndex?: number
): DocumentSplit[] {
	const groupIndex = groups.findIndex((group) => group.id === groupId);
	if (groupIndex === -1) return groups;

	const group = groups[groupIndex];
	const cut = atIndex ?? Math.ceil(group.pages.length / 2);
	if (cut <= 0 || cut >= group.pages.length) return groups;

	const first = { ...group, pages: group.pages.slice(0, cut) };
	const second: DocumentSplit = {
		id: nextSplitId(groups),
		title: `${group.title} (2)`,
		pages: group.pages.slice(cut)
	};

	return [...groups.slice(0, groupIndex), first, second, ...groups.slice(groupIndex + 1)];
}

/**
 * Removes a group. The last remaining group is kept so the component never
 * ends up with zero splits. Returns the input unchanged when the id is
 * unknown or only one group exists.
 */
export function removeSplit(groups: DocumentSplit[], groupId: string): DocumentSplit[] {
	if (groups.length <= 1 || !groups.some((group) => group.id === groupId)) return groups;
	return groups.filter((group) => group.id !== groupId);
}

let lastSplitStamp = 0;

/**
 * Upstream's `split-<Date.now()>` id, kept strictly increasing so two splits
 * made in one millisecond, or one made after a removal, never reuse an id.
 */
export function nextSplitId(groups: DocumentSplit[]): string {
	const used = new Set(groups.map((group) => group.id));
	let stamp = Math.max(Date.now(), lastSplitStamp + 1);
	while (used.has(`split-${stamp}`)) stamp += 1;
	lastSplitStamp = stamp;
	return `split-${stamp}`;
}

/** Appends an empty named split, matching upstream's `Split N` titling. */
export function addSplit(groups: DocumentSplit[]): DocumentSplit[] {
	return [
		...groups,
		{ id: nextSplitId(groups), title: `Split ${groups.length + 1}`, pages: [] }
	];
}

/** Renames a group. Returns the input unchanged for unknown ids. */
export function renameSplit(
	groups: DocumentSplit[],
	groupId: string,
	title: string
): DocumentSplit[] {
	if (!groups.some((group) => group.id === groupId)) return groups;
	return groups.map((group) => (group.id === groupId ? { ...group, pages: group.pages, title } : group));
}

/**
 * Moves a page one step within its own group. `direction` is -1 (left) or
 * +1 (right). Returns the input unchanged at the edges or for unknown pages.
 */
export function movePage(
	groups: DocumentSplit[],
	pageId: DocumentSplitPageId,
	direction: -1 | 1
): DocumentSplit[] {
	const groupId = findGroupId(groups, pageId);
	const pages = getGroupPages(groups, groupId);
	const index = pages.indexOf(pageId);
	if (!groupId || index === -1 || index + direction < 0 || index + direction >= pages.length) {
		return groups;
	}

	return groups.map((group) =>
		group.id === groupId
			? { ...group, pages: arrayMove(group.pages, index, index + direction) }
			: group
	);
}

/**
 * Moves a page to the previous (-1) or next (+1) split group, appended at the
 * end. Returns the input unchanged at the edges or for unknown pages.
 */
export function movePageToAdjacentGroup(
	groups: DocumentSplit[],
	pageId: DocumentSplitPageId,
	direction: -1 | 1
): DocumentSplit[] {
	const groupIndex = groups.findIndex((group) => group.pages.includes(pageId));
	const target = groups[groupIndex + direction];
	if (groupIndex === -1 || !target) return groups;

	return movePageToGroup({
		draggedPageId: pageId,
		groups,
		insertIndex: target.pages.length,
		targetGroupId: target.id
	});
}
