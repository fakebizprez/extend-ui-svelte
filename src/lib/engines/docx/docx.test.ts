// MIT License — Svelte 5 port of Extend UI docx-viewer engine. Upstream: extend-hq/ui (MIT).
import { describe, expect, it } from 'vitest';
import {
	clearDocx,
	DEFAULT_DOCX_OPTIONS,
	DocxRenderError,
	renderDocx,
	resolveDocxOptions
} from './index.js';

describe('docx engine wrapper API shape', () => {
	it('exposes render and clear functions plus option helpers', () => {
		expect(typeof renderDocx).toBe('function');
		expect(typeof clearDocx).toBe('function');
		expect(typeof resolveDocxOptions).toBe('function');
		expect(DocxRenderError.prototype).toBeInstanceOf(Error);
	});

	it('defaults to no thumbnail sidebar', () => {
		expect(DEFAULT_DOCX_OPTIONS.showThumbnails).toBe(false);
		expect(DEFAULT_DOCX_OPTIONS.breakPages).toBe(true);
		expect(typeof DEFAULT_DOCX_OPTIONS.className).toBe('string');
	});

	it('resolveDocxOptions falls back to defaults when options are missing', () => {
		expect(resolveDocxOptions()).toEqual(DEFAULT_DOCX_OPTIONS);
		expect(resolveDocxOptions({})).toEqual(DEFAULT_DOCX_OPTIONS);
	});

	it('resolveDocxOptions keeps an explicit thumbnail sidebar flag', () => {
		expect(resolveDocxOptions({ showThumbnails: true }).showThumbnails).toBe(true);
		expect(resolveDocxOptions({ showThumbnails: false }).showThumbnails).toBe(false);
	});

	it('resolveDocxOptions passes className and breakPages through', () => {
		const resolved = resolveDocxOptions({ className: 'custom-docx', breakPages: false });

		expect(resolved.className).toBe('custom-docx');
		expect(resolved.breakPages).toBe(false);
	});

	it('clearDocx empties the container', () => {
		const container = { innerHTML: '<p>stale content</p>' };

		clearDocx(container);

		expect(container.innerHTML).toBe('');
	});

	it('renderDocx rejects without a container element', async () => {
		expect.assertions(1);
		await expect(renderDocx(new Uint8Array(), null as unknown as HTMLElement)).rejects.toThrow(
			DocxRenderError
		);
	});

	it('renderDocx rejects an unsupported source type', async () => {
		expect.assertions(1);
		const container = { innerHTML: '' } as unknown as HTMLElement;

		await expect(renderDocx(123 as unknown as string, container)).rejects.toThrow(DocxRenderError);
	});

	it('renderDocx rejects outside a browser DOM', async () => {
		expect.assertions(2);
		expect(typeof document).toBe('undefined');
		const container = { innerHTML: '' } as unknown as HTMLElement;

		await expect(renderDocx(new Uint8Array(), container)).rejects.toThrow(/browser/);
	});
});
