// MIT License — Svelte 5 port of Extend UI docx-viewer engine. Upstream: extend-hq/ui (MIT).
import { expect, test, type Page } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const FIXTURE_PATH = join(
	dirname(fileURLToPath(import.meta.url)),
	'fixtures',
	'sample.docx'
);
const EXPECTED_TEXT = 'Hello from the DOCX fixture';
const SECOND_TEXT = 'Second paragraph for the thumbnail sidebar.';

function fixtureBytes(): number[] {
	if (!existsSync(FIXTURE_PATH)) {
		throw new Error(`Missing ${FIXTURE_PATH}. Run: node tests/fixtures/generate-docx.mjs`);
	}
	return Array.from(readFileSync(FIXTURE_PATH));
}

/** Loads the harness and waits until its engine hook is ready. */
async function gotoHarness(page: Page, query = ''): Promise<void> {
	await page.goto(`/engines/docx${query}`);
	await page.waitForFunction(() => (window as unknown as { __docxHarness?: unknown }).__docxHarness, {
		timeout: 15000
	});
}

/** Renders the fixture bytes through the harness page's engine hook. */
async function renderFixtureBytes(page: Page, query = ''): Promise<void> {
	await gotoHarness(page, query);
	await page.evaluate(async ({ bytes }) => {
		const hook = (
			window as unknown as {
				__docxHarness: { render: (bytes: number[]) => Promise<{ showThumbnails: boolean }> };
			}
		).__docxHarness;
		await hook.render(bytes);
	}, { bytes: fixtureBytes() });
}

test('renders the served fixture from its URL into the container', async ({ page }) => {
	await gotoHarness(page);

	const container = page.getByTestId('docx-container');
	await expect(container).toContainText(EXPECTED_TEXT);
	await expect(container).toContainText(SECOND_TEXT);
});

test('renders docx bytes into the container', async ({ page }) => {
	await renderFixtureBytes(page);

	const container = page.getByTestId('docx-container');
	await expect(container).toContainText(EXPECTED_TEXT);
	await expect(container).toContainText(SECOND_TEXT);
});

test('hides the thumbnail sidebar by default', async ({ page }) => {
	await renderFixtureBytes(page);

	await expect(page.getByTestId('docx-container')).toContainText(EXPECTED_TEXT);
	await expect(page.getByTestId('docx-thumbnails')).toBeHidden();
});

test('shows the thumbnail sidebar when the flag is on', async ({ page }) => {
	await renderFixtureBytes(page, '?thumbnails=1');

	await expect(page.getByTestId('docx-container')).toContainText(EXPECTED_TEXT);
	await expect(page.getByTestId('docx-thumbnails')).toBeVisible();
});
