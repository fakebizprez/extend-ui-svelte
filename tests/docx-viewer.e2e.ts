// MIT License — Svelte 5 port of Extend UI docx-viewer. Upstream: extend-hq/ui (MIT).
import { readFileSync } from 'node:fs';
import { expect, test, type Page, type Route } from '@playwright/test';
import JSZip from 'jszip';

const EXPECTED_TEXT = 'Hello from the DOCX fixture';
const SECOND_TEXT = 'Second paragraph for the thumbnail sidebar.';

test('renders the fixture document text', async ({ page }) => {
	await page.goto('/docx-viewer');

	await expect(page.getByTestId('docx-viewer')).toBeVisible();
	await expect(page.getByTestId('docx-container')).toContainText(EXPECTED_TEXT, {
		timeout: 20000
	});
	await expect(page.getByTestId('docx-container')).toContainText(SECOND_TEXT);
	await expect(page.getByTestId('docx-page-indicator')).toContainText(/Page \d+ of \d+/);
});

test('toggles the thumbnail sidebar', async ({ page }) => {
	await page.goto('/docx-viewer');

	await expect(page.getByTestId('docx-container')).toContainText(EXPECTED_TEXT, {
		timeout: 20000
	});
	await expect(page.getByTestId('docx-thumbnails')).toHaveCount(0);

	await page.getByRole('button', { name: 'Toggle thumbnails' }).click();

	await expect(page.getByTestId('docx-thumbnails')).toBeVisible();
	await expect(page.getByRole('option', { name: 'Page 1' })).toBeVisible();
});

test('toggles dark mode from the toolbar', async ({ page }) => {
	await page.goto('/docx-viewer');

	const viewer = page.getByTestId('docx-viewer');
	await expect(viewer).toBeVisible();
	await expect(viewer).toHaveAttribute('data-dark', 'false');
	// The rendered document means the page has hydrated and handlers are live.
	await expect(page.getByTestId('docx-container')).toContainText(EXPECTED_TEXT, {
		timeout: 20000
	});

	await page.getByRole('switch', { name: 'Toggle dark mode' }).click();

	await expect(viewer).toHaveAttribute('data-dark', 'true');
	await expect(viewer).toHaveClass(/dark/);
});

test('starts at the upstream 50% zoom and fits the page width on request', async ({ page }) => {
	await page.goto('/docx-viewer');

	await expect(page.getByTestId('docx-container')).toContainText(EXPECTED_TEXT, {
		timeout: 20000
	});
	await expect(page.getByTestId('docx-zoom-level')).toHaveText('50%');

	await page.getByRole('combobox', { name: 'Zoom level' }).selectOption('fit-width');

	await expect(page.getByTestId('docx-zoom-level')).not.toHaveText('50%');
	// The zoomed page (with docx-preview's wrapper padding) spans the viewport's
	// content box, and the viewer itself does not grow wider than before.
	const viewerWidth = (await page.getByTestId('docx-viewer').boundingBox())?.width ?? 0;
	const widths = await page.evaluate(() => {
		const viewport = document.querySelector('[data-testid="docx-viewport"]') as HTMLElement;
		const wrapper = document.querySelector('.docx-wrapper') as HTMLElement;
		const style = getComputedStyle(viewport);
		const content =
			viewport.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
		return { content, page: wrapper.getBoundingClientRect().width };
	});
	expect(Math.abs(widths.page - widths.content)).toBeLessThan(4);
	expect(viewerWidth).toBeLessThanOrEqual(page.viewportSize()?.width ?? 1280);
});

test('docs page lists the differences from upstream', async ({ page }) => {
	await page.goto('/docx-viewer');

	const differences = page.getByRole('region', { name: 'Differences from upstream' });
	await expect(differences).toContainText('DocxViewerPreview');
	await expect(differences).toContainText('className');
});

/** The fixture with its text swapped, so the upload is distinguishable from src. */
async function replacementDocx(text: string): Promise<Buffer> {
	const zip = await JSZip.loadAsync(readFileSync('tests/fixtures/sample.docx'));
	const xml = await zip.file('word/document.xml')!.async('string');
	zip.file('word/document.xml', xml.replace(EXPECTED_TEXT, text).replace(SECOND_TEXT, text));
	return zip.generateAsync({ type: 'nodebuffer' });
}

/** Resolves once the page has gone a full second without navigating. */
async function waitForSettledNavigation(page: Page): Promise<void> {
	let lastNavigation = Date.now();
	page.on('framenavigated', (frame) => {
		if (frame === page.mainFrame()) lastNavigation = Date.now();
	});
	await expect.poll(() => Date.now() - lastNavigation, { timeout: 20000 }).toBeGreaterThan(1000);
}

test('an upload made while the src is still loading is not overwritten by the late src', async ({
	page
}) => {
	const held: Route[] = [];
	await page.route('**/fixtures/sample.docx', (route) => {
		held.push(route);
	});
	await page.goto('/docx-viewer');
	await waitForSettledNavigation(page);
	await expect(page.getByRole('status')).toContainText('Loading document', { timeout: 20000 });

	const uploaded = 'Uploaded replacement document';
	await page.getByTestId('docx-file-input').setInputFiles({
		name: 'replacement.docx',
		mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		buffer: await replacementDocx(uploaded)
	});
	const documentEl = page.getByTestId('docx-container');
	await expect(documentEl).toContainText(uploaded, { timeout: 20000 });

	// Release the slow src fetch now; its late render must not reach the DOM.
	const srcResponse = page.waitForResponse('**/fixtures/sample.docx');
	await page.unroute('**/fixtures/sample.docx');
	for (const route of held) await route.continue().catch(() => {});
	await srcResponse;
	// No visible signal marks the stale render finishing, so give it time to land.
	await page.waitForTimeout(1500);

	await expect(documentEl).toContainText(uploaded);
	await expect(documentEl).not.toContainText(EXPECTED_TEXT);
});

/** The fixture rebuilt with one paragraph per page, separated by page breaks. */
async function multiPageDocx(pageCount: number): Promise<Buffer> {
	const zip = await JSZip.loadAsync(readFileSync('tests/fixtures/sample.docx'));
	const pagesXml = Array.from({ length: pageCount }, (_, index) => {
		const pageBreak = index < pageCount - 1 ? '<w:r><w:br w:type="page"/></w:r>' : '';
		return `<w:p><w:r><w:t>Generated page ${index + 1}</w:t></w:r>${pageBreak}</w:p>`;
	}).join('');
	const xml = await zip.file('word/document.xml')!.async('string');
	zip.file('word/document.xml', xml.replace(/<w:body>[\s\S]*?(<w:sectPr)/, `<w:body>${pagesXml}$1`));
	return zip.generateAsync({ type: 'nodebuffer' });
}

test('large documents only lay out and paint the pages near the viewport', async ({ page }) => {
	await page.goto('/docx-viewer');
	await waitForSettledNavigation(page);
	await expect(page.getByTestId('docx-container')).toContainText(EXPECTED_TEXT, {
		timeout: 20000
	});

	await page.getByTestId('docx-file-input').setInputFiles({
		name: 'long.docx',
		mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		buffer: await multiPageDocx(30)
	});
	await expect(page.getByTestId('docx-page-indicator')).toContainText('of 30', { timeout: 20000 });

	// checkVisibility on a page's content reports whether the browser skips rendering it.
	const renderedPages = () =>
		page.evaluate(
			() =>
				Array.from(document.querySelectorAll<HTMLElement>('[data-docx-page]'))
					.filter((section) =>
						section.firstElementChild?.checkVisibility({ contentVisibilityAuto: true })
					)
					.map((section) => Number(section.dataset.docxPage))
		);
	// Wait for the first page to paint before counting, or an empty list passes too early.
	await expect.poll(renderedPages).toContain(1);
	expect((await renderedPages()).length).toBeLessThan(8);

	await page.getByTestId('docx-viewport').evaluate((viewport) => {
		viewport.scrollTop = viewport.scrollHeight;
	});
	await expect.poll(renderedPages).toContain(30);
	expect(await renderedPages()).not.toContain(1);
});
