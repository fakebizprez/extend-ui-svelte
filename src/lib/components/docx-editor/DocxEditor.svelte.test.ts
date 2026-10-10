// MIT License — Svelte 5 port of Extend UI docx-editor. Upstream: extend-hq/ui (MIT).
// Component tests: run in the Vitest client (jsdom) project.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import DocxEditor, {
	blocksToEditorHtml,
	elementToBlocks,
	ensureDocxExtension,
	formatDocumentName
} from './DocxEditor.svelte';
import { DocxEditorPreview } from './index.js';

vi.mock('#lib/engines/docx/index.js', () => ({
	renderDocx: vi.fn(),
	clearDocx: vi.fn()
}));

// The mocked engine module: the component loads it through a dynamic import()
// inside onMount, which resolves to this same mock.
import { clearDocx, renderDocx } from '#lib/engines/docx/index.js';

const mockedRenderDocx = vi.mocked(renderDocx);
const mockedClearDocx = vi.mocked(clearDocx);

/** Required upstream props: dark mode is parent-controlled. */
const DARK = { isDark: false, onIsDarkChange: () => {} };

const FIXTURE_TEXT = 'Hello from the DOCX fixture';
const SECOND_TEXT = 'Second paragraph for the thumbnail sidebar.';

/** Default mock: renders docx-preview-like HTML with fixture-like text. */
function mockRenderedDocx(): void {
	mockedRenderDocx.mockImplementation(async (_source, container, options) => {
		container.innerHTML =
			'<div class="docx-wrapper"><section class="docx"><article>' +
			`<p>${FIXTURE_TEXT}</p>` +
			`<p><strong>Bold</strong> and <em>${SECOND_TEXT}</em></p>` +
			'</article></section></div>';
		return { container, showThumbnails: options?.showThumbnails ?? false };
	});
}

function execCommandMock(): ReturnType<typeof vi.fn> {
	const stub = vi.fn().mockReturnValue(true);
	Object.defineProperty(document, 'execCommand', {
		value: stub,
		configurable: true,
		writable: true
	});
	return stub;
}

beforeEach(() => {
	vi.clearAllMocks();
	mockRenderedDocx();
	execCommandMock();
});

describe('DocxEditor', () => {
	it('renders an empty state when no src is given', async () => {
		render(DocxEditor, { ...DARK });

		expect(await screen.findByText('Upload a Word document to edit')).toBeVisible();
		expect(mockedRenderDocx).not.toHaveBeenCalled();
	});

	it('loads docx text through the docx engine', async () => {
		render(DocxEditor, { ...DARK, src: 'https://example.com/doc.docx' });

		await screen.findByText(FIXTURE_TEXT);
		const editor = screen.getByTestId('docx-editor-content');
		expect(editor.textContent).toContain(FIXTURE_TEXT);
		expect(editor.textContent).toContain(SECOND_TEXT);
		expect(mockedRenderDocx).toHaveBeenCalledTimes(1);
	});

	it('applies bold and italic through the toolbar', async () => {
		const execCommand = execCommandMock();
		render(DocxEditor, { ...DARK, src: 'https://example.com/doc.docx' });
		await screen.findByTestId('docx-editor-content');

		await fireEvent.click(screen.getByRole('button', { name: 'Bold' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Italic' }));

		expect(execCommand).toHaveBeenCalledWith('bold');
		expect(execCommand).toHaveBeenCalledWith('italic');
	});

	it('applies headings and lists through the toolbar', async () => {
		const execCommand = execCommandMock();
		render(DocxEditor, { ...DARK, src: 'https://example.com/doc.docx' });
		await screen.findByTestId('docx-editor-content');

		await fireEvent.change(screen.getByLabelText('Block style'), { target: { value: 'h2' } });
		await fireEvent.click(screen.getByRole('button', { name: 'Bulleted list' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Numbered list' }));

		expect(execCommand).toHaveBeenCalledWith('formatBlock', false, 'h2');
		expect(execCommand).toHaveBeenCalledWith('insertUnorderedList');
		expect(execCommand).toHaveBeenCalledWith('insertOrderedList');
	});

	it('exports edited content as .docx bytes on download', async () => {
		const createObjectURL = vi.fn().mockReturnValue('blob:mock-docx');
		const revokeObjectURL = vi.fn();
		Object.defineProperty(URL, 'createObjectURL', {
			value: createObjectURL,
			configurable: true,
			writable: true
		});
		Object.defineProperty(URL, 'revokeObjectURL', {
			value: revokeObjectURL,
			configurable: true,
			writable: true
		});
		const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
		const onExport = vi.fn();
		try {
			render(DocxEditor, {
				...DARK,
				src: 'https://example.com/doc.docx',
				fileName: 'report.docx',
				onExport
			});
			await screen.findByText(FIXTURE_TEXT);

			await fireEvent.click(screen.getByRole('button', { name: 'Export .docx' }));

			await vi.waitFor(() => expect(onExport).toHaveBeenCalledTimes(1));
			const bytes = onExport.mock.calls[0][0] as Uint8Array;
			expect(bytes[0]).toBe(0x50);
			expect(bytes[1]).toBe(0x4b);
			expect(createObjectURL).toHaveBeenCalledTimes(1);
			const blob = createObjectURL.mock.calls[0][0] as Blob;
			expect(blob.type).toContain('wordprocessingml');
		} finally {
			clickSpy.mockRestore();
		}
	});

	it('replaces the document when a file is uploaded', async () => {
		render(DocxEditor, { ...DARK, src: 'https://example.com/doc.docx' });
		await screen.findByText(FIXTURE_TEXT);
		mockedRenderDocx.mockClear();

		const file = new File(['fake'], 'upload.docx', {
			type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
		});
		const input = document.querySelector(
			'[data-testid="docx-editor-upload-input"]'
		) as HTMLInputElement;
		await fireEvent.change(input, { target: { files: [file] } });

		await vi.waitFor(() => expect(mockedRenderDocx).toHaveBeenCalledTimes(1));
		expect(mockedRenderDocx.mock.calls[0][0]).toBe(file);
	});

	it('keeps dark mode parent-controlled', async () => {
		const onIsDarkChange = vi.fn();
		const { rerender } = render(DocxEditor, {
			...DARK,
			src: 'https://example.com/doc.docx',
			isDark: false,
			onIsDarkChange
		});
		const editor = await screen.findByTestId('docx-editor');

		expect(editor).toHaveAttribute('data-dark', 'false');
		expect(editor.classList.contains('dark')).toBe(false);

		await fireEvent.click(screen.getByRole('switch', { name: 'Toggle dark mode' }));
		expect(onIsDarkChange).toHaveBeenCalledWith(true);

		await rerender({ src: 'https://example.com/doc.docx', isDark: true, onIsDarkChange });
		expect(editor).toHaveAttribute('data-dark', 'true');
		expect(editor.classList.contains('dark')).toBe(true);
	});

	it('accepts className as an alias of class on the root', async () => {
		render(DocxEditor, { ...DARK, class: 'from-class', className: 'from-class-name' });

		expect(await screen.findByTestId('docx-editor')).toHaveClass(
			'docx-editor',
			'from-class',
			'from-class-name'
		);
	});

	it('is exported under the upstream name DocxEditorPreview', () => {
		expect(DocxEditorPreview).toBe(DocxEditor);
	});

	it('starts at upstream defaultZoomScale 100 and zooms through the upstream steps', async () => {
		render(DocxEditor, { ...DARK, src: 'https://example.com/doc.docx' });
		await screen.findByText(FIXTURE_TEXT);
		const content = screen.getByTestId('docx-editor-content');
		const select = screen.getByRole('combobox', { name: 'Zoom level' }) as HTMLSelectElement;

		expect(content.getAttribute('style')).toContain('zoom: 100%');
		expect(select.value).toBe('100');
		expect(Array.from(select.options).map((option) => option.value)).toEqual([
			'50', '75', '90', '100', '110', '125', '150', '175', '200'
		]);

		await fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
		expect(content.getAttribute('style')).toContain('zoom: 110%');
		await fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
		expect(select.value).toBe('90');
	});

	it('honors defaultZoomScale and falls back to 100 for values off the scale, like upstream', async () => {
		const { unmount } = render(DocxEditor, {
			...DARK,
			src: 'https://example.com/doc.docx',
			defaultZoomScale: 150
		});
		await screen.findByText(FIXTURE_TEXT);
		expect(screen.getByTestId('docx-editor-content').getAttribute('style')).toContain('zoom: 150%');
		unmount();

		render(DocxEditor, { ...DARK, src: 'https://example.com/doc.docx', defaultZoomScale: 130 });
		await screen.findByText(FIXTURE_TEXT);
		expect(screen.getByTestId('docx-editor-content').getAttribute('style')).toContain('zoom: 100%');
	});

	it('clears the engine output on teardown', async () => {
		const { unmount } = render(DocxEditor, { ...DARK, src: 'https://example.com/doc.docx' });
		await screen.findByText(FIXTURE_TEXT);

		unmount();

		expect(mockedClearDocx).toHaveBeenCalled();
	});
});

describe('elementToBlocks', () => {
	it('extracts paragraphs with bold and italic runs', () => {
		expect.assertions(4);
		const root = document.createElement('div');
		root.innerHTML = `<p>Hello <strong>bold</strong> and <em>italic</em></p><p>${SECOND_TEXT}</p>`;

		const blocks = elementToBlocks(root);

		expect(blocks).toHaveLength(2);
		expect(blocks[0]).toEqual({
			type: 'paragraph',
			runs: [
				{ text: 'Hello ', bold: false, italic: false },
				{ text: 'bold', bold: true, italic: false },
				{ text: ' and ', bold: false, italic: false },
				{ text: 'italic', bold: false, italic: true }
			]
		});
		expect(blocks[1].type).toBe('paragraph');
		expect(blocks[1].runs.map((run) => run.text).join('')).toBe(SECOND_TEXT);
	});

	it('maps headings and list items to block types', () => {
		expect.assertions(5);
		const root = document.createElement('div');
		root.innerHTML =
			'<h1>Title</h1><h2>Sub</h2><ul><li>bullet</li></ul><ol><li>number</li></ol>';

		const blocks = elementToBlocks(root);

		expect(blocks.map((block) => block.type)).toEqual([
			'heading1',
			'heading2',
			'bullet',
			'number'
		]);
		expect(blocks[0].runs[0].text).toBe('Title');
		expect(blocks[1].runs[0].text).toBe('Sub');
		expect(blocks[2].runs[0].text).toBe('bullet');
		expect(blocks[3].runs[0].text).toBe('number');
	});
});

describe('blocksToEditorHtml', () => {
	it('round-trips blocks to editor HTML', () => {
		expect.assertions(4);
		const html = blocksToEditorHtml([
			{ type: 'heading1', runs: [{ text: 'Title', bold: true, italic: false }] },
			{
				type: 'paragraph',
				runs: [
					{ text: 'plain ', bold: false, italic: false },
					{ text: 'fancy', bold: true, italic: true }
				]
			},
			{ type: 'bullet', runs: [{ text: 'item', bold: false, italic: false }] }
		]);

		expect(html).toContain('<h1><strong>Title</strong></h1>');
		expect(html).toContain('<p>plain <strong><em>fancy</em></strong></p>');
		expect(html).toContain('<ul><li>item</li></ul>');
		// Consecutive list items share one list element.
		expect(blocksToEditorHtml([
			{ type: 'bullet', runs: [{ text: 'a', bold: false, italic: false }] },
			{ type: 'bullet', runs: [{ text: 'b', bold: false, italic: false }] }
		])).toBe('<ul><li>a</li><li>b</li></ul>');
	});
});

describe('document name helpers', () => {
	it('prefers an explicit fileName, else the URL segment', () => {
		expect(formatDocumentName('report.docx', 'https://example.com/other.docx')).toBe(
			'report.docx'
		);
		expect(formatDocumentName(undefined, 'https://example.com/files/report.docx?v=2')).toBe(
			'report.docx'
		);
		expect(formatDocumentName(undefined, 'https://example.com/')).toBe('document.docx');
	});

	it('appends .docx unless already present', () => {
		expect(ensureDocxExtension('report')).toBe('report.docx');
		expect(ensureDocxExtension('report.docx')).toBe('report.docx');
	});
});
