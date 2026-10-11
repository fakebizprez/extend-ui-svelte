// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
import { expect, test, type Page } from '@playwright/test';

// The dev server reloads the page once after load; clicks before the settled,
// hydrated page are dropped, so wait for network idle first.
async function openFileSystem(page: Page): Promise<void> {
	await page.goto('/file-system');
	await page.waitForLoadState('networkidle');
}

test('file-system expands a folder to reveal its children', async ({ page }) => {
	await openFileSystem(page);

	const tree = page.getByRole('tree', { name: 'Sample files' });
	await expect(tree).toBeVisible();
	await expect(page.getByRole('treeitem', { name: /jan\.pdf/ })).toBeHidden();

	await page.getByRole('button', { name: 'Expand invoices' }).click();
	await page.getByRole('button', { name: 'Expand 2026' }).click();

	await expect(page.getByRole('treeitem', { name: /jan\.pdf/ })).toBeVisible();
	await expect(page.getByRole('treeitem', { name: /feb\.pdf/ })).toBeVisible();
});

test('file-system selects an entry and reports it to the parent', async ({ page }) => {
	await openFileSystem(page);

	const row = page.getByRole('treeitem', { name: /readme\.txt/ });
	await row.click();

	await expect(row).toHaveAttribute('aria-selected', 'true');
	await expect(page.getByTestId('file-system-selection')).toContainText('readme.txt');
});

test('file-system renames an entry inline with F2', async ({ page }) => {
	await openFileSystem(page);

	const row = page.getByRole('treeitem', { name: /readme\.txt/ });
	await row.click();
	await row.press('F2');

	const input = page.getByRole('textbox', { name: 'Rename readme.txt' });
	await expect(input).toBeVisible();
	await input.fill('notes.txt');
	await input.press('Enter');

	await expect(page.getByRole('treeitem', { name: /notes\.txt/ })).toBeVisible();
	await expect(page.getByTestId('file-system-rename')).toContainText('notes.txt');
});

test('file-system double-click opens a file through onFileOpen and getFileUrl', async ({
	page
}) => {
	await openFileSystem(page);

	await page.getByRole('treeitem', { name: /readme\.txt/ }).dblclick();

	await expect(page.getByTestId('file-system-open')).toHaveText(
		'Last opened: readme.txt -> /files/readme.txt'
	);
});

test('file-system has no theme toggle of its own; docs list the differences', async ({ page }) => {
	await openFileSystem(page);

	await expect(page.getByTestId('file-system').getByRole('button', { name: /dark/i })).toHaveCount(
		0
	);
	const differences = page.getByRole('region', { name: 'Differences from upstream' });
	await expect(differences).toContainText('gallery');
	await expect(differences).toContainText('onFileOpen');
});

test('file-system opens a file with Enter, like upstream', async ({ page }) => {
	await openFileSystem(page);

	await page.getByRole('treeitem', { name: /readme\.txt/ }).press('Enter');

	await expect(page.getByTestId('file-system-open')).toHaveText(
		'Last opened: readme.txt -> /files/readme.txt'
	);
});

test('file-system type-ahead focuses the entry whose name starts with the typed letters', async ({
	page
}) => {
	await openFileSystem(page);

	await page.getByRole('treeitem', { name: /invoices/ }).focus();
	await page.keyboard.type('rea');

	await expect(page.getByRole('treeitem', { name: /readme\.txt/ })).toBeFocused();
});

test('docs record the defaultPath and export differences', async ({ page }) => {
	await openFileSystem(page);

	const differences = page.getByRole('region', { name: 'Differences from upstream' });
	await expect(differences).toContainText('defaultPath');
	await expect(differences).toContainText('FileSystemLoadChildrenArgs');
});
