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

type Edges = {
	tl: number; tr: number; br: number; bl: number;
	top: number; right: number; bottom: number; left: number;
	x: number; y: number; w: number; h: number;
};

async function edges(locator: import('@playwright/test').Locator): Promise<Edges[]> {
	return locator.evaluateAll((nodes) =>
		nodes.map((node) => {
			const style = getComputedStyle(node);
			const rect = node.getBoundingClientRect();
			return {
				tl: parseFloat(style.borderTopLeftRadius),
				tr: parseFloat(style.borderTopRightRadius),
				br: parseFloat(style.borderBottomRightRadius),
				bl: parseFloat(style.borderBottomLeftRadius),
				top: parseFloat(style.borderTopWidth),
				right: parseFloat(style.borderRightWidth),
				bottom: parseFloat(style.borderBottomWidth),
				left: parseFloat(style.borderLeftWidth),
				x: rect.left, y: rect.top, w: rect.width, h: rect.height
			};
		})
	);
}

// Upstream groupVariants: inner corners lose their radius and the inner edges
// lose their border, so adjoining items never draw a double border.
test('horizontal group joins items like upstream: square inner corners, no double borders', async ({
	page
}) => {
	const horizontal = page.getByRole('group', { name: 'Clipboard actions' });
	const [copy, paste, cut] = await edges(horizontal.locator('button'));
	const [firstSeparator] = await edges(horizontal.getByRole('separator'));

	// Outer corners keep the button radius.
	expect(copy!.tl).toBeGreaterThan(0);
	expect(copy!.bl).toBeGreaterThan(0);
	expect(cut!.tr).toBeGreaterThan(0);
	expect(cut!.br).toBeGreaterThan(0);
	expect(copy!.left).toBeGreaterThan(0);
	expect(cut!.right).toBeGreaterThan(0);

	// Inner corners are square and inner edges have no border.
	expect([copy!.tr, copy!.br, copy!.right]).toEqual([0, 0, 0]);
	expect([paste!.tl, paste!.tr, paste!.br, paste!.bl, paste!.left, paste!.right]).toEqual([
		0, 0, 0, 0, 0, 0
	]);
	expect([cut!.tl, cut!.bl, cut!.left]).toEqual([0, 0, 0]);

	// Between two items there is exactly the 1px separator line.
	expect(firstSeparator!.w).toBe(1);
	expect(Math.round(paste!.x - (copy!.x + copy!.w))).toBe(1);
});

test('vertical group joins items top to bottom like upstream', async ({ page }) => {
	const vertical = page.getByRole('group', { name: 'Vertical actions' });
	const [up, down] = await edges(vertical.locator('button'));

	expect(up!.tl).toBeGreaterThan(0);
	expect(down!.bl).toBeGreaterThan(0);
	expect([up!.bl, up!.br, up!.bottom]).toEqual([0, 0, 0]);
	expect([down!.tl, down!.tr, down!.top]).toEqual([0, 0, 0]);
	expect(Math.round(down!.y - (up!.y + up!.h))).toBe(1);
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
