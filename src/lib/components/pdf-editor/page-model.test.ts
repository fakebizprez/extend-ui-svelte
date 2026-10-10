// MIT License — Svelte 5 port of Extend UI pdf-editor. Upstream: extend-hq/ui (MIT).
import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import {
	createEditState,
	deleteEditPage,
	exportEditedPdf,
	moveEditPage,
	resetEditState,
	rotateEditPage
} from './page-model.js';

async function threePageSource(): Promise<Uint8Array> {
	const doc = await PDFDocument.create();
	// Distinct widths so page order is verifiable after export.
	doc.addPage([100, 100]);
	doc.addPage([200, 200]);
	doc.addPage([300, 300]);
	return await doc.save();
}

async function pageSizes(bytes: Uint8Array): Promise<Array<{ width: number; rotation: number }>> {
	const doc = await PDFDocument.load(bytes);
	return doc.getPages().map((page) => ({
		width: page.getSize().width,
		rotation: page.getRotation().angle
	}));
}

describe('createEditState', () => {
	it('creates one unrotated entry per source page', () => {
		expect(createEditState(3)).toEqual({
			pages: [
				{ sourcePage: 1, rotation: 0 },
				{ sourcePage: 2, rotation: 0 },
				{ sourcePage: 3, rotation: 0 }
			]
		});
	});

	it('creates an empty state for zero pages', () => {
		expect(createEditState(0)).toEqual({ pages: [] });
	});
});

describe('rotateEditPage', () => {
	it('rotates clockwise in quarter turns and wraps at 360', () => {
		expect(rotateEditPage(createEditState(1), 0, 'clockwise').pages[0].rotation).toBe(90);
		const state = rotateEditPage(createEditState(1), 0, 'clockwise');
		const twice = rotateEditPage(state, 0, 'clockwise');
		expect(twice.pages[0].rotation).toBe(180);
		const fourTimes = rotateEditPage(
			rotateEditPage(twice, 0, 'clockwise'),
			0,
			'clockwise'
		);
		expect(fourTimes.pages[0].rotation).toBe(0);
	});

	it('rotates counter-clockwise and wraps below 0', () => {
		expect(rotateEditPage(createEditState(1), 0, 'counter-clockwise').pages[0].rotation).toBe(
			270
		);
	});

	it('leaves other pages untouched and ignores out-of-range indexes', () => {
		const state = createEditState(2);
		const rotated = rotateEditPage(state, 0, 'clockwise');
		expect(rotated.pages[1].rotation).toBe(0);
		expect(state.pages[0].rotation).toBe(0);
		expect(rotateEditPage(state, 99, 'clockwise')).toEqual(state);
	});
});

describe('deleteEditPage', () => {
	it('removes the page at the index without mutating the input', () => {
		const state = createEditState(3);
		const deleted = deleteEditPage(state, 1);
		expect(deleted.pages.map((page) => page.sourcePage)).toEqual([1, 3]);
		expect(state.pages).toHaveLength(3);
	});

	it('ignores out-of-range indexes', () => {
		const state = createEditState(2);
		expect(deleteEditPage(state, 5)).toEqual(state);
	});
});

describe('moveEditPage', () => {
	it('moves a page earlier and later in the order', () => {
		const state = createEditState(3);
		expect(moveEditPage(state, 2, 0).pages.map((page) => page.sourcePage)).toEqual([3, 1, 2]);
		expect(moveEditPage(state, 0, 2).pages.map((page) => page.sourcePage)).toEqual([2, 3, 1]);
	});

	it('clamps the target index and ignores out-of-range sources', () => {
		const state = createEditState(3);
		expect(moveEditPage(state, 0, 99).pages.map((page) => page.sourcePage)).toEqual([2, 3, 1]);
		expect(moveEditPage(state, 99, 0)).toEqual(state);
	});
});

describe('resetEditState', () => {
	it('restores the original order, rotations, and deletions', () => {
		expect(resetEditState(3)).toEqual(createEditState(3));
		expect(resetEditState(0)).toEqual({ pages: [] });
	});
});

describe('exportEditedPdf', () => {
	it('exports pages in edited order with rotations applied and deletions omitted', async () => {
		const source = await threePageSource();
		let state = createEditState(3);
		state = moveEditPage(state, 2, 0); // [3,1,2]
		state = rotateEditPage(state, 1, 'clockwise'); // source page 1 rotated 90
		state = deleteEditPage(state, 2); // drop source page 2 -> [3,1]

		const exported = await exportEditedPdf(source, state);
		expect(exported).toBeInstanceOf(Uint8Array);
		expect(await pageSizes(exported)).toEqual([
			{ width: 300, rotation: 0 },
			{ width: 100, rotation: 90 }
		]);
	});

	it('adds rotations on top of existing source page rotation', async () => {
		const doc = await PDFDocument.create();
		const page = doc.addPage([100, 100]);
		page.setRotation({ angle: 90, type: 'degrees' } as never);
		const source = await doc.save();

		const state = rotateEditPage(createEditState(1), 0, 'clockwise');
		const exported = await exportEditedPdf(source, state);
		expect(await pageSizes(exported)).toEqual([{ width: 100, rotation: 180 }]);
	});

	it('round-trips an unedited document with identical page sizes', async () => {
		const source = await threePageSource();
		const exported = await exportEditedPdf(source, createEditState(3));
		expect(await pageSizes(exported)).toEqual([
			{ width: 100, rotation: 0 },
			{ width: 200, rotation: 0 },
			{ width: 300, rotation: 0 }
		]);
	});
});
