// MIT License — Svelte 5 port of Extend UI csv-viewer. Upstream: extend-hq/ui (MIT).
// Pure parsing tests (no DOM): run in the Vitest node project.
import { describe, expect, it } from 'vitest';
import { parseDelimitedText } from './parse.js';

describe('parseDelimitedText', () => {
	it('parses CSV text with a header row', async () => {
		const result = await parseDelimitedText('name,age\nAda,36\nGrace,85');

		expect(result.error).toBeNull();
		expect(result.headers).toEqual(['name', 'age']);
		expect(result.rows).toEqual([
			['Ada', '36'],
			['Grace', '85']
		]);
	});

	it('parses TSV text via delimiter auto-detect', async () => {
		const result = await parseDelimitedText('name\tage\nAda\t36\nGrace\t85');

		expect(result.error).toBeNull();
		expect(result.headers).toEqual(['name', 'age']);
		expect(result.rows).toEqual([
			['Ada', '36'],
			['Grace', '85']
		]);
	});

	it('respects an explicit delimiter', async () => {
		const result = await parseDelimitedText('name;note\nAda;likes, commas', ';');

		expect(result.error).toBeNull();
		expect(result.headers).toEqual(['name', 'note']);
		expect(result.rows).toEqual([['Ada', 'likes, commas']]);
	});

	it('normalizes a blank header to Column N', async () => {
		const result = await parseDelimitedText('name,\nAda,36');

		expect(result.error).toBeNull();
		expect(result.headers).toEqual(['name', 'Column 2']);
		expect(result.rows).toEqual([['Ada', '36']]);
	});

	it('pads ragged rows into Extra N columns', async () => {
		const result = await parseDelimitedText('a,b\n1,2,3\n4,5');

		expect(result.error).toBeNull();
		expect(result.headers).toEqual(['a', 'b', 'Extra 1']);
		expect(result.rows).toEqual([
			['1', '2', '3'],
			['4', '5', '']
		]);
	});

	it('returns an empty result without error for empty input', async () => {
		const result = await parseDelimitedText('   ');

		expect(result.error).toBeNull();
		expect(result.headers).toEqual([]);
		expect(result.rows).toEqual([]);
	});

	it('skips blank lines in the input', async () => {
		const result = await parseDelimitedText('a,b\n\n1,2\n\n3,4\n');

		expect(result.error).toBeNull();
		expect(result.rows).toEqual([
			['1', '2'],
			['3', '4']
		]);
	});
});
