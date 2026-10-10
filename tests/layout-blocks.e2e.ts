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
	// Pointer events before hydration are dropped on the dev server.
	await page.waitForLoadState('networkidle');

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
	// Scroll events before hydration are dropped on the dev server.
	await page.waitForLoadState('networkidle');

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

test('layout-blocks rows size to their content: tall blocks are not clipped, short ones are not padded', async ({
	page
}) => {
	await page.goto('/layout-blocks');
	await page.waitForLoadState('networkidle');
	const panel = page.getByTestId('sample-panel');
	const tall = panel.locator('[data-block-id="sample-long-paragraph"]');
	const short = panel.locator('[data-block-id="sample-page-number"]');
	await tall.scrollIntoViewIfNeeded();
	await expect(tall).toBeVisible();

	// Measurement settles after the first paint.
	await expect
		.poll(() =>
			tall.evaluate((node) =>
				[node, node.querySelector('.layout-block-body') as HTMLElement].every(
					(element) => element.scrollHeight <= element.clientHeight
				)
			)
		)
		.toBe(true);
	const tallHeight = await tall.evaluate((node) => node.getBoundingClientRect().height);
	expect(tallHeight).toBeGreaterThan(140);

	await short.scrollIntoViewIfNeeded();
	const shortRowHeight = await short.evaluate(
		(node) => (node.closest('[data-virtual-index]') as HTMLElement).getBoundingClientRect().height
	);
	expect(shortRowHeight).toBeLessThan(140);

	// Rows never overlap once measured.
	const rects = await panel
		.locator('[data-virtual-index]')
		.evaluateAll((rows) =>
			rows
				.map((row) => row.getBoundingClientRect())
				.sort((a, b) => a.top - b.top)
				.map((rect) => ({ top: rect.top, bottom: rect.bottom }))
		);
	for (let index = 1; index < rects.length; index += 1) {
		expect(rects[index]!.top).toBeGreaterThanOrEqual(rects[index - 1]!.bottom - 0.5);
	}
});

test('layout-blocks colors the active block ring by block type, like upstream', async ({ page }) => {
	await page.goto('/layout-blocks');
	await page.waitForLoadState('networkidle');
	const panel = page.getByTestId('sample-panel');

	const heading = panel.locator('[data-block-id="sample-heading"]');
	await heading.click();
	await expect(heading).toHaveAttribute('data-active', 'true');
	await expect(heading).toHaveCSS('border-top-color', 'rgba(139, 92, 246, 0.6)');

	const table = panel.locator('[data-block-id="sample-table"]');
	await table.click();
	await expect(table).toHaveCSS('border-top-color', 'rgba(245, 158, 11, 0.6)');
});
