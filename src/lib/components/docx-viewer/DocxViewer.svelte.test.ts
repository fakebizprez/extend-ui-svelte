// MIT License — Svelte 5 port of Extend UI docx-viewer. Upstream: extend-hq/ui (MIT).
// Component tests: run in the Vitest client (jsdom) project.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import DocxViewer from './DocxViewer.svelte';

vi.mock('#lib/engines/docx/index.js', () => ({
	renderDocx: vi.fn(),
	clearDocx: vi.fn()
}));

// The mocked engine module: the component loads it through a dynamic import()
// inside onMount, which resolves to this same mock.
import { clearDocx, renderDocx } from '#lib/engines/docx/index.js';

const mockedRenderDocx = vi.mocked(renderDocx);

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

function sidebarOptions(container: HTMLElement): NodeListOf<HTMLElement> {
	return container.querySelectorAll('[data-testid="docx-thumbnails"] [role="option"]');
}

beforeEach(() => {
	vi.clearAllMocks();
	mockThreePages();
});

describe('DocxViewer', () => {
	it('renders an empty state when no src is given', async () => {
		const { container } = render(DocxViewer, {});

		expect(await screen.findByText('Upload a Word document to preview')).toBeVisible();
		// The hint is broken up by a <code> element, so match normalized text.
		const hint = container.querySelector('.docx-state-hint')?.textContent?.replace(/\s+/g, ' ');
		expect(hint).toContain('Pass a DOCX URL with the src prop or upload a file.');
		expect(mockedRenderDocx).not.toHaveBeenCalled();
	});

	it('renders the document through the docx engine', async () => {
		const { container } = render(DocxViewer, { src: 'https://example.com/doc.docx' });

		expect(await screen.findByText(FIXTURE_TEXT)).toBeVisible();
		expect(screen.getByText(SECOND_TEXT)).toBeVisible();
		expect(mockedRenderDocx).toHaveBeenCalledTimes(1);
		expect(mockedRenderDocx.mock.calls[0][0]).toBe('https://example.com/doc.docx');
		const renderedInto = mockedRenderDocx.mock.calls[0][1];
		expect(container.contains(renderedInto)).toBe(true);
		expect(screen.getByTestId('docx-page-indicator')).toHaveTextContent('Page 1 of 3');
	});

	it('shows an error state when rendering fails', async () => {
		mockedRenderDocx.mockRejectedValueOnce(new Error('boom'));
		render(DocxViewer, { src: 'https://example.com/doc.docx' });

		expect(await screen.findByText('Unable to display DOCX', { exact: false })).toBeVisible();
		expect(screen.getByRole('alert')).toHaveTextContent('boom');
	});

	it('toggles the thumbnail sidebar from the toolbar', async () => {
		const { container } = render(DocxViewer, { src: 'https://example.com/doc.docx' });

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
		render(DocxViewer, { src: 'https://example.com/doc.docx' });

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
		render(DocxViewer, { src: 'https://example.com/doc.docx' });

		await screen.findByText(FIXTURE_TEXT);
		expect(screen.getByTestId('docx-page-indicator')).toHaveTextContent('Page 1 of 3');

		await fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
		expect(screen.getByTestId('docx-page-indicator')).toHaveTextContent('Page 2 of 3');

		await fireEvent.click(screen.getByRole('button', { name: 'Previous page' }));
		expect(screen.getByTestId('docx-page-indicator')).toHaveTextContent('Page 1 of 3');
	});

	it('virtualizes the thumbnail sidebar instead of rendering every page', async () => {
		mockManyPages(200);
		const { container } = render(DocxViewer, { src: 'https://example.com/big.docx' });

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
			src: 'https://example.com/doc.docx',
			isDark: false
		});

		const viewer = await screen.findByTestId('docx-viewer');
		expect(viewer).toHaveAttribute('data-dark', 'false');
		expect(viewer.classList.contains('dark')).toBe(false);
		unmount();

		render(DocxViewer, { src: 'https://example.com/doc.docx', isDark: true });
		const darkViewer = await screen.findByTestId('docx-viewer');
		expect(darkViewer).toHaveAttribute('data-dark', 'true');
		expect(darkViewer.classList.contains('dark')).toBe(true);
	});

	it('notifies the parent when the dark-mode toggle is clicked', async () => {
		const onIsDarkChange = vi.fn();
		render(DocxViewer, {
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

	it('zooms the document in and out from the toolbar', async () => {
		render(DocxViewer, { src: 'https://example.com/doc.docx' });

		await screen.findByText(FIXTURE_TEXT);
		expect(screen.getByTestId('docx-zoom-level')).toHaveTextContent('100%');

		await fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
		expect(screen.getByTestId('docx-zoom-level')).toHaveTextContent('125%');

		await fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
		expect(screen.getByTestId('docx-zoom-level')).toHaveTextContent('75%');
	});

	it('hides the toolbar when showToolbar is false but still renders the document', async () => {
		render(DocxViewer, { src: 'https://example.com/doc.docx', showToolbar: false });

		expect(await screen.findByText(FIXTURE_TEXT)).toBeVisible();
		expect(screen.queryByTestId('docx-toolbar')).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Toggle thumbnails' })).not.toBeInTheDocument();
	});

	it('hides download and upload controls when disabled', async () => {
		render(DocxViewer, {
			src: 'https://example.com/doc.docx',
			showDownload: false,
			showUpload: false
		});

		await screen.findByText(FIXTURE_TEXT);
		expect(screen.queryByRole('button', { name: 'Download' })).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Upload' })).not.toBeInTheDocument();
		expect(screen.queryByTestId('docx-file-input')).not.toBeInTheDocument();
	});

	it('accepts Word documents in the upload input', async () => {
		render(DocxViewer, { src: 'https://example.com/doc.docx' });

		await screen.findByText(FIXTURE_TEXT);
		const input = screen.getByTestId('docx-file-input');
		expect(input).toHaveAttribute('accept', expect.stringContaining('.docx'));
		expect(input).toHaveAttribute('type', 'file');
	});

	it('clears the rendered output when unmounted', async () => {
		const { unmount } = render(DocxViewer, { src: 'https://example.com/doc.docx' });

		await screen.findByText(FIXTURE_TEXT);
		unmount();

		expect(clearDocx).toHaveBeenCalled();
	});
});
