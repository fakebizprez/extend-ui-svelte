// MIT License — Svelte 5 port of Extend UI bounding-box-citations. Upstream: extend-hq/ui (MIT).
import { expect, test } from '@playwright/test';

test('citation boxes overlay the rendered pdf pages', async ({ page }) => {
	await page.goto('/bounding-box-citations');

	await expect(page.getByTestId('pdf-page-indicator').first()).toContainText('Page 1 of 3', {
		timeout: 30000
	});

	const boxes = page.getByTestId('citation-box');
	await expect(boxes.first()).toBeVisible();
	expect(await boxes.count()).toBeGreaterThanOrEqual(2);
	await expect(page.getByTestId('citation-list')).toContainText('Statement period');
});

test('selecting a list citation highlights and scrolls to its box', async ({ page }) => {
	await page.goto('/bounding-box-citations');

	await expect(page.getByTestId('pdf-page-indicator').first()).toContainText('Page 1 of 3', {
		timeout: 30000
	});

	const list = page.getByTestId('citation-list');
	await list.getByRole('button', { name: /Ending balance/ }).click();

	const box = page.locator('[data-field-key="ending_balance"]');
	await expect(box).toHaveAttribute('data-active', 'true');
	await expect(box).toBeVisible();
	await expect(list.getByRole('button', { name: /Ending balance/ })).toHaveAttribute(
		'aria-current',
		'true'
	);
	await expect(page.getByTestId('docs-active-citation')).toContainText('ending_balance');
});

test('clicking an overlay box highlights the matching list citation', async ({ page }) => {
	await page.goto('/bounding-box-citations');

	await expect(page.getByTestId('pdf-page-indicator').first()).toContainText('Page 1 of 3', {
		timeout: 30000
	});

	const box = page.locator('[data-field-key="statement_period"]');
	await expect(box).toBeVisible();
	await box.click();

	const list = page.getByTestId('citation-list');
	await expect(list.getByRole('button', { name: /Statement period/ })).toHaveAttribute(
		'aria-current',
		'true'
	);
	await expect(box).toHaveAttribute('data-active', 'true');
	await expect(page.getByTestId('docs-active-citation')).toContainText('statement_period');
});
