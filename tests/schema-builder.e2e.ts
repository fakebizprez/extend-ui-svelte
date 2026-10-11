// MIT License — Svelte 5 port of Extend UI schema-builder. Upstream: extend-hq/ui (MIT).
import { expect, test, type Page } from '@playwright/test';

// Clicks before hydration are dropped on the dev server, so wait for the client bundle.
async function openBuilder(page: Page): Promise<void> {
	await page.goto('/schema-builder');
	await page.waitForLoadState('networkidle');
}

test('field add/edit/remove updates the emitted schema', async ({ page }) => {
	await openBuilder(page);

	const builder = page.getByTestId('schema-builder');
	await expect(builder).toBeVisible();

	// The docs page seeds two fields; adding a third row works.
	await page.getByRole('button', { name: 'Add field' }).click();
	const rows = page.getByTestId('schema-builder-field');
	await expect(rows).toHaveCount(3);

	// Edit the new field's key and type.
	const newRow = rows.nth(2);
	await newRow.getByLabel('Field key').fill('dueDate');
	await newRow.getByLabel('Field type').selectOption('string');

	const output = page.getByTestId('schema-builder-output');
	await expect(output).toContainText('"dueDate"');

	// Mark it required: the serialized output gains a required entry.
	await newRow.getByLabel('Required').check();
	await expect(output).toContainText('"required"');
	await expect(output).toContainText('"dueDate"');

	// The docs page mirrors the live serialized-schema event.
	await expect(page.getByTestId('schema-builder-docs-output')).toContainText('"dueDate"');

	// Remove the field: the emitted schema drops it again.
	await newRow.getByRole('button', { name: 'Remove field' }).click();
	await expect(rows).toHaveCount(2);
	await expect(output).not.toContainText('"dueDate"');
});

test('array fields with enum items accept enum values that reach the emitted schema', async ({
	page
}) => {
	await openBuilder(page);

	await page.getByRole('button', { name: 'Add field' }).click();
	const row = page.getByTestId('schema-builder-field').nth(2);
	await row.getByLabel('Field key').fill('labels');
	await row.getByLabel('Field type').selectOption('array');
	await row.getByLabel('Array item type').selectOption('enum');

	const editor = row.getByTestId('schema-builder-enum-editor');
	await expect(editor).toBeVisible();
	await expect(editor.getByLabel('Enum value')).toHaveCount(1);
	await editor.getByLabel('Enum value').first().fill('urgent');

	const output = page.getByTestId('schema-builder-output');
	await expect(output).toContainText('"labels"');
	await expect(output).toContainText('"enum": [');
	await expect(output).toContainText('"urgent"');
	await expect(page.getByTestId('schema-builder-docs-output')).toContainText('"urgent"');
});

test('has no theme toggle of its own; the page toggles dark mode from outside', async ({ page }) => {
	await openBuilder(page);
	const builder = page.getByTestId('schema-builder');

	await expect(builder.getByRole('button', { name: /dark mode|light mode/i })).toHaveCount(0);
	await page.getByLabel('Dark mode').check();
	await expect(builder).toHaveAttribute('data-theme', 'dark');
});

test('docs page lists the differences from upstream', async ({ page }) => {
	await openBuilder(page);

	const differences = page.getByRole('region', { name: 'Differences from upstream' });
	await expect(differences).toContainText('SchemaBuilderPanel');
	await expect(differences).toContainText('theme');
});

async function emitted(page: Page) {
	return JSON.parse((await page.getByTestId('schema-builder-docs-output').textContent()) ?? '{}');
}

test('Required on a nested object field reaches the emitted schema', async ({ page }) => {
	await openBuilder(page);

	await page.getByRole('button', { name: 'Add field' }).click();
	const row = page.getByTestId('schema-builder-field').nth(2);
	await row.getByLabel('Field key').first().fill('address');
	await row.getByLabel('Field type').first().selectOption('object');
	const nested = row.getByTestId('schema-builder-nested-field').first();
	await nested.getByLabel('Field key').fill('city');
	await nested.getByLabel('Required').check();

	await expect(page.getByTestId('schema-builder-docs-output')).toContainText('"city"');
	await expect.poll(async () => (await emitted(page)).properties?.address?.required).toEqual([
		'city'
	]);
});

test('array-of-object items accept new properties', async ({ page }) => {
	await openBuilder(page);

	await page.getByRole('button', { name: 'Add field' }).click();
	const row = page.getByTestId('schema-builder-field').nth(2);
	await row.getByLabel('Field key').first().fill('lines');
	await row.getByLabel('Field type').first().selectOption('array');
	const editor = row.getByTestId('schema-builder-array-editor');
	await expect(editor.getByTestId('schema-builder-nested-field')).toHaveCount(1);

	await editor.getByRole('button', { name: 'Add nested field' }).click();
	await expect(editor.getByTestId('schema-builder-nested-field')).toHaveCount(2);
	await editor.getByTestId('schema-builder-nested-field').nth(1).getByLabel('Field key').fill('sku');

	await expect
		.poll(async () => Object.keys((await emitted(page)).properties?.lines?.items?.properties ?? {}))
		.toContain('sku');
});
