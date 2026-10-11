// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
// PPTX engine wrapper tests (no canvas): run in the Vitest node project.
// pptx-browser needs DOMParser, which Node lacks, so the suite supplies the
// jsdom implementation; in the browser the native one is used.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { loadDeck, type PptxDeck } from './pptx.js';

const fixturePath = join(
	dirname(fileURLToPath(import.meta.url)),
	'../../../../tests/fixtures/sample.pptx'
);

function fixtureBytes(): Uint8Array {
	return new Uint8Array(readFileSync(fixturePath));
}

beforeAll(() => {
	globalThis.DOMParser ??= new JSDOM('').window.DOMParser;
});

describe('loadDeck', () => {
	it('loads the fixture deck and reports 2 slides', async () => {
		const deck: PptxDeck = await loadDeck(fixtureBytes());

		expect(deck.slideCount).toBe(2);
		expect(typeof deck.renderSlide).toBe('function');
		expect(typeof deck.destroy).toBe('function');
		deck.destroy();
	});

	it('accepts an ArrayBuffer as well as a Uint8Array', async () => {
		const bytes = fixtureBytes();
		const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
		const deck = await loadDeck(buffer);

		expect(deck.slideCount).toBe(2);
		deck.destroy();
	});

	it('reports load progress through the callback', async () => {
		const seen: Array<{ progress: number; message: string }> = [];
		const deck = await loadDeck(fixtureBytes(), (progress, message) => {
			seen.push({ progress, message });
		});

		expect(seen.length).toBeGreaterThan(0);
		expect(seen[seen.length - 1]?.progress).toBe(1);
		deck.destroy();
	});

	it('rejects bytes that are not a ZIP archive', async () => {
		await expect(loadDeck(new Uint8Array([1, 2, 3, 4]))).rejects.toThrow();
	});
});

describe('PptxDeck', () => {
	it('rejects out-of-range slide indexes without needing a canvas', async () => {
		const deck = await loadDeck(fixtureBytes());
		const noCanvas = undefined as unknown as HTMLCanvasElement;

		await expect(deck.renderSlide(-1, noCanvas)).rejects.toThrow(RangeError);
		await expect(deck.renderSlide(2, noCanvas)).rejects.toThrow(RangeError);
		deck.destroy();
	});

	it('tolerates destroy being called more than once', async () => {
		const deck = await loadDeck(fixtureBytes());

		deck.destroy();
		expect(() => deck.destroy()).not.toThrow();
	});
});
