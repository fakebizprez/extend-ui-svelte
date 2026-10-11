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
		section.textContent = doc;
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

import { clearDocx, DocxRenderCancelledError, renderDocx } from './index.js';

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
