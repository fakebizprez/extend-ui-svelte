// MIT License — Svelte 5 port of Extend UI docx-viewer. Upstream: extend-hq/ui (MIT).
// Component tests: run in the Vitest client (jsdom) project.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import DocxViewer, { resolveZoomLevel } from './DocxViewer.svelte';
import { DocxViewerPreview } from './index.js';

vi.mock('#lib/engines/docx/index.js', () => ({
	renderDocx: vi.fn(),
	clearDocx: vi.fn()
}));

// The mocked engine module: the component loads it through a dynamic import()
// inside onMount, which resolves to this same mock.
import { clearDocx, renderDocx } from '#lib/engines/docx/index.js';

const mockedRenderDocx = vi.mocked(renderDocx);

/** Required upstream props: dark mode is parent-controlled. */
const DARK = { isDark: false, onIsDarkChange: () => {} };

const FIXTURE_TEXT = 'Hello from the DOCX fixture';
const SECOND_TEXT = 'Second paragraph for the thumbnail sidebar.';

/** Builds fake docx-preview output: a .docx-wrapper with one section per page. */
function fakePages(pageCount: number, texts: string[] = [FIXTURE_TEXT, SECOND_TEXT]): string[] {
	return Array.from({ length: pageCount }, (_, i) => texts[i] ?? `Page ${i + 1} body text.`);
}

/** Default mock: renders three page sections with fixture-like text. */
function mockThreePages(): void {
	mockedRenderDocx.mockImplementation(async (_source, container, options) => {
		container.innerHTML = '';
		const wrapper = document.createElement('div');
		wrapper.className = 'docx-wrapper';
		for (const text of fakePages(3)) {
			const section = document.createElement('section');
			section.className = 'docx';
			section.textContent = text;
			wrapper.appendChild(section);
		}
		container.appendChild(wrapper);
		return { container, showThumbnails: options?.showThumbnails ?? false };
	});
}

function mockManyPages(pageCount: number): void {
	mockedRenderDocx.mockImplementation(async (_source, container, options) => {
		container.innerHTML = '';
		const wrapper = document.createElement('div');
		wrapper.className = 'docx-wrapper';
		for (const text of fakePages(pageCount)) {
			const section = document.createElement('section');
			section.className = 'docx';
			section.textContent = text;
			wrapper.appendChild(section);
		}
		container.appendChild(wrapper);
		return { container, showThumbnails: options?.showThumbnails ?? false };
	});
}

/** Every later render writes one page with the given text. */
function mockSinglePage(text: string): void {
	mockedRenderDocx.mockImplementation(async (_source, container) => {
		container.innerHTML = `<div class="docx-wrapper"><section class="docx">${text}</section></div>`;
		return { container, showThumbnails: false };
	});
}

/**
 * The next render stays pending until released, then writes its page into the
 * container it was given, like a slow fetch finishing late.
 */
function deferredRender(text: string): { release: () => void; settled: Promise<unknown> } {
	let release!: () => void;
	const gate = new Promise<void>((resolve) => (release = resolve));
	let settled!: Promise<unknown>;
	mockedRenderDocx.mockImplementationOnce((_source, container) => {
		settled = gate.then(() => {
			container.innerHTML = `<div class="docx-wrapper"><section class="docx">${text}</section></div>`;
			return { container, showThumbnails: false };
		});
		return settled as ReturnType<typeof renderDocx>;
	});
	return {
		release: () => release(),
		get settled() {
			return settled.then(() => new Promise((resolve) => setTimeout(resolve, 0)));
		}
	};
}

function sidebarOptions(container: HTMLElement): NodeListOf<HTMLElement> {
	return container.querySelectorAll('[data-testid="docx-thumbnails"] [role="option"]');
}

beforeEach(() => {
	vi.clearAllMocks();
	mockThreePages();
});

describe('DocxViewer', () => {
	it('renders an empty state when no src is given', async () => {
		const { container } = render(DocxViewer, { ...DARK });

		expect(await screen.findByText('Upload a Word document to preview')).toBeVisible();
		// The hint is broken up by a <code> element, so match normalized text.
		const hint = container.querySelector('.docx-state-hint')?.textContent?.replace(/\s+/g, ' ');
		expect(hint).toContain('Pass a DOCX URL with the src prop or upload a file.');
		expect(mockedRenderDocx).not.toHaveBeenCalled();
	});

	it('renders the document through the docx engine', async () => {
		const { container } = render(DocxViewer, { ...DARK, src: 'https://example.com/doc.docx' });

		expect(await screen.findByText(FIXTURE_TEXT)).toBeVisible();
		expect(screen.getByText(SECOND_TEXT)).toBeVisible();
		expect(mockedRenderDocx).toHaveBeenCalledTimes(1);
		expect(mockedRenderDocx.mock.calls[0][0]).toBe('https://example.com/doc.docx');
		expect(container.querySelector('[data-testid="docx-container"]')).toHaveTextContent(
			FIXTURE_TEXT
		);
		expect(screen.getByTestId('docx-page-indicator')).toHaveTextContent('Page 1 of 3');
	});

	it('shows an error state when rendering fails', async () => {
		mockedRenderDocx.mockRejectedValueOnce(new Error('boom'));
		render(DocxViewer, { ...DARK, src: 'https://example.com/doc.docx' });

		expect(await screen.findByText('Unable to display DOCX', { exact: false })).toBeVisible();
		expect(screen.getByRole('alert')).toHaveTextContent('boom');
	});

	it('toggles the thumbnail sidebar from the toolbar', async () => {
		const { container } = render(DocxViewer, { ...DARK, src: 'https://example.com/doc.docx' });

		await screen.findByText(FIXTURE_TEXT);
		expect(screen.queryByTestId('docx-thumbnails')).not.toBeInTheDocument();

		await fireEvent.click(screen.getByRole('button', { name: 'Toggle thumbnails' }));

		expect(await screen.findByTestId('docx-thumbnails')).toBeVisible();
		expect(sidebarOptions(container)).toHaveLength(3);
		expect(screen.getByRole('option', { name: 'Page 1' })).toBeVisible();
		expect(screen.getByRole('option', { name: 'Page 3' })).toBeVisible();

		await fireEvent.click(screen.getByRole('button', { name: 'Toggle thumbnails' }));
		expect(screen.queryByTestId('docx-thumbnails')).not.toBeInTheDocument();
	});

	it('selects a page from the sidebar and marks it active', async () => {
		render(DocxViewer, { ...DARK, src: 'https://example.com/doc.docx' });

		await screen.findByText(FIXTURE_TEXT);
		await fireEvent.click(screen.getByRole('button', { name: 'Toggle thumbnails' }));
		await fireEvent.click(await screen.findByRole('option', { name: 'Page 2' }));

		expect(screen.getByRole('option', { name: 'Page 2' })).toHaveAttribute(
			'aria-selected',
			'true'
		);
		expect(screen.getByRole('option', { name: 'Page 1' })).toHaveAttribute(
			'aria-selected',
			'false'
		);
		expect(screen.getByTestId('docx-page-indicator')).toHaveTextContent('Page 2 of 3');
	});

	it('steps between pages with the previous/next buttons', async () => {
		render(DocxViewer, { ...DARK, src: 'https://example.com/doc.docx' });

		await screen.findByText(FIXTURE_TEXT);
		expect(screen.getByTestId('docx-page-indicator')).toHaveTextContent('Page 1 of 3');

		await fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
		expect(screen.getByTestId('docx-page-indicator')).toHaveTextContent('Page 2 of 3');

		await fireEvent.click(screen.getByRole('button', { name: 'Previous page' }));
		expect(screen.getByTestId('docx-page-indicator')).toHaveTextContent('Page 1 of 3');
	});

	it('virtualizes the thumbnail sidebar instead of rendering every page', async () => {
		mockManyPages(200);
		const { container } = render(DocxViewer, { ...DARK, src: 'https://example.com/big.docx' });

		await screen.findByText(FIXTURE_TEXT);
		expect(screen.getByTestId('docx-page-indicator')).toHaveTextContent('Page 1 of 200');

		await fireEvent.click(screen.getByRole('button', { name: 'Toggle thumbnails' }));
		await screen.findByTestId('docx-thumbnails');

		const rendered = sidebarOptions(container).length;
		expect(rendered).toBeGreaterThan(0);
		expect(rendered).toBeLessThan(60);
		expect(
			container.querySelector('[data-testid="docx-thumbnail-200"]')
		).not.toBeInTheDocument();

		const viewport = container.querySelector(
			'[data-testid="docx-thumbnails"] [data-testid="virtual-viewport"]'
		);
		expect(viewport).not.toBeNull();
		(viewport as HTMLElement).scrollTop = 200 * 72;
		await fireEvent.scroll(viewport as HTMLElement);

		expect(await screen.findByRole('option', { name: 'Page 200' })).toBeVisible();
	});

	it('reflects the parent-controlled dark mode', async () => {
		const { unmount } = render(DocxViewer, {
			...DARK,
			src: 'https://example.com/doc.docx',
			isDark: false
		});

		const viewer = await screen.findByTestId('docx-viewer');
		expect(viewer).toHaveAttribute('data-dark', 'false');
		expect(viewer.classList.contains('dark')).toBe(false);
		unmount();

		render(DocxViewer, { ...DARK, src: 'https://example.com/doc.docx', isDark: true });
		const darkViewer = await screen.findByTestId('docx-viewer');
		expect(darkViewer).toHaveAttribute('data-dark', 'true');
		expect(darkViewer.classList.contains('dark')).toBe(true);
	});

	it('notifies the parent when the dark-mode toggle is clicked', async () => {
		const onIsDarkChange = vi.fn();
		render(DocxViewer, {
			...DARK,
			src: 'https://example.com/doc.docx',
			isDark: false,
			onIsDarkChange
		});

		const toggle = await screen.findByRole('switch', { name: 'Toggle dark mode' });
		expect(toggle).toHaveAttribute('aria-checked', 'false');
		await fireEvent.click(toggle);

		expect(onIsDarkChange).toHaveBeenCalledTimes(1);
		expect(onIsDarkChange).toHaveBeenCalledWith(true);
	});

	it('zooms the document in and out from the toolbar, starting at upstream 50%', async () => {
		render(DocxViewer, { ...DARK, src: 'https://example.com/doc.docx' });

		await screen.findByText(FIXTURE_TEXT);
		expect(screen.getByTestId('docx-zoom-level')).toHaveTextContent('50%');
		expect(screen.getByTestId('docx-container').getAttribute('style')).toContain('zoom: 50%');

		await fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
		expect(screen.getByTestId('docx-zoom-level')).toHaveTextContent('75%');

		await fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
		expect(screen.getByTestId('docx-zoom-level')).toHaveTextContent('50%');
	});

	it('accepts className as an alias of class on the root', async () => {
		render(DocxViewer, { ...DARK, class: 'from-class', className: 'from-class-name' });

		const root = await screen.findByTestId('docx-viewer');
		expect(root).toHaveClass('docx-viewer', 'from-class', 'from-class-name');
	});

	it('is exported under the upstream name DocxViewerPreview', () => {
		expect(DocxViewerPreview).toBe(DocxViewer);
	});

	it('offers the upstream fit-page, fit-width, and automatic zoom modes', async () => {
		render(DocxViewer, { ...DARK, src: 'https://example.com/doc.docx' });

		await screen.findByText(FIXTURE_TEXT);
		const select = screen.getByRole('combobox', { name: 'Zoom level' }) as HTMLSelectElement;
		const labels = Array.from(select.options).map((option) => option.textContent?.trim());
		expect(labels.slice(0, 3)).toEqual(['Fit page', 'Fit width', 'Automatic']);
		expect(labels).toContain('50%');
		expect(select.value).toBe('50');

		await fireEvent.change(select, { target: { value: '150' } });
		expect(screen.getByTestId('docx-zoom-level')).toHaveTextContent('150%');
	});

	it('resolves defaultZoom="fit-width" against the viewport and page width', async () => {
		mockedRenderDocx.mockImplementation(async (_source, container) => {
			container.innerHTML = '';
			const wrapper = document.createElement('div');
			wrapper.className = 'docx-wrapper';
			const section = document.createElement('section');
			section.className = 'docx';
			section.textContent = FIXTURE_TEXT;
			// Natural (unzoomed) page size and viewport size; jsdom has no layout.
			Object.defineProperty(section, 'offsetWidth', { value: 400 });
			Object.defineProperty(section, 'offsetHeight', { value: 500 });
			const viewport = screen.getByTestId('docx-viewport');
			Object.defineProperty(viewport, 'clientWidth', { value: 600, configurable: true });
			Object.defineProperty(viewport, 'clientHeight', { value: 300, configurable: true });
			wrapper.appendChild(section);
			container.appendChild(wrapper);
			return { container, showThumbnails: false };
		});
		render(DocxViewer, { ...DARK, src: 'https://example.com/doc.docx', defaultZoom: 'fit-width' });

		await screen.findByText(FIXTURE_TEXT);
		const select = screen.getByRole('combobox', { name: 'Zoom level' }) as HTMLSelectElement;
		expect(select.value).toBe('fit-width');
		await vi.waitFor(() =>
			expect(screen.getByTestId('docx-zoom-level')).toHaveTextContent('150%')
		);

		await fireEvent.change(select, { target: { value: 'fit-page' } });
		expect(screen.getByTestId('docx-zoom-level')).toHaveTextContent('60%');
	});

	it('hides the toolbar when showToolbar is false but still renders the document', async () => {
		render(DocxViewer, { ...DARK, src: 'https://example.com/doc.docx', showToolbar: false });

		expect(await screen.findByText(FIXTURE_TEXT)).toBeVisible();
		expect(screen.queryByTestId('docx-toolbar')).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Toggle thumbnails' })).not.toBeInTheDocument();
	});

	it('hides download and upload controls when disabled', async () => {
		render(DocxViewer, {
			...DARK,
			src: 'https://example.com/doc.docx',
			showDownload: false,
			showUpload: false
		});

		await screen.findByText(FIXTURE_TEXT);
		expect(screen.queryByRole('button', { name: 'Download' })).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Upload' })).not.toBeInTheDocument();
		// Like upstream, the hidden file input stays mounted for the empty-state button.
		expect(screen.getByTestId('docx-file-input')).toHaveAttribute('type', 'file');
	});

	it('always offers the empty-state upload button, even with showUpload false, like upstream', async () => {
		render(DocxViewer, { ...DARK, showUpload: false });

		expect(await screen.findByRole('button', { name: 'Upload Word document' })).toBeVisible();
		expect(screen.getByTestId('docx-file-input')).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Upload' })).not.toBeInTheDocument();
	});

	it('jumps to a page typed into the upstream editable page number', async () => {
		render(DocxViewer, { ...DARK, src: 'https://example.com/doc.docx' });
		await screen.findByText(FIXTURE_TEXT);

		await fireEvent.click(
			screen.getByRole('button', { name: 'Current page 1. Edit page number' })
		);
		const input = screen.getByRole('textbox', { name: 'Page number' }) as HTMLInputElement;
		expect(input).toHaveFocus();
		expect(input.value).toBe('1');

		await fireEvent.input(input, { target: { value: '2' } });
		await fireEvent.keyDown(input, { key: 'Enter' });
		expect(screen.getByTestId('docx-page-indicator')).toHaveTextContent('Page 2 of 3');
		expect(screen.queryByRole('textbox', { name: 'Page number' })).not.toBeInTheDocument();

		await fireEvent.click(
			screen.getByRole('button', { name: 'Current page 2. Edit page number' })
		);
		const again = screen.getByRole('textbox', { name: 'Page number' });
		await fireEvent.input(again, { target: { value: '9' } });
		await fireEvent.input(again, { target: { value: '1.5' } });
		await fireEvent.blur(again);
		// Out-of-range input clamps to the last page; non-integers are ignored.
		expect(screen.getByTestId('docx-page-indicator')).toHaveTextContent('Page 3 of 3');
	});

	it('downloads a URL source by fetching it as a blob, like upstream', async () => {
		const blob = new Blob(['docx'], { type: 'application/octet-stream' });
		const fetchMock = vi.fn(async () => ({ ok: true, status: 200, blob: async () => blob }));
		vi.stubGlobal('fetch', fetchMock);
		const createObjectURL = vi.fn(() => 'blob:docx');
		vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));
		const clicked: string[] = [];
		const click = vi
			.spyOn(HTMLAnchorElement.prototype, 'click')
			.mockImplementation(function (this: HTMLAnchorElement) {
				clicked.push(`${this.href}|${this.download}`);
			});
		try {
			render(DocxViewer, { ...DARK, src: 'https://cdn.example.com/files/contract' });
			await screen.findByText(FIXTURE_TEXT);

			await fireEvent.click(screen.getByRole('button', { name: 'Download' }));

			await vi.waitFor(() => expect(clicked).toEqual(['blob:docx|contract.docx']));
			expect(fetchMock).toHaveBeenCalledWith('https://cdn.example.com/files/contract');
			expect(createObjectURL).toHaveBeenCalledWith(blob);
		} finally {
			click.mockRestore();
			vi.unstubAllGlobals();
		}
	});

	it('a new src replaces an uploaded document even when the upload renders last', async () => {
		const { rerender } = render(DocxViewer, { ...DARK, src: 'https://example.com/doc.docx' });
		await screen.findByText(FIXTURE_TEXT);
		const upload = deferredRender('UPLOADED DOC');
		const file = new File(['fake'], 'upload.docx');
		await fireEvent.change(screen.getByTestId('docx-file-input'), { target: { files: [file] } });
		await vi.waitFor(() => expect(mockedRenderDocx.mock.lastCall?.[0]).toBe(file));

		mockSinglePage('NEXT SRC DOC');
		await rerender({ ...DARK, src: 'https://example.com/next.docx' });
		await screen.findByText('NEXT SRC DOC');
		upload.release();
		await upload.settled;

		const documentEl = screen.getByTestId('docx-container');
		expect(documentEl).toHaveTextContent('NEXT SRC DOC');
		expect(documentEl).not.toHaveTextContent('UPLOADED DOC');
	});

	it('an upload made while the src is still loading wins over the late src render', async () => {
		const slowSrc = deferredRender('STALE SRC DOC');
		render(DocxViewer, { ...DARK, src: 'https://example.com/slow.docx' });
		await vi.waitFor(() => expect(mockedRenderDocx).toHaveBeenCalledTimes(1));

		mockSinglePage('UPLOADED DOC');
		const file = new File(['fake'], 'upload.docx');
		await fireEvent.change(screen.getByTestId('docx-file-input'), { target: { files: [file] } });
		await screen.findByText('UPLOADED DOC');
		slowSrc.release();
		await slowSrc.settled;

		const documentEl = screen.getByTestId('docx-container');
		expect(documentEl).toHaveTextContent('UPLOADED DOC');
		expect(documentEl).not.toHaveTextContent('STALE SRC DOC');
		expect(screen.getByTestId('docx-page-indicator')).toHaveTextContent('Page 1 of 1');
	});

	it('accepts Word documents in the upload input', async () => {
		render(DocxViewer, { ...DARK, src: 'https://example.com/doc.docx' });

		await screen.findByText(FIXTURE_TEXT);
		const input = screen.getByTestId('docx-file-input');
		expect(input).toHaveAttribute('accept', expect.stringContaining('.docx'));
		expect(input).toHaveAttribute('type', 'file');
	});

	it('clears the rendered output when unmounted', async () => {
		const { unmount } = render(DocxViewer, { ...DARK, src: 'https://example.com/doc.docx' });

		await screen.findByText(FIXTURE_TEXT);
		unmount();

		expect(clearDocx).toHaveBeenCalled();
	});
});

describe('resolveZoomLevel', () => {
	const metrics = { viewportWidth: 600, viewportHeight: 300, pageWidth: 400, pageHeight: 500 };

	it('passes numeric levels through', () => {
		expect(resolveZoomLevel(125, metrics)).toBe(125);
	});

	it('fits the page width to the viewport', () => {
		expect(resolveZoomLevel('fit-width', metrics)).toBe(150);
	});

	it('fits the whole page inside the viewport', () => {
		expect(resolveZoomLevel('fit-page', metrics)).toBe(60);
	});

	it('automatic fits the width but never enlarges past 100%', () => {
		expect(resolveZoomLevel('automatic', metrics)).toBe(100);
		expect(resolveZoomLevel('automatic', { ...metrics, viewportWidth: 200 })).toBe(50);
	});

	it('returns null when the page or viewport has no size yet', () => {
		expect(resolveZoomLevel('fit-width', { ...metrics, pageWidth: 0 })).toBeNull();
		expect(resolveZoomLevel('fit-page', { ...metrics, viewportHeight: 0 })).toBeNull();
	});
});
