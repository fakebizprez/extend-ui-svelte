// MIT License — Svelte 5 port of Extend UI document-splits. Upstream: extend-hq/ui (MIT).
import { expect, test, type Page } from '@playwright/test';

async function splitTitles(page: Page): Promise<string[]> {
	return page.getByTestId('split-group').getByLabel(/Split title/).evaluateAll((inputs) =>
		inputs.map((input) => (input as HTMLInputElement).value)
	);
}

test('groups the sample PDF pages into initial splits', async ({ page }) => {
	await page.goto('/document-splits');

	await expect(page.getByTestId('document-splits')).toBeVisible();
	await expect(page.getByTestId('split-group')).toHaveCount(3, { timeout: 30000 });
	await expect(page.getByText('Sample PDF: 3 pages')).toBeVisible();
	expect(await splitTitles(page)).toEqual(['Page 1', 'Page 2', 'Page 3']);
});

test('creates a split through the Add split control', async ({ page }) => {
	await page.goto('/document-splits');

	await expect(page.getByTestId('split-group')).toHaveCount(3, { timeout: 30000 });

	await page.getByRole('button', { name: 'Add split' }).click();

	await expect(page.getByTestId('split-group')).toHaveCount(4);
	expect(await splitTitles(page)).toContain('Split 4');
	await expect(page.getByText('Drop pages here')).toBeVisible();
});

test('creates a split by splitting a group in two', async ({ page }) => {
	await page.goto('/document-splits');

	await expect(page.getByTestId('split-group')).toHaveCount(3, { timeout: 30000 });

	// Single-page groups cannot split, so move page 2 into the first split first.
	await page.getByRole('button', { name: 'Move page 2 to previous split' }).click();
	await expect(page.getByTestId('split-group').first()).toContainText('Pages 1, 2');

	await page.getByRole('button', { name: 'Split Page 1 in two' }).click();

	await expect(page.getByTestId('split-group')).toHaveCount(4);
	expect(await splitTitles(page)).toContain('Page 1 (2)');
});

test('reorders splits through the move controls', async ({ page }) => {
	await page.goto('/document-splits');

	await expect(page.getByTestId('split-group')).toHaveCount(3, { timeout: 30000 });

	await page.getByRole('button', { name: 'Move Page 2 up' }).click();

	expect(await splitTitles(page)).toEqual(['Page 2', 'Page 1', 'Page 3']);

	await page.getByRole('button', { name: 'Move Page 2 down' }).click();

	expect(await splitTitles(page)).toEqual(['Page 1', 'Page 2', 'Page 3']);
});

test('moves a page across splits through the controls', async ({ page }) => {
	await page.goto('/document-splits');

	await expect(page.getByTestId('split-group')).toHaveCount(3, { timeout: 30000 });

	await page.getByRole('button', { name: 'Move page 3 to previous split' }).click();

	await expect(page.getByTestId('split-group').nth(1)).toContainText('Pages 2, 3');
	await expect(page.getByTestId('split-group').nth(2)).toContainText('No pages');
});
