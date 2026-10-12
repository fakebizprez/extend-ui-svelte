import { expect, test, type APIRequestContext } from '@playwright/test';
import { PREVIEW_COMPONENTS } from '../src/routes/components';

const ENTRY_LINK = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;

async function getBody(request: APIRequestContext, path: string): Promise<string> {
	const response = await request.get(path);
	expect(response.ok()).toBe(true);
	return response.text();
}

for (const path of ['/llms.txt', '/llms-full.txt']) {
	test(`${path} serves a valid llms.txt document`, async ({ request, baseURL }) => {
		const body = await getBody(request, path);
		const lines = body.split('\n');
		expect(lines[0]).toMatch(/^# Extend UI Svelte$/);
		expect(lines[2]).toMatch(/^> .{1,200}$/);
		expect(body).toContain('## Key Facts');
		expect(body).toContain('## Contact');
		// Entry URLs stay on the docs site or the known upstream/project hosts.
		for (const [, , url] of body.matchAll(ENTRY_LINK)) {
			const host = new URL(url).hostname;
			const ownHost = baseURL ? new URL(baseURL).hostname : '';
			expect(
				url.startsWith('https://extend-ui-svelte.linehaul.ai/') ||
					host === ownHost ||
					host === 'github.com' ||
					host === 'linehaul.ai'
			).toBe(true);
		}
	});
}

test('llms.txt links the home page and every component preview', async ({ request }) => {
	const body = await getBody(request, '/llms.txt');
	expect(body).toContain('https://extend-ui-svelte.linehaul.ai/)');
	for (const { slug } of PREVIEW_COMPONENTS) {
		expect(body).toContain(`https://extend-ui-svelte.linehaul.ai/${slug}`);
	}
});

test('every same-origin URL in both files resolves', async ({ request }) => {
	expect(PREVIEW_COMPONENTS.length).toBeGreaterThan(0);
	for (const path of ['/llms.txt', '/llms-full.txt']) {
		const body = await getBody(request, path);
		const seen = new Set<string>();
		for (const [, , url] of body.matchAll(ENTRY_LINK)) {
			if (!url.startsWith('https://extend-ui-svelte.linehaul.ai/')) continue;
			const local = url.replace('https://extend-ui-svelte.linehaul.ai', '');
			if (seen.has(local)) continue;
			seen.add(local);
			const response = await request.get(local || '/');
			expect(response.ok(), `${url} resolves`).toBe(true);
		}
		expect(seen.size).toBeGreaterThan(0);
	}
});
