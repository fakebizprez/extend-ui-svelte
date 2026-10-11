// MIT License — Svelte 5 port of Extend UI docx-viewer engine. Upstream: extend-hq/ui (MIT).
// Engine tests that need a DOM. The .svelte.test.ts suffix puts them in the
// jsdom (client) Vitest project; docx-preview is mocked with deferred parsing
// so render order can be controlled.
import { describe, expect, it, vi } from 'vitest';

const { pending } = vi.hoisted(() => ({
	pending: new Map<string, () => void>()
}));

vi.mock('docx-preview', () => {
	/** Parses "documents" whose text is the blob content; waits until released. */
	async function parseAsync(data: Blob): Promise<string> {
		const text = await data.text();
		await new Promise<void>((resolve) => pending.set(text, resolve));
		return text;
	}
	async function renderDocument(doc: string): Promise<Node[]> {
		const section = document.createElement('section');
		// "HTML:" documents stand in for hostile docx-preview output.
		if (doc.startsWith('HTML:')) section.innerHTML = doc.slice('HTML:'.length);
		else section.textContent = doc;
		return [section];
	}
	// Same shape as the real renderAsync: parse, render, then clear and write.
	async function renderAsync(data: Blob, body: HTMLElement): Promise<string> {
		const doc = await parseAsync(data);
		const nodes = await renderDocument(doc);
		body.innerHTML = '';
		for (const node of nodes) body.appendChild(node);
		return doc;
	}
	return { parseAsync, renderDocument, renderAsync };
});

import {
	clearDocx,
	DocxRenderCancelledError,
	isSafeDocxLinkTarget,
	renderDocx,
	sanitizeDocxNode
} from './index.js';

async function release(text: string): Promise<void> {
	await vi.waitFor(() => expect(pending.has(text)).toBe(true));
	pending.get(text)?.();
	pending.delete(text);
}

describe('renderDocx', () => {
	it('is last-call-wins per container: a stale render never writes the DOM', async () => {
		const container = document.createElement('div');
		const older = renderDocx(new Blob(['OLD DOC']), container);
		// The newer render starts while the older one is still parsing.
		await vi.waitFor(() => expect(pending.has('OLD DOC')).toBe(true));
		const newer = renderDocx(new Blob(['NEW DOC']), container);

		await release('NEW DOC');
		await newer;
		await release('OLD DOC');

		await expect(older).rejects.toBeInstanceOf(DocxRenderCancelledError);
		expect(container.textContent).toBe('NEW DOC');
	});

	it('clearDocx cancels a render still in flight', async () => {
		const container = document.createElement('div');
		const inFlight = renderDocx(new Blob(['LATE DOC']), container);

		clearDocx(container);
		await release('LATE DOC');

		await expect(inFlight).rejects.toBeInstanceOf(DocxRenderCancelledError);
		expect(container.textContent).toBe('');
	});
});

describe('renderDocx link and markup sanitizing', () => {
	const HOSTILE = [
		'HTML:',
		'<a id="js" href="javascript:void(window.__pwned=1)">js</a>',
		'<a id="js-mixed" href=" \tJaVa&#9;ScRiPt:alert(1)">mixed</a>',
		'<a id="data" href="data:text/html,<script>alert(1)</script>">data</a>',
		'<a id="vb" href="vbscript:msgbox(1)">vb</a>',
		'<a id="relative" href="other.html">relative</a>',
		'<a id="https" href="https://example.com/terms">https</a>',
		'<a id="http" href="http://example.com/">http</a>',
		'<a id="mail" href="mailto:legal@example.com">mail</a>',
		'<a id="tel" href="tel:+15550100">tel</a>',
		'<a id="anchor" href="#section-2">anchor</a>',
		'<p id="handler" onclick="window.__pwned=1" onmouseover="x()">text</p>',
		'<img id="image" src="data:image/png;base64,AAAA" onerror="window.__pwned=1">',
		'<script>window.__pwned=1</script>',
		'<iframe src="https://example.com"></iframe>',
		'<object data="x.swf"></object>',
		'<embed src="x.swf">',
		'<svg><a id="svg-link" xlink:href="javascript:alert(1)"><text>svg</text></a></svg>',
		'<a id="data-image-link" href="data:image/png;base64,AAAA">image link</a>',
		// docx-preview renders VML pictures (older Word files) as SVG <image href="data:...">.
		'<svg><image id="vml-image" href="data:image/png;base64,VMLA" width="100%"></image></svg>',
		'<svg><image id="vml-xlink" xlink:href="data:image/png;base64,VMLB"></image></svg>',
		'<img id="blob-image" src="blob:https://example.com/0f1e">',
		'<svg><image id="js-image" href="javascript:alert(1)"></image></svg>',
		'<svg><image id="html-image" href="data:text/html,<script>alert(1)</script>"></image></svg>',
		'<img id="js-img" src="javascript:alert(1)">',
		'<img id="vb-img" src=" VBScript:msgbox(1)">'
	].join('');

	async function renderHostile(): Promise<HTMLElement> {
		const container = document.createElement('div');
		const rendered = renderDocx(new Blob([HOSTILE]), container);
		await release(HOSTILE);
		await rendered;
		return container;
	}

	it('removes link targets that are not http, https, mailto, tel, or #anchors', async () => {
		const container = await renderHostile();
		const href = (id: string) => container.querySelector(`#${id}`)?.getAttribute('href') ?? null;

		for (const id of ['js', 'js-mixed', 'data', 'vb', 'relative']) {
			expect(container.querySelector(`#${id}`), id).not.toBeNull();
			expect(href(id), id).toBeNull();
		}
		expect(container.querySelector('#svg-link')?.getAttribute('xlink:href')).toBeNull();
		expect(href('https')).toBe('https://example.com/terms');
		expect(href('http')).toBe('http://example.com/');
		expect(href('mail')).toBe('mailto:legal@example.com');
		expect(href('tel')).toBe('tel:+15550100');
		expect(href('anchor')).toBe('#section-2');
	});

	it('keeps data:image and blob: image sources (VML pictures) but drops script sources', async () => {
		const container = await renderHostile();
		const attr = (id: string, name: string) =>
			container.querySelector(`#${id}`)?.getAttribute(name) ?? null;

		expect(attr('vml-image', 'href')).toBe('data:image/png;base64,VMLA');
		expect(attr('vml-xlink', 'xlink:href')).toBe('data:image/png;base64,VMLB');
		expect(attr('blob-image', 'src')).toBe('blob:https://example.com/0f1e');
		expect(attr('js-image', 'href')).toBeNull();
		expect(attr('html-image', 'href')).toBeNull();
		expect(attr('js-img', 'src')).toBeNull();
		expect(attr('vb-img', 'src')).toBeNull();
		// A data: URL is still not a safe link target, even for an image.
		expect(attr('data-image-link', 'href')).toBeNull();
	});

	it('strips event-handler attributes and script, iframe, object, and embed elements', async () => {
		const container = await renderHostile();

		expect(container.querySelector('#handler')?.getAttributeNames()).toEqual(['id']);
		expect(container.querySelector('#image')?.getAttribute('onerror')).toBeNull();
		// Embedded images keep their data: src.
		expect(container.querySelector('#image')?.getAttribute('src')).toBe('data:image/png;base64,AAAA');
		expect(container.querySelectorAll('script, iframe, object, embed')).toHaveLength(0);
	});
});

describe('sanitizeDocxNode', () => {
	it('drops a top-level script, iframe, object, or embed node', () => {
		for (const tag of ['script', 'iframe', 'object', 'embed']) {
			expect(sanitizeDocxNode(document.createElement(tag)), tag).toBe(false);
		}
		expect(sanitizeDocxNode(document.createElement('style'))).toBe(true);
		expect(sanitizeDocxNode(document.createTextNode('text'))).toBe(true);
	});

	it('classifies link targets by scheme after removing whitespace and control characters', () => {
		expect(isSafeDocxLinkTarget('HTTPS://example.com')).toBe(true);
		expect(isSafeDocxLinkTarget('#bookmark')).toBe(true);
		expect(isSafeDocxLinkTarget('java\nscript:alert(1)')).toBe(false);
		expect(isSafeDocxLinkTarget('\u0001javascript:alert(1)')).toBe(false);
		expect(isSafeDocxLinkTarget('')).toBe(false);
	});
});
