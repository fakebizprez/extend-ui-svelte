// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
import { expect, test, type Page } from '@playwright/test';

const WIDE = { width: 1600, height: 900 };
const NARROW = { width: 700, height: 900 };

// The viewer width is measured on the client, so "inline" at a wide viewport
// doubles as the hydration signal.
async function openWide(page: Page) {
	await page.setViewportSize(WIDE);
	await page.goto('/document-viewer-sidebar');
	await page.waitForLoadState('networkidle');
	const sidebar = page.locator('[data-document-thumbnail-sidebar]');
	await expect(sidebar).toHaveAttribute('data-sidebar-mode', 'inline', { timeout: 30000 });
	return sidebar;
}

test('sidebar sits inline beside the page on a wide viewer', async ({ page }) => {
	const sidebar = await openWide(page);

	await expect(sidebar).toHaveAttribute('data-sidebar-open', 'true');
	await expect(page.getByText('Inline thumbnails')).toBeVisible();
	await expect(page.getByText('Page 1 of 4')).toBeVisible();
	await expect(page.getByText('Page 1: Invoice summary')).toBeVisible();

	const sidebarBox = (await sidebar.boundingBox())!;
	const contentBox = (await page.getByTestId('viewer-content').boundingBox())!;
	expect(Math.round(sidebarBox.width)).toBe(160);
	expect(contentBox.x).toBeGreaterThanOrEqual(sidebarBox.x + sidebarBox.width - 1);
});

test('clicking a thumbnail changes the active page', async ({ page }) => {
	await openWide(page);

	await page.getByRole('button', { name: '2', exact: true }).click();

	await expect(page.getByText('Page 2 of 4')).toBeVisible();
	await expect(page.getByText('Page 2: Line items')).toBeVisible();
});

test('sidebar becomes an overlay when the viewer narrows, and closes off-screen', async ({
	page
}) => {
	const sidebar = await openWide(page);

	await page.setViewportSize(NARROW);
	await expect(sidebar).toHaveAttribute('data-sidebar-mode', 'overlay');
	await expect(page.getByText('Overlay thumbnails')).toBeVisible();

	// The overlay covers the page instead of pushing it aside.
	const sidebarBox = (await sidebar.boundingBox())!;
	const contentBox = (await page.getByTestId('viewer-content').boundingBox())!;
	expect(contentBox.x).toBeLessThan(sidebarBox.x + sidebarBox.width);

	await page.getByRole('button', { name: 'Toggle thumbnails' }).click();
	await expect(sidebar).toHaveAttribute('data-sidebar-open', 'false');
	await expect(page.locator('[data-document-sidebar-skeleton]')).toHaveCount(0);
	await expect
		.poll(async () => {
			const box = (await sidebar.boundingBox())!;
			return box.x + box.width;
		})
		.toBeLessThanOrEqual(contentBox.x + 1);
});

// Upstream layout: the closed inline sidebar pulls back by its own width
// (-ml-40), landing on the skeleton column while the page keeps its place.
test('closing the inline sidebar pulls it back onto the inline skeleton', async ({ page }) => {
	const sidebar = await openWide(page);
	const contentBefore = (await page.getByTestId('viewer-content').boundingBox())!;

	await page.getByRole('button', { name: 'Toggle thumbnails' }).click();

	await expect(sidebar).toHaveAttribute('data-sidebar-open', 'false');
	const skeleton = page.locator('[data-document-sidebar-skeleton]');
	await expect(skeleton).toBeVisible();

	const skeletonBox = (await skeleton.boundingBox())!;
	const sidebarBox = (await sidebar.boundingBox())!;
	const contentAfter = (await page.getByTestId('viewer-content').boundingBox())!;
	expect(Math.round(skeletonBox.width)).toBe(160);
	expect(sidebarBox.x).toBeCloseTo(skeletonBox.x, 0);
	expect(contentAfter.x).toBeCloseTo(contentBefore.x, 0);
});

test('dark mode comes from the parent page, not the sidebar', async ({ page }) => {
	const sidebar = await openWide(page);
	const lightBackground = await sidebar.evaluate((node) => getComputedStyle(node).backgroundColor);

	await expect(sidebar.getByRole('button', { name: /dark|light|theme/i })).toHaveCount(0);
	await page.getByRole('button', { name: 'Dark mode' }).click();

	await expect(sidebar).toHaveClass(/\bdark\b/);
	await expect
		.poll(() => sidebar.evaluate((node) => getComputedStyle(node).backgroundColor))
		.not.toBe(lightBackground);
});
