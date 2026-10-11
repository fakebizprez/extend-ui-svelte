// MIT License — Svelte 5 port of Extend UI toggle. Upstream: extend-hq/ui (MIT).
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
	await page.goto('/toggle');
	// Clicks before hydration are dropped on the dev server.
	await page.waitForLoadState('networkidle');
	await page.locator('[data-ready]').waitFor();
});

test('toggle page shows every variant and size plus a disabled toggle', async ({ page }) => {
	const matrix = page.getByTestId('toggle-variants');
	for (const variant of ['default', 'outline']) {
		for (const size of ['sm', 'default', 'lg']) {
			await expect(matrix.getByRole('button', { name: `${variant} ${size}` })).toBeVisible();
		}
	}
	await expect(page.getByRole('button', { name: 'Disabled toggle' })).toBeDisabled();
});

// The size classes are Tailwind utilities; the docs site does not load Tailwind yet.
test('toggle sizes differ in height like upstream', async ({
	page
}) => {
	const matrix = page.getByTestId('toggle-variants');
	const heights = await Promise.all(
		['sm', 'default', 'lg'].map((size) =>
			matrix
				.getByRole('button', { name: `outline ${size}` })
				.evaluate((node) => node.getBoundingClientRect().height)
		)
	);
	expect(heights[0]).toBeLessThan(heights[1]!);
	expect(heights[1]).toBeLessThan(heights[2]!);
});

test('a toggle flips on click and with Space and Enter', async ({ page }) => {
	const bold = page.getByRole('button', { name: 'Toggle bold' });
	const status = page.getByTestId('toggle-status');
	await expect(bold).toHaveAttribute('aria-pressed', 'false');

	await bold.click();
	await expect(bold).toHaveAttribute('aria-pressed', 'true');
	// Base UI renders true state as an empty data attribute.
	await expect(bold).toHaveAttribute('data-pressed', '');
	await expect(status).toHaveText('Bold is on');

	await page.keyboard.press('Space');
	await expect(bold).toHaveAttribute('aria-pressed', 'false');
	await page.keyboard.press('Enter');
	await expect(status).toHaveText('Bold is on');
});

test('a single-select toggle group keeps one item pressed', async ({ page }) => {
	const group = page.getByRole('group', { name: 'Text alignment' });
	const status = page.getByTestId('alignment-status');
	await expect(status).toHaveText('Alignment: left');

	await group.getByRole('button', { name: 'Align center' }).click();
	await expect(status).toHaveText('Alignment: center');
	await expect(group.getByRole('button', { name: 'Align left' })).toHaveAttribute(
		'aria-pressed',
		'false'
	);
	await expect(group.locator('[aria-pressed="true"]')).toHaveCount(1);
});

test('a multiple toggle group accumulates pressed items', async ({ page }) => {
	const group = page.getByRole('group', { name: 'Text formatting' });
	const status = page.getByTestId('formatting-status');

	await group.getByRole('button', { name: 'Italic' }).click();
	await group.getByRole('button', { name: 'Underline' }).click();
	await expect(status).toHaveText('Formatting: bold, italic, underline');

	await group.getByRole('button', { name: 'Bold' }).click();
	await expect(status).toHaveText('Formatting: italic, underline');
});

test('arrow keys move focus inside a toggle group and loop at the ends', async ({ page }) => {
	const group = page.getByRole('group', { name: 'Text alignment' });
	await group.getByRole('button', { name: 'Align left' }).focus();

	await page.keyboard.press('ArrowRight');
	await expect(group.getByRole('button', { name: 'Align center' })).toBeFocused();
	await page.keyboard.press('ArrowLeft');
	await page.keyboard.press('ArrowLeft');
	await expect(group.getByRole('button', { name: 'Align right' })).toBeFocused();
	await page.keyboard.press('Space');
	await expect(page.getByTestId('alignment-status')).toHaveText('Alignment: right');

	const vertical = page.getByRole('group', { name: 'View mode' });
	await expect(vertical).toHaveAttribute('data-orientation', 'vertical');
	await vertical.getByRole('button', { name: 'List view' }).focus();
	await page.keyboard.press('ArrowDown');
	await expect(vertical.getByRole('button', { name: 'Grid view' })).toBeFocused();
});

test('a disabled toggle group ignores clicks', async ({ page }) => {
	const group = page.getByRole('group', { name: 'Disabled group' });
	for (const button of await group.getByRole('button').all()) await expect(button).toBeDisabled();
});

test('toggle dark mode follows the parent toggle outside the component', async ({ page }) => {
	const toggles = page.locator('[data-slot="toggle"], [data-slot="toggle-group"]');
	await expect(toggles.first()).not.toHaveClass(/\bdark\b/);

	await page.getByLabel('Dark mode').check();
	for (const toggle of await toggles.all()) await expect(toggle).toHaveClass(/\bdark\b/);
});

test('each toggle group is one Tab stop that starts on its first item and follows focus', async ({
	page
}) => {
	const alignment = page.getByRole('group', { name: 'Text alignment' });
	const formatting = page.getByRole('group', { name: 'Text formatting' });

	await page.getByRole('button', { name: 'Toggle bold' }).focus();
	await page.keyboard.press('Tab');
	await expect(alignment.getByRole('button', { name: 'Align left' })).toBeFocused();

	// One more Tab leaves the group for the next group's pressed item.
	await page.keyboard.press('Tab');
	await expect(formatting.getByRole('button', { name: 'Bold' })).toBeFocused();

	await page.keyboard.press('Shift+Tab');
	await expect(alignment.getByRole('button', { name: 'Align left' })).toBeFocused();
	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('Shift+Tab');
	await expect(page.getByRole('button', { name: 'Toggle bold' })).toBeFocused();
	await page.keyboard.press('Tab');
	await expect(alignment.getByRole('button', { name: 'Align center' })).toBeFocused();
});

test('a consumer onclick or onkeydown runs and the built-in behavior still runs', async ({ page }) => {
	const italic = page.getByRole('button', { name: 'Toggle italic' });
	await italic.click();
	await expect(page.getByTestId('consumer-clicks')).toHaveText('Consumer clicks: 1');
	await expect(italic).toHaveAttribute('aria-pressed', 'true');

	const group = page.getByRole('group', { name: 'Font size' });
	const small = group.getByRole('button', { name: 'Small text' });
	const large = group.getByRole('button', { name: 'Large text' });
	await large.click();
	await expect(large).toHaveAttribute('aria-pressed', 'true');
	// Like Base UI, a grouped item reports onPressedChange with event details.
	await expect(page.getByTestId('large-pressed')).toHaveText('Large pressed: true (none)');
	await small.click();
	await expect(page.getByTestId('consumer-clicks')).toHaveText('Consumer clicks: 2');
	await expect(small).toHaveAttribute('aria-pressed', 'true');

	await page.keyboard.press('ArrowRight');
	await expect(page.getByTestId('font-size-key')).toHaveText('Last key: ArrowRight');
	await expect(large).toBeFocused();
});

test('Tab enters a group on its first item even when a later item is pressed', async ({ page }) => {
	const vertical = page.getByRole('group', { name: 'View mode' });
	await expect(vertical.getByRole('button', { name: 'Grid view' })).toHaveAttribute('aria-pressed', 'true');

	await page.getByRole('group', { name: 'Text formatting' }).getByRole('button', { name: 'Bold' }).focus();
	await page.keyboard.press('Tab');
	await expect(vertical.getByRole('button', { name: 'List view' })).toBeFocused();
});

test('an item added at the front of a group takes the Tab stop', async ({ page }) => {
	const add = page.getByRole('button', { name: 'Add XS at the front' });
	await add.click();
	const sizes = page.getByRole('group', { name: 'Sizes' });
	await expect(sizes.getByRole('button')).toHaveText(['XS', 'S', 'M', 'L']);

	await add.focus();
	await page.keyboard.press('Tab');
	await expect(sizes.getByRole('button', { name: 'XS' })).toBeFocused();
});

test('a group item without a value still toggles, like Base UI', async ({ page }) => {
	const group = page.getByRole('group', { name: 'Font size' });
	const auto = group.getByRole('button', { name: 'Auto size' });
	await auto.click();
	await expect(auto).toHaveAttribute('aria-pressed', 'true');
	await expect(group.getByRole('button', { name: 'Small text' })).toHaveAttribute('aria-pressed', 'false');
});

test('arrow keys with a modifier held are left for shortcuts, like Base UI', async ({ page }) => {
	const group = page.getByRole('group', { name: 'Text alignment' });
	const left = group.getByRole('button', { name: 'Align left' });
	await page.evaluate(() => {
		const w = window as unknown as { seenKeys: string[] };
		w.seenKeys = [];
		document.addEventListener('keydown', (event) =>
			w.seenKeys.push(`${event.key}:${event.defaultPrevented}`)
		);
	});

	for (const chord of ['Alt+ArrowRight', 'Shift+ArrowRight', 'Control+ArrowRight', 'Meta+ArrowRight']) {
		await left.focus();
		await page.keyboard.press(chord);
		await expect(left).toBeFocused();
	}
	await page.keyboard.press('ArrowRight');
	await expect(group.getByRole('button', { name: 'Align center' })).toBeFocused();

	// Modified arrows reach the document unprevented; the plain arrow that moved focus does not.
	const seen = await page.evaluate(() =>
		(window as unknown as { seenKeys: string[] }).seenKeys.filter((key) => key.startsWith('Arrow'))
	);
	expect(seen).toEqual(Array(4).fill('ArrowRight:false'));
});

test('toggles and groups carry Base UI state attributes', async ({ page }) => {
	const formatting = page.getByRole('group', { name: 'Text formatting' });
	await expect(formatting).toHaveAttribute('data-multiple', '');
	await expect(formatting).toHaveAttribute('data-orientation', 'horizontal');
	await expect(formatting).not.toHaveAttribute('aria-orientation');
	await expect(formatting.getByRole('button', { name: 'Bold' })).toHaveAttribute('data-pressed', '');

	await expect(page.getByRole('group', { name: 'View mode' })).toHaveAttribute('data-orientation', 'vertical');
	const alignment = page.getByRole('group', { name: 'Text alignment' });
	await expect(alignment).not.toHaveAttribute('data-multiple');

	const disabled = page.getByRole('group', { name: 'Disabled group' });
	await expect(disabled).toHaveAttribute('data-disabled', '');
	await expect(disabled.getByRole('button').first()).toHaveAttribute('data-disabled', '');
	await expect(page.getByRole('button', { name: 'Disabled toggle' })).toHaveAttribute('data-disabled', '');
});

test('a toggle given type="submit" and form never submits the form, like Base UI', async ({ page }) => {
	const toggle = page.getByRole('button', { name: 'Toggle in form' });
	await expect(toggle).toHaveAttribute('type', 'button');
	await expect(toggle).not.toHaveAttribute('form');

	await toggle.click();
	await expect(toggle).toHaveAttribute('aria-pressed', 'true');
	await expect(page.getByTestId('form-submits')).toHaveText('Form submits: 0');
});
