// MIT License — Svelte 5 port of Extend UI schema-builder. Upstream: extend-hq/ui (MIT).
import { expect, test } from '@playwright/test';

test('field add/edit/remove updates the emitted schema', async ({ page }) => {
	await page.goto('/schema-builder');

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
