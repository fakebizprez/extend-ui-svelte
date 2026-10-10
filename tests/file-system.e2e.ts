// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
import { expect, test } from '@playwright/test';

test('file-system expands a folder to reveal its children', async ({ page }) => {
	await page.goto('/file-system');

	const tree = page.getByRole('tree', { name: 'Sample files' });
	await expect(tree).toBeVisible();
	await expect(page.getByRole('treeitem', { name: /jan\.pdf/ })).toBeHidden();

	await page.getByRole('button', { name: 'Expand invoices' }).click();
	await page.getByRole('button', { name: 'Expand 2026' }).click();

	await expect(page.getByRole('treeitem', { name: /jan\.pdf/ })).toBeVisible();
	await expect(page.getByRole('treeitem', { name: /feb\.pdf/ })).toBeVisible();
});

test('file-system selects an entry and reports it to the parent', async ({ page }) => {
	await page.goto('/file-system');

	const row = page.getByRole('treeitem', { name: /readme\.txt/ });
	await row.click();

	await expect(row).toHaveAttribute('aria-selected', 'true');
	await expect(page.getByTestId('file-system-selection')).toContainText('readme.txt');
});

test('file-system renames an entry inline with F2', async ({ page }) => {
	await page.goto('/file-system');

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
