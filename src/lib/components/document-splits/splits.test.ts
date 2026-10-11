// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
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
	splitGroup,
	type DocumentSplit
} from './splits.js';

function makeSplits(): DocumentSplit[] {
	return [
		{ id: 'split-1', title: 'First', pages: ['page-1', 'page-2'] },
		{ id: 'split-2', title: 'Second', pages: ['page-3', 'page-4', 'page-5'] }
	];
}

describe('getPageNumber', () => {
	it('parses the page number from a page id', () => {
		expect(getPageNumber('page-1')).toBe(1);
		expect(getPageNumber('page-12')).toBe(12);
	});
});

describe('createInitialSplits', () => {
	it('returns INITIAL_SPLITS for a non-positive page count', () => {
		expect(createInitialSplits(0)).toEqual(INITIAL_SPLITS);
		expect(createInitialSplits(-2)).toEqual(INITIAL_SPLITS);
	});

	it('chunks pages into at most three titled groups', () => {
		const splits = createInitialSplits(10);

		expect(splits).toHaveLength(3);
		expect(splits[0]).toEqual({ id: 'split-1', title: 'Pages 1-4', pages: ['page-1', 'page-2', 'page-3', 'page-4'] });
		expect(splits[2].pages).toEqual(['page-9', 'page-10']);
	});

	it('uses a singular title for single-page groups', () => {
		const splits = createInitialSplits(2);

		expect(splits).toHaveLength(2);
		expect(splits[0].title).toBe('Page 1');
		expect(splits[1]).toEqual({ id: 'split-2', title: 'Page 2', pages: ['page-2'] });
	});

	it('covers every page exactly once', () => {
		for (const pageCount of [1, 3, 5, 7, 11]) {
			const pages = createInitialSplits(pageCount).flatMap((split) => split.pages);
			expect(pages).toEqual(
				Array.from({ length: pageCount }, (_, index) => `page-${index + 1}`)
			);
		}
	});
});

describe('findGroupId / getGroupPages', () => {
	it('finds a group by group id or by contained page id', () => {
		const splits = makeSplits();

		expect(findGroupId(splits, 'split-2')).toBe('split-2');
		expect(findGroupId(splits, 'page-4')).toBe('split-2');
		expect(findGroupId(splits, 'page-99')).toBeNull();
	});

	it('returns the pages of a group or an empty array', () => {
		const splits = makeSplits();

		expect(getGroupPages(splits, 'split-1')).toEqual(['page-1', 'page-2']);
		expect(getGroupPages(splits, null)).toEqual([]);
		expect(getGroupPages(splits, 'missing')).toEqual([]);
	});
});

describe('movePageToGroup', () => {
	it('moves a page across groups at the given index', () => {
		const next = movePageToGroup({
			draggedPageId: 'page-2',
			groups: makeSplits(),
			insertIndex: 1,
			targetGroupId: 'split-2'
		});

		expect(next[0].pages).toEqual(['page-1']);
		expect(next[1].pages).toEqual(['page-3', 'page-2', 'page-4', 'page-5']);
	});

	it('appends when the insert index is past the end', () => {
		const next = movePageToGroup({
			draggedPageId: 'page-1',
			groups: makeSplits(),
			insertIndex: 99,
			targetGroupId: 'split-2'
		});

		expect(next[1].pages.at(-1)).toBe('page-1');
	});

	it('does not mutate the input groups', () => {
		const splits = makeSplits();
		movePageToGroup({
			draggedPageId: 'page-1',
			groups: splits,
			insertIndex: 0,
			targetGroupId: 'split-2'
		});

		expect(splits[0].pages).toEqual(['page-1', 'page-2']);
		expect(splits[1].pages).toHaveLength(3);
	});
});

describe('reorderPageInGroup', () => {
	it('moves the dragged page onto the target page position', () => {
		const next = reorderPageInGroup({
			draggedPageId: 'page-3',
			groups: makeSplits(),
			overPageId: 'page-5'
		});

		expect(next[1].pages).toEqual(['page-4', 'page-5', 'page-3']);
	});

	it('returns the input when either page is unknown', () => {
		const splits = makeSplits();

		expect(
			reorderPageInGroup({ draggedPageId: 'page-3', groups: splits, overPageId: 'page-99' })
		).toBe(splits);
	});
});

describe('arrayMove', () => {
	it('moves an item from one index to another', () => {
		expect(arrayMove(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
		expect(arrayMove(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
	});

	it('returns an equal copy when indexes match', () => {
		expect(arrayMove(['a', 'b'], 1, 1)).toEqual(['a', 'b']);
	});
});

describe('areSplitGroupsEqual', () => {
	it('compares splits by value', () => {
		expect(areSplitGroupsEqual(makeSplits(), makeSplits())).toBe(true);
		expect(areSplitGroupsEqual(makeSplits(), [...makeSplits(), ...makeSplits()])).toBe(false);
		expect(
			areSplitGroupsEqual(makeSplits(), [{ id: 'split-1', title: 'First', pages: ['page-2', 'page-1'] }, makeSplits()[1]])
		).toBe(false);
	});
});

describe('createPageRangeLabel', () => {
	it('labels empty and populated page lists', () => {
		expect(createPageRangeLabel([])).toBe('No pages');
		expect(createPageRangeLabel(['page-4', 'page-5', 'page-6'])).toBe('Pages 4, 5, 6');
	});
});

describe('reorderSplits', () => {
	it('moves a split group to a new position', () => {
		const splits: DocumentSplit[] = [
			...makeSplits(),
			{ id: 'split-3', title: 'Third', pages: ['page-6'] }
		];

		expect(reorderSplits(splits, 0, 2).map((split) => split.id)).toEqual([
			'split-2',
			'split-3',
			'split-1'
		]);
	});

	it('returns the input for out-of-range indexes', () => {
		const splits = makeSplits();

		expect(reorderSplits(splits, 0, 5)).toBe(splits);
		expect(reorderSplits(splits, -1, 0)).toBe(splits);
	});
});

describe('splitGroup', () => {
	it('splits a group into two at the midpoint by default', () => {
		const next = splitGroup(makeSplits(), 'split-2');

		expect(next).toHaveLength(3);
		expect(next[1]).toEqual({ id: 'split-2', title: 'Second', pages: ['page-3', 'page-4'] });
		expect(next[2].title).toBe('Second (2)');
		expect(next[2].pages).toEqual(['page-5']);
		expect(next[2].id).not.toBe('split-2');
	});

	it('splits at an explicit index', () => {
		const next = splitGroup(makeSplits(), 'split-1', 1);

		expect(next[0].pages).toEqual(['page-1']);
		expect(next[1].pages).toEqual(['page-2']);
	});

	it('returns the input for unknown groups and unsplittable pages', () => {
		const splits = makeSplits();

		expect(splitGroup(splits, 'missing')).toBe(splits);
		expect(splitGroup(splits, 'split-1', 0)).toBe(splits);
		expect(splitGroup(splits, 'split-1', 2)).toBe(splits);
		expect(
			splitGroup([{ id: 'split-1', title: 'Solo', pages: ['page-1'] }], 'split-1')
		).toEqual([{ id: 'split-1', title: 'Solo', pages: ['page-1'] }]);
	});
});

describe('removeSplit', () => {
	it('removes the named group', () => {
		expect(removeSplit(makeSplits(), 'split-1')).toEqual([makeSplits()[1]]);
	});

	it('keeps the last remaining group', () => {
		const single = [makeSplits()[0]];

		expect(removeSplit(single, 'split-1')).toBe(single);
	});

	it('returns the input for unknown ids', () => {
		const splits = makeSplits();

		expect(removeSplit(splits, 'missing')).toBe(splits);
	});
});

describe('nextSplitId / addSplit', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it('uses upstream\'s timestamp id scheme', () => {
		vi.useFakeTimers();
		vi.setSystemTime(2_000_000_000_000);

		expect(nextSplitId(makeSplits())).toBe('split-2000000000000');
	});

	it('never reuses an id, even after a removal or within one millisecond', () => {
		vi.useFakeTimers();
		vi.setSystemTime(2_100_000_000_000);
		const added = addSplit(makeSplits());
		const id = added[2].id;
		const removed = removeSplit(added, id);

		const readded = addSplit(removed);
		expect(readded[2].id).not.toBe(id);
		expect(new Set([id, readded[2].id, ...makeSplits().map((group) => group.id)]).size).toBe(4);
	});

	it('appends an empty named split', () => {
		const next = addSplit(makeSplits());

		expect(next).toHaveLength(3);
		expect(next[2]).toEqual({ id: expect.stringMatching(/^split-\d+$/), title: 'Split 3', pages: [] });
	});
});

describe('renameSplit', () => {
	it('renames the named group and keeps the other groups untouched', () => {
		const splits = makeSplits();
		const next = renameSplit(splits, 'split-1', 'Intro');

		expect(next[0].title).toBe('Intro');
		expect(next[1]).toBe(splits[1]);
		expect(splits[0].title).toBe('First');
	});

	it('returns the input for unknown ids', () => {
		const splits = makeSplits();

		expect(renameSplit(splits, 'missing', 'X')).toBe(splits);
	});
});

describe('movePage', () => {
	it('moves a page within its group', () => {
		const next = movePage(makeSplits(), 'page-4', -1);

		expect(next[1].pages).toEqual(['page-4', 'page-3', 'page-5']);
	});

	it('is a no-op at the group edges', () => {
		const splits = makeSplits();

		expect(movePage(splits, 'page-1', -1)).toBe(splits);
		expect(movePage(splits, 'page-2', 1)).toBe(splits);
		expect(movePage(splits, 'page-99', 1)).toBe(splits);
	});
});

describe('movePageToAdjacentGroup', () => {
	it('moves a page to the next group', () => {
		const next = movePageToAdjacentGroup(makeSplits(), 'page-2', 1);

		expect(next[0].pages).toEqual(['page-1']);
		expect(next[1].pages).toEqual(['page-3', 'page-4', 'page-5', 'page-2']);
	});

	it('is a no-op at the first and last groups', () => {
		const splits = makeSplits();

		expect(movePageToAdjacentGroup(splits, 'page-1', -1)).toBe(splits);
		expect(movePageToAdjacentGroup(splits, 'page-5', 1)).toBe(splits);
		expect(movePageToAdjacentGroup(splits, 'page-99', 1)).toBe(splits);
	});
});

describe('migration guide', () => {
	it('shows controlled splits and schema, not bind:, like the components', async () => {
		const { readFile } = await import('node:fs/promises');
		const guide = await readFile(`${process.cwd()}/docs/migration-react-to-svelte.md`, 'utf8');

		expect(guide).not.toMatch(/bind:splits|bind:schema|bind:activeFieldKey \/>/);
		expect(guide).not.toMatch(/<DocumentSplits[^>]*activeFieldKey/);
		expect(guide).toContain('onSplitsChange={(next) => (splits = next)}');
	});
});
