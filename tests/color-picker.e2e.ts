// MIT License — Svelte 5 port of Extend UI color-picker. Upstream: extend-hq/ui (MIT).
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
	await page.goto('/color-picker');
	// Input before hydration is dropped on the dev server.
	await page.waitForLoadState('networkidle');
	await page.locator('[data-ready]').waitFor();
});

test('color picker page shows the input, swatch, alpha, panel, and disabled variants', async ({
	page
}) => {
	await expect(page.getByLabel('Brand color value')).toHaveValue('2563EB');
	await expect(page.getByRole('button', { name: 'Highlight color' })).toBeVisible();
	await expect(page.getByLabel('Overlay color value')).toBeVisible();
	await expect(page.getByLabel('Overlay color value').locator('xpath=..').getByLabel('Opacity')).toBeVisible();
	await expect(page.getByRole('slider', { name: 'Hue' }).first()).toBeVisible();
	await expect(page.getByRole('button', { name: 'Disabled color' })).toBeDisabled();
});

test('typing a color and pressing Enter reports it to the parent', async ({ page }) => {
	const field = page.getByLabel('Brand color value');
	await field.fill('#10b981');
	await field.press('Enter');

	await expect(page.getByTestId('brand-value')).toHaveText('Brand: #10B981');
	await expect(field).toHaveValue('10B981');
});

test('the swatch trigger opens the panel and Escape closes it', async ({ page }) => {
	const trigger = page.getByRole('button', { name: 'Highlight color' });
	await trigger.click();
	const dialog = page.getByRole('dialog', { name: 'Highlight color panel' });
	await expect(dialog).toBeVisible();

	await dialog.getByLabel('Color format').selectOption('rgb');
	await expect(dialog.getByLabel('Color value')).toHaveValue('245 158 11');

	// Like upstream, Escape inside a text field only reverts its draft; from
	// the rest of the panel it closes the panel.
	await dialog.getByLabel('Color format').press('Escape');
	await expect(dialog).toBeHidden();
});

test('the inline panel steps hue with the keyboard', async ({ page }) => {
	const panel = page.getByTestId('panel-demo');
	const before = await page.getByTestId('panel-value').textContent();

	const hue = panel.getByRole('slider', { name: 'Hue' });
	await hue.focus();
	await page.keyboard.press('ArrowDown');
	await expect(page.getByTestId('panel-value')).not.toHaveText(before ?? '');
	await expect(page.getByTestId('panel-value')).toHaveText(/^Fill: #[0-9A-F]{6}$/);
});

test('color picker dark mode follows the parent toggle outside the component', async ({ page }) => {
	const demos = page.getByTestId('color-picker-demos');
	await expect(demos.locator('.dark')).toHaveCount(0);

	await page.getByLabel('Dark mode').check();
	// One themed root per picker: input, swatch, alpha, panel, disabled swatch, disabled panel.
	await expect(demos.locator('.dark')).toHaveCount(6);

	await page.getByLabel('Dark mode').uncheck();
	await expect(demos.locator('.dark')).toHaveCount(0);
});

test('swatch triggers are upstream icon-sm buttons that show the current color', async ({ page }) => {
	for (const [name, rgb] of [
		['Highlight color', 'rgb(245, 158, 11)'],
		['Disabled color', 'rgb(107, 114, 128)']
	] as const) {
		const trigger = page.getByRole('button', { name });
		// Upstream Button size="icon-sm": size-8, sm:size-7 (28px at this viewport).
		const box = await trigger.boundingBox();
		expect(box!.width).toBeGreaterThanOrEqual(28);
		expect(box!.height).toBeGreaterThanOrEqual(28);
		await expect(trigger).toHaveCSS('border-top-style', 'solid');

		// The 16px swatch inside is visible and filled with the current color.
		const swatch = trigger.locator('[data-slot="color-picker-swatch"]');
		const swatchBox = await swatch.boundingBox();
		expect(Math.round(swatchBox!.width)).toBe(16);
		expect(Math.round(swatchBox!.height)).toBe(16);
		await expect(swatch.locator('[data-slot="color-picker-swatch-fill"]')).toHaveCSS(
			'background-color',
			rgb
		);
	}
});

test('the eyedropper is an upstream outline icon button with a pipette icon', async ({ page }) => {
	const eyedropper = page.getByTestId('panel-demo').getByRole('button', {
		name: 'Pick color from screen'
	});
	// Chromium supports the EyeDropper API, so the button renders here.
	const box = await eyedropper.boundingBox();
	expect(Math.round(box!.width)).toBe(32);
	expect(Math.round(box!.height)).toBe(32);
	await expect(eyedropper.locator('svg')).toHaveCount(1);
	await expect(eyedropper).toHaveText('');
});

test('at phone width the panel wraps its fields under the plane and every picker fits', async ({
	page
}) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.reload();
	await page.locator('[data-ready]').waitFor();
	const viewportWidth = 390;

	const panel = page.getByTestId('panel-demo');
	const plane = await panel.getByRole('button', { name: 'Chroma and lightness' }).boundingBox();
	const hex = await panel.getByLabel('Color value').boundingBox();
	expect(hex!.y).toBeGreaterThan(plane!.y + plane!.height);

	for (const label of ['Brand color value', 'Overlay color value', 'Color value']) {
		const box = await page.getByLabel(label, { exact: true }).first().boundingBox();
		expect(box!.x + box!.width).toBeLessThanOrEqual(viewportWidth);
	}
	const opacity = await page.getByLabel('Overlay color value').locator('xpath=..').getByLabel('Opacity').boundingBox();
	expect(opacity!.x + opacity!.width).toBeLessThanOrEqual(viewportWidth);

	// At desktop width the panel stays on one row like upstream.
	await page.setViewportSize({ width: 1280, height: 900 });
	const widePlane = await panel.getByRole('button', { name: 'Chroma and lightness' }).boundingBox();
	const wideHex = await panel.getByLabel('Color value').boundingBox();
	expect(wideHex!.y).toBeLessThan(widePlane!.y + widePlane!.height);
});

test('the picker panel behaves like a popover: focus in, Escape, focus back', async ({ page }) => {
	const trigger = page.getByRole('button', { name: 'Highlight color' });
	await expect(trigger).toHaveAttribute('aria-expanded', 'false');

	await trigger.click();
	const dialog = page.getByRole('dialog', { name: 'Highlight color panel' });
	await expect(trigger).toHaveAttribute('aria-expanded', 'true');
	await expect(trigger).toHaveAttribute('aria-controls', (await dialog.getAttribute('id'))!);
	await expect(dialog.getByRole('button', { name: 'Chroma and lightness' })).toBeFocused();

	await page.keyboard.press('Escape');
	await expect(dialog).toBeHidden();
	await expect(trigger).toHaveAttribute('aria-expanded', 'false');
	await expect(trigger).toBeFocused();
});

test('a click outside closes the picker panel and returns focus to the trigger', async ({ page }) => {
	const trigger = page.getByRole('button', { name: 'Brand color', exact: true });
	await trigger.click();
	const dialog = page.getByRole('dialog', { name: 'Brand color panel' });
	await expect(dialog).toBeVisible();

	// A press inside the panel keeps it open.
	await dialog.getByRole('slider', { name: 'Hue' }).click();
	await expect(dialog).toBeVisible();

	await page.getByRole('heading', { name: 'Color Picker' }).click();
	await expect(dialog).toBeHidden();
	await expect(trigger).toBeFocused();
});

test('a disabled panel locks only the channel and opacity fields, like upstream', async ({ page }) => {
	const panel = page.getByTestId('disabled-panel-demo');
	for (const name of ['Red', 'HSL hue', 'OKLCH lightness']) {
		await expect(panel.getByRole('textbox', { name, exact: true })).toBeDisabled();
	}
	await expect(panel.getByRole('textbox', { name: 'Opacity' })).toBeDisabled();

	await expect(panel.getByRole('button', { name: 'Chroma and lightness' })).toBeEnabled();
	await expect(panel.getByRole('slider', { name: 'Hue' })).toBeEnabled();
	await expect(panel.getByRole('slider', { name: 'Opacity' })).toBeEnabled();
	await expect(panel.getByRole('textbox', { name: 'Color value' })).toBeEnabled();
	await expect(panel.getByLabel('Color format')).toBeEnabled();
});

test('the panel opacity field is labelled "Opacity", like upstream', async ({ page }) => {
	await page.getByRole('button', { name: 'Overlay color', exact: true }).click();
	const dialog = page.getByRole('dialog', { name: 'Overlay color panel' });
	await expect(dialog.getByRole('textbox', { name: 'Opacity', exact: true })).toHaveValue('50');
});
