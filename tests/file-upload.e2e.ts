// MIT License — Svelte 5 port of Extend UI file-upload. Upstream: extend-hq/ui (MIT).
import { expect, test } from '@playwright/test';

test('accepts a supported file from the picker and lists it', async ({ page }) => {
	await page.goto('/file-upload', { waitUntil: 'networkidle' }); // let the page hydrate before interacting

	await page.locator('.file-upload input[type=file]').setInputFiles('tests/fixtures/sample.pdf');

	await expect(page.locator('.file-row')).toHaveCount(1);
	await expect(page.locator('.file-row')).toContainText('sample.pdf');
	await expect(page.getByText('Last accepted: sample.pdf')).toBeVisible();
});

test('rejects an unsupported file type', async ({ page }) => {
	await page.goto('/file-upload', { waitUntil: 'networkidle' }); // let the page hydrate before interacting

	await page.locator('.file-upload input[type=file]').setInputFiles({
		name: 'script.exe',
		mimeType: 'application/octet-stream',
		buffer: Buffer.from('nope')
	});

	await expect(page.locator('.rejection')).toContainText('not supported');
	await expect(page.locator('.file-row')).toHaveCount(0);
});

test('accepts files dropped on the dropzone', async ({ page }) => {
	await page.goto('/file-upload', { waitUntil: 'networkidle' }); // let the page hydrate before interacting

	const dataTransfer = await page.evaluateHandle(() => {
		const dt = new DataTransfer();
		dt.items.add(new File(['a,b\n1,2'], 'rates.csv', { type: 'text/csv' }));
		return dt;
	});
	const dropzone = page.locator('.dropzone');
	await dropzone.dispatchEvent('dragenter', { dataTransfer });
	await dropzone.dispatchEvent('drop', { dataTransfer });

	await expect(page.locator('.file-row')).toContainText('rates.csv');
});

test('dark mode is driven by the parent page', async ({ page }) => {
	await page.goto('/file-upload', { waitUntil: 'networkidle' }); // let the page hydrate before interacting

	const root = page.locator('.file-upload');
	await expect(root).not.toHaveClass(/dark/);
	await page.getByRole('button', { name: 'Toggle dark mode' }).click();
	await expect(root).toHaveClass(/dark/);
	await expect(page.getByRole('checkbox', { name: 'Dark mode' })).toBeChecked();
});
