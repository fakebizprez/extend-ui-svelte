// MIT License — Svelte 5 port of Extend UI group. Upstream: extend-hq/ui (MIT).
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
	await page.goto('/group');
	// Clicks before hydration are dropped on the dev server.
	await page.waitForLoadState('networkidle');
	await page.locator('[data-ready]').waitFor();
});

test('group page shows horizontal, vertical, text, and nested groups', async ({ page }) => {
	const horizontal = page.getByRole('group', { name: 'Clipboard actions' });
	await expect(horizontal).toHaveAttribute('data-slot', 'group');
	await expect(horizontal.getByRole('button')).toHaveCount(3);
	await expect(horizontal.getByRole('separator')).toHaveCount(2);

	await expect(page.getByRole('group', { name: 'Vertical actions' })).toHaveAttribute(
		'data-orientation',
		'vertical'
	);
	const amount = page.getByRole('group', { name: 'Amount' });
	await expect(amount.locator('[data-slot="group-text"]')).toHaveText(['$', 'USD']);

	const nested = page.getByRole('group', { name: 'Toolbar' });
	await expect(nested.getByRole('group')).toHaveCount(2);
});

// The join classes are Tailwind utilities; the docs site does not load Tailwind yet.
test('grouped buttons sit edge to edge like upstream', async ({
	page
}) => {
	const horizontal = page.getByRole('group', { name: 'Clipboard actions' });
	const boxes = await horizontal.locator('button').evaluateAll((buttons) =>
		buttons.map((button) => button.getBoundingClientRect())
	);
	for (let index = 1; index < boxes.length; index += 1) {
		expect(boxes[index]!.left).toBeGreaterThanOrEqual(boxes[index - 1]!.right - 1);
	}
});

test('group buttons are clickable and reachable with the keyboard in order', async ({ page }) => {
	const horizontal = page.getByRole('group', { name: 'Clipboard actions' });
	await horizontal.getByRole('button', { name: 'Paste' }).click();
	await expect(page.getByTestId('group-last-action')).toHaveText('Last action: Paste');

	await horizontal.getByRole('button', { name: 'Copy' }).focus();
	await page.keyboard.press('Tab');
	await expect(horizontal.getByRole('button', { name: 'Paste' })).toBeFocused();
	await page.keyboard.press('Tab');
	await expect(horizontal.getByRole('button', { name: 'Cut' })).toBeFocused();
	await page.keyboard.press('Enter');
	await expect(page.getByTestId('group-last-action')).toHaveText('Last action: Cut');
});

test('group dark mode follows the parent toggle outside the component', async ({ page }) => {
	const groups = page.locator('[data-slot="group"]');
	await expect(groups.first()).not.toHaveClass(/\bdark\b/);

	await page.getByLabel('Dark mode').check();
	for (const group of await groups.all()) await expect(group).toHaveClass(/\bdark\b/);

	await page.getByLabel('Dark mode').uncheck();
	await expect(groups.first()).not.toHaveClass(/\bdark\b/);
});
