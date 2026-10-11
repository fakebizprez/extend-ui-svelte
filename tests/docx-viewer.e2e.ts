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

const HOSTILE_LINKS: Record<string, string> = {
	'JS LINK': 'javascript:void(window.__pwned=document.domain)',
	'DATA LINK': 'data:text/html,<script>opener.__pwned=1</script>',
	'VB LINK': 'vbscript:msgbox(1)',
	'SAFE LINK': 'https://example.com/terms'
};

/** The fixture rebuilt with one external hyperlink per HOSTILE_LINKS entry. */
async function hyperlinkDocx(): Promise<Buffer> {
	const zip = await JSZip.loadAsync(readFileSync('tests/fixtures/sample.docx'));
	const entries = Object.entries(HOSTILE_LINKS);
	const escape = (value: string) =>
		value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
	zip.file(
		'word/_rels/document.xml.rels',
		'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
			'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
			entries
				.map(
					([, target], index) =>
						`<Relationship Id="rIdLink${index}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${escape(target)}" TargetMode="External"/>`
				)
				.join('') +
			'</Relationships>'
	);
	const paragraphs = entries
		.map(
			([text], index) =>
				`<w:p><w:hyperlink r:id="rIdLink${index}"><w:r><w:t>${text}</w:t></w:r></w:hyperlink></w:p>`
		)
		.join('');
	zip.file(
		'word/document.xml',
		'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
			'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
			`<w:body>${paragraphs}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/></w:sectPr></w:body></w:document>`
	);
	return zip.generateAsync({ type: 'nodebuffer' });
}

test('hyperlinks with javascript:, data:, or vbscript: targets never run when clicked', async ({
	page
}) => {
	await page.goto('/docx-viewer');
	await waitForSettledNavigation(page);
	await expect(page.getByTestId('docx-container')).toContainText(EXPECTED_TEXT, {
		timeout: 20000
	});

	await page.getByTestId('docx-file-input').setInputFiles({
		name: 'links.docx',
		mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		buffer: await hyperlinkDocx()
	});
	const documentEl = page.getByTestId('docx-container');
	await expect(documentEl).toContainText('SAFE LINK', { timeout: 20000 });

	for (const text of ['JS LINK', 'DATA LINK', 'VB LINK']) {
		const link = documentEl.locator('a', { hasText: text });
		await expect(link, text).not.toHaveAttribute('href');
		await link.click();
	}
	await page.waitForTimeout(500);

	expect(page.url()).toMatch(/\/docx-viewer$/);
	expect(await page.evaluate(() => (window as { __pwned?: unknown }).__pwned ?? null)).toBeNull();
	await expect(documentEl.locator('a', { hasText: 'SAFE LINK' })).toHaveAttribute(
		'href',
		HOSTILE_LINKS['SAFE LINK']
	);
});

// A 4x4 opaque red PNG.
const RED_PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAEklEQVR4nGP4z8CAB+GTG8HSALfKY52fTcuYAAAAAElFTkSuQmCC',
	'base64'
);

/** The fixture rebuilt around a legacy VML picture (w:pict / v:imagedata) of RED_PNG. */
async function vmlPictureDocx(): Promise<Buffer> {
	const zip = await JSZip.loadAsync(readFileSync('tests/fixtures/sample.docx'));
	const types = await zip.file('[Content_Types].xml')!.async('string');
	zip.file(
		'[Content_Types].xml',
		types.replace('<Default Extension="xml"', '<Default Extension="png" ContentType="image/png"/><Default Extension="xml"')
	);
	zip.file('word/media/red.png', RED_PNG);
	zip.file(
		'word/_rels/document.xml.rels',
		'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
			'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
			'<Relationship Id="rIdVml" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/red.png"/>' +
			'</Relationships>'
	);
	zip.file(
		'word/document.xml',
		'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
			'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:v="urn:schemas-microsoft-com:vml">' +
			'<w:body><w:p><w:r><w:t>VML PICTURE</w:t></w:r></w:p><w:p><w:r><w:pict>' +
			'<v:shape id="pic" style="width:120pt;height:60pt"><v:imagedata r:id="rIdVml"/></v:shape>' +
			'</w:pict></w:r></w:p><w:sectPr><w:pgSz w:w="12240" w:h="15840"/></w:sectPr></w:body></w:document>'
	);
	return zip.generateAsync({ type: 'nodebuffer' });
}

test('legacy VML pictures keep their embedded data:image source and render', async ({ page }) => {
	await page.goto('/docx-viewer');
	await waitForSettledNavigation(page);
	await expect(page.getByTestId('docx-container')).toContainText(EXPECTED_TEXT, {
		timeout: 20000
	});

	await page.getByTestId('docx-file-input').setInputFiles({
		name: 'vml.docx',
		mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		buffer: await vmlPictureDocx()
	});
	const documentEl = page.getByTestId('docx-container');
	await expect(documentEl).toContainText('VML PICTURE', { timeout: 20000 });

	const image = documentEl.locator('svg image');
	await expect(image).toHaveCount(1);
	await expect(image).toHaveAttribute('href', /^data:image\/png;base64,/);
	// The picture actually paints: it has a non-zero on-screen box.
	const box = await image.boundingBox();
	expect(box?.width ?? 0).toBeGreaterThan(0);
	expect(box?.height ?? 0).toBeGreaterThan(0);
});

/** Page number with the most visible height in the document viewport (rendered positions). */
function mostVisiblePage(page: Page): Promise<number> {
	return page.getByTestId('docx-viewport').evaluate((viewport) => {
		const bounds = viewport.getBoundingClientRect();
		let best = 0;
		let bestVisible = 0;
		for (const section of viewport.querySelectorAll<HTMLElement>('[data-docx-page]')) {
			const rect = section.getBoundingClientRect();
			const visible = Math.min(rect.bottom, bounds.bottom) - Math.max(rect.top, bounds.top);
			if (visible > bestVisible) [best, bestVisible] = [Number(section.dataset.docxPage), visible];
		}
		return best;
	});
}

for (const zoom of ['50', '100', 'fit-width']) {
	test(`at zoom ${zoom}, Next walks every page and the indicator follows scrolling`, async ({
		page
	}) => {
		await page.goto('/docx-viewer');
		await waitForSettledNavigation(page);
		await expect(page.getByTestId('docx-container')).toContainText(EXPECTED_TEXT, {
			timeout: 20000
		});
		await page.getByTestId('docx-file-input').setInputFiles({
			name: 'eight.docx',
			mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
			buffer: await multiPageDocx(8)
		});
		const indicator = page.getByTestId('docx-page-indicator');
		await expect(indicator).toContainText('of 8', { timeout: 20000 });
		await page.getByRole('combobox', { name: 'Zoom level' }).selectOption(zoom);
		const viewport = page.getByTestId('docx-viewport');
		await viewport.evaluate((element) => element.scrollTo({ top: 0 }));
		await expect(indicator).toHaveText(/Page\s+1\s+of 8/);

		for (let target = 2; target <= 8; target += 1) {
			await page.getByRole('button', { name: 'Next page' }).click();
			await expect(indicator).toHaveText(new RegExp(`Page\\s+${target}\\s+of 8`));
			// The page jumped to is on screen.
			const visible = await page.locator(`[data-docx-page="${target}"]`).evaluate((section) => {
				const viewportRect = section.closest('[data-testid="docx-viewport"]')!.getBoundingClientRect();
				const rect = section.getBoundingClientRect();
				return rect.bottom > viewportRect.top && rect.top < viewportRect.bottom;
			});
			expect(visible, `page ${target} visible`).toBe(true);
		}
		await expect(page.getByRole('button', { name: 'Next page' })).toBeDisabled();

		// Free scrolling: the indicator names the most visible page.
		for (const fraction of [0.15, 0.4, 0.65]) {
			await viewport.evaluate((element, f) => {
				element.scrollTop = (element.scrollHeight - element.clientHeight) * f;
			}, fraction);
			const expected = await mostVisiblePage(page);
			await expect(indicator).toHaveText(new RegExp(`Page\\s+${expected}\\s+of 8`));
		}
	});
}

test('the thumbnail listbox moves through pages with the arrow, Home, and End keys', async ({
	page
}) => {
	await page.goto('/docx-viewer');
	await waitForSettledNavigation(page);
	await expect(page.getByTestId('docx-container')).toContainText(EXPECTED_TEXT, {
		timeout: 20000
	});
	await page.getByTestId('docx-file-input').setInputFiles({
		name: 'eight.docx',
		mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		buffer: await multiPageDocx(8)
	});
	const indicator = page.getByTestId('docx-page-indicator');
	await expect(indicator).toContainText('of 8', { timeout: 20000 });
	await page.getByRole('button', { name: 'Toggle thumbnails' }).click();
	const listbox = page.getByRole('listbox', { name: 'DOCX pages' });

	await listbox.focus();
	await page.keyboard.press('ArrowDown');
	await page.keyboard.press('ArrowDown');
	await expect(indicator).toHaveText(/Page\s+3\s+of 8/);
	await expect(page.getByRole('option', { name: 'Page 3' })).toHaveAttribute('aria-selected', 'true');
	await page.keyboard.press('End');
	await expect(indicator).toHaveText(/Page\s+8\s+of 8/);
	await expect(page.getByRole('option', { name: 'Page 8' })).toBeInViewport();
	await page.keyboard.press('ArrowUp');
	await expect(indicator).toHaveText(/Page\s+7\s+of 8/);
	await page.keyboard.press('Home');
	await expect(indicator).toHaveText(/Page\s+1\s+of 8/);
	await expect(listbox).toBeFocused();
});
