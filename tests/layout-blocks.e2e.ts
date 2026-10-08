// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
import { expect, test } from '@playwright/test';

const LONG_DOCUMENT_BLOCK_COUNT = 200;

test('layout-blocks sample panel renders blocks with markdown', async ({ page }) => {
	await page.goto('/layout-blocks');

	const panel = page.getByTestId('sample-panel');
	await expect(panel.getByTestId('layout-block').first()).toBeVisible();

	await expect(panel.getByText('Heading').first()).toBeVisible();
	await expect(
		panel.getByRole('heading', { name: 'Attention Is All You Need' })
	).toBeVisible();
	await expect(panel.getByRole('table')).toBeVisible();
	await expect(panel.getByText('p. 2')).toBeVisible();
});

test('layout-blocks reports the focused block to the parent', async ({ page }) => {
	await page.goto('/layout-blocks');

	const panel = page.getByTestId('sample-panel');
	await panel.locator('[data-block-id="sample-table"]').click();

	await expect(page.getByTestId('focused-block')).toHaveText(
		'Focused block: sample-table'
	);
});

test('layout-blocks windows long documents instead of rendering every row', async ({
	page
}) => {
	await page.goto('/layout-blocks');

	const panel = page.getByTestId('long-panel');
	const rows = panel.getByTestId('layout-block');
	await expect(rows.first()).toBeVisible();

	expect(await rows.count()).toBeLessThan(LONG_DOCUMENT_BLOCK_COUNT);
	await expect(panel.locator('[data-block-id="long-block-0"]')).toBeVisible();
	await expect(panel.locator('[data-block-id="long-block-199"]')).toBeHidden();

	const viewport = panel.getByTestId('virtual-viewport');
	await viewport.evaluate((node) => {
		node.scrollTop = node.scrollHeight;
	});

	await expect(panel.locator('[data-block-id="long-block-199"]')).toBeVisible();
	expect(await rows.count()).toBeLessThan(LONG_DOCUMENT_BLOCK_COUNT);
});
