// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
import { expect, test, type Page } from '@playwright/test';

// The dev server reloads the page once after load; clicks before the settled,
// hydrated page are dropped, so wait for network idle first.
// The disclosure chevron is a mouse-only target, aria-hidden like upstream's.
function chevron(page: Page, name: string) {
	return page
		.getByRole('treeitem', { name, exact: true })
		.getByTestId('file-system-toggle')
		.first();
}

async function openFileSystem(page: Page): Promise<void> {
	await page.goto('/file-system');
	await page.waitForLoadState('networkidle');
}

test('file-system expands a folder to reveal its children', async ({ page }) => {
	await openFileSystem(page);

	const tree = page.getByRole('tree', { name: 'Sample files' });
	await expect(tree).toBeVisible();
	await expect(page.getByRole('treeitem', { name: /jan\.pdf/ })).toBeHidden();

	await chevron(page, 'invoices').click();
	await chevron(page, '2026').click();

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

test('after collapsing the focused row\'s parent, Tab reaches that parent row', async ({ page }) => {
	await openFileSystem(page);

	await chevron(page, 'invoices').click();
	await page.getByRole('treeitem', { name: /2026/ }).click();
	await chevron(page, 'invoices').click();

	await page.getByLabel('Dark mode').focus();
	await page.keyboard.press('Tab');
	await expect(page.getByRole('treeitem', { name: /invoices/ })).toBeFocused();
});

test('arrow keys move the selection and report it, like upstream', async ({ page }) => {
	await openFileSystem(page);

	await page.getByRole('treeitem', { name: /invoices/ }).focus();
	await page.keyboard.press('ArrowDown');

	await expect(page.getByRole('treeitem', { name: /readme\.txt/ })).toHaveAttribute(
		'aria-selected',
		'true'
	);
	await expect(page.getByTestId('file-system-selection')).toContainText('readme.txt');
});

test('folder rows are named by the folder alone; aria-expanded carries the state', async ({
	page
}) => {
	await openFileSystem(page);

	const invoices = page.getByRole('treeitem', { name: 'invoices', exact: true });
	await expect(invoices).toHaveAttribute('aria-expanded', 'false');
	await invoices.press('ArrowRight');
	await expect(invoices).toHaveAttribute('aria-expanded', 'true');

	// Chromium's own accessibility tree agrees.
	const cdp = await page.context().newCDPSession(page);
	const { nodes } = (await cdp.send('Accessibility.getFullAXTree')) as {
		nodes: { role?: { value?: string }; name?: { value?: string } }[];
	};
	const names = nodes
		.filter((node) => node.role?.value === 'treeitem')
		.map((node) => node.name?.value);
	expect(names).toEqual(expect.arrayContaining(['invoices', '2026', 'readme.txt']));
	expect(names.filter((name) => /Expand|Collapse/.test(name ?? ''))).toEqual([]);
});
