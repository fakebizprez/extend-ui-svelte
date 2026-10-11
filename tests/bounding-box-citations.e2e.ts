// MIT License — Svelte 5 port of Extend UI bounding-box-citations. Upstream: extend-hq/ui (MIT).
import { expect, test, type Locator, type Page } from '@playwright/test';

async function openPage(page: Page) {
	await page.goto('/bounding-box-citations');
	await expect(page.getByTestId('pdf-page-indicator').first()).toContainText('Page 1 of 1', {
		timeout: 30000
	});
	await page.waitForLoadState('networkidle');
}

/** Share of the highlight's area that covers dark (text) pixels on its page canvas. */
function inkUnderHighlight(highlight: Locator): Promise<number> {
	return highlight.evaluate((element) => {
		const canvas = element.closest('[data-page-number]')?.querySelector('canvas');
		const context = canvas?.getContext('2d');
		if (!canvas || !context) return 0;
		const box = element.getBoundingClientRect();
		const page = canvas.getBoundingClientRect();
		const scaleX = canvas.width / page.width;
		const scaleY = canvas.height / page.height;
		const width = Math.max(1, Math.round(box.width * scaleX));
		const height = Math.max(1, Math.round(box.height * scaleY));
		const { data } = context.getImageData(
			Math.round((box.left - page.left) * scaleX),
			Math.round((box.top - page.top) * scaleY),
			width,
			height
		);
		let ink = 0;
		for (let i = 0; i < data.length; i += 4) {
			if (data[i + 3] > 0 && Math.min(data[i], data[i + 1], data[i + 2]) < 160) ink++;
		}
		return ink / (width * height);
	});
}

test('panel demo: editing a field marks it modified, undo reverts, and the JSON tab diffs it', async ({
	page
}) => {
	await openPage(page);
	const demo = page.getByTestId('human-review-demo');
	const period = demo.locator('[data-review-field="statement_period"]');

	await expect(period.getByText('Jan 1-31, 2026')).toBeVisible();
	const input = period.getByLabel('Expected statement_period');
	await expect(input).toHaveValue('January 1-31, 2026');
	await input.fill('Jan 2026');
	await expect(period).toHaveAttribute('data-modified', 'true');

	await demo.getByRole('tab', { name: 'JSON' }).click();
	const diff = demo.getByTestId('json-diff');
	await expect(diff.locator('[data-kind="added"]').filter({ hasText: '"Jan 2026"' })).toBeVisible();
	await expect(diff.locator('[data-kind="removed"]').filter({ hasText: '"Jan 1-31, 2026"' })).toBeVisible();

	await demo.getByRole('tab', { name: 'Form' }).click();
	await period.getByRole('button', { name: 'Undo statement_period' }).click();
	await expect(input).toHaveValue('January 1-31, 2026');
	await expect(period).toHaveAttribute('data-modified', 'false');

	await period.getByRole('button', { name: 'Set statement_period to null' }).click();
	await expect(input).toHaveValue('');
});

test('panel demo: array cells edit in place and drill into nested values on both grids', async ({
	page
}) => {
	await openPage(page);
	const transactions = page
		.getByTestId('human-review-demo')
		.locator('[data-review-field="transactions"]');
	const expectedGrid = transactions.getByRole('grid', { name: 'Expected' }).first();

	await expectedGrid.locator('[data-row="1"][data-column="amount"]').dblclick();
	const editor = expectedGrid.getByRole('textbox', { name: 'Edit cell' });
	await editor.fill('-70');
	await editor.press('Enter');
	await expect(expectedGrid.locator('[data-row="1"][data-column="amount"]')).toHaveText('-70');

	await expectedGrid.locator('[data-row="1"][data-column="merchant"]').dblclick();
	const views = transactions.getByTestId('array-nested-view');
	await expect(views).toHaveCount(2);
	await expect(views.nth(0)).toContainText('Merchant / row 2');
	await expect(views.nth(1).getByLabel('Expected risk_level')).toHaveValue('low');

	await views.nth(1).getByRole('button', { name: 'Back to parent array' }).click();
	await expect(views).toHaveCount(0);
});

test('block: focusing a field highlights its box over the cited statement text', async ({ page }) => {
	await openPage(page);
	const block = page.getByTestId('bounding-box-citations');
	const highlight = block.getByTestId('citation-highlight');

	await block.locator('[data-review-field="statement_period"]').getByLabel('Expected statement_period').focus();
	await expect(page.getByTestId('docs-active-citation')).toContainText('statement_period');
	await expect(highlight).toBeVisible();
	await expect(highlight).toHaveAttribute('data-page', '1');
	await expect(
		block.locator('[data-testid="citation-box"][data-field-key="statement_period"]')
	).toHaveAttribute('data-active', 'true');
	await expect.poll(() => inkUnderHighlight(highlight), { timeout: 10000 }).toBeGreaterThan(0.02);
});

test('block: hovering a transaction row highlights its line on the statement', async ({ page }) => {
	await openPage(page);
	const block = page.getByTestId('bounding-box-citations');
	const highlight = block.getByTestId('citation-highlight');

	await block
		.locator('[data-review-field="transactions"]')
		.getByRole('grid', { name: 'Actual' })
		.first()
		.locator('[data-row="0"][data-column="amount"]')
		.hover();
	await expect(highlight).toBeVisible();
	const area = await highlight.evaluate((element) => element.style.top);
	expect(Number.parseFloat(area)).toBeCloseTo((130.2048 / 792) * 100, 1);
	await expect.poll(() => inkUnderHighlight(highlight), { timeout: 10000 }).toBeGreaterThan(0.02);
});

test('block: clicking a citation box focuses its field card', async ({ page }) => {
	await openPage(page);
	const block = page.getByTestId('bounding-box-citations');

	await block.locator('[data-testid="citation-box"][data-field-key="statement_period"]').click();
	await expect(page.getByTestId('docs-active-citation')).toContainText('statement_period');
	const card = block.locator('[data-review-field="statement_period"]');
	await expect(card).toHaveAttribute('data-active', 'true');
	await expect(card).toBeInViewport();
});

test('panel demo: clicking another field after a grid edit keeps focus there', async ({ page }) => {
	await openPage(page);
	const demo = page.getByTestId('human-review-demo');
	const expectedGrid = demo
		.locator('[data-review-field="transactions"]')
		.getByRole('grid', { name: 'Expected' })
		.first();

	await expectedGrid.locator('[data-row="0"][data-column="category"]').dblclick();
	await expectedGrid.getByRole('textbox', { name: 'Edit cell' }).fill('Other');
	const period = demo.getByLabel('Expected statement_period');
	await period.click();
	await page.keyboard.type('!');

	await expect(period).toBeFocused();
	await expect(period).toHaveValue(/!$/);
	await expect(expectedGrid.locator('[data-row="0"][data-column="category"]')).toHaveText('Other');
});

test('block: focusing a field on page 3 centers its box in the viewer', async ({ page }) => {
	await page.goto('/bounding-box-citations/multi-page');
	await expect(page.getByTestId('pdf-page-indicator').first()).toContainText('Page 1 of 3', {
		timeout: 30000
	});
	await page.waitForLoadState('networkidle');
	const block = page.getByTestId('bounding-box-citations');

	await block.getByLabel('Expected page_3').focus();
	const highlight = block.getByTestId('citation-highlight');
	await expect(highlight).toHaveAttribute('data-page', '3');
	const viewport = block.getByTestId('pdf-viewport');
	await expect
		.poll(
			async () => {
				const view = await viewport.boundingBox();
				const box = await highlight.boundingBox();
				if (!view || !box) return Number.POSITIVE_INFINITY;
				return Math.abs(box.y + box.height / 2 - (view.y + view.height / 2));
			},
			{ timeout: 10000 }
		)
		.toBeLessThan(4);
	await expect(highlight).toBeInViewport();
});
