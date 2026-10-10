// MIT License — Svelte 5 port of Extend UI docx-editor. Upstream: extend-hq/ui (MIT).
// Pure export helper tests: run in the Vitest server (node) project.
import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import {
	blocksToDocumentXml,
	buildDocxParts,
	DOCX_MIME_TYPE,
	escapeXml,
	exportDocxBytes,
	type DocxEditorBlock
} from './export.js';

const PARAGRAPH: DocxEditorBlock = {
	type: 'paragraph',
	runs: [{ text: 'Hello from the DOCX fixture' }]
};

describe('escapeXml', () => {
	it('escapes the five XML special characters', () => {
		expect(escapeXml(`a&b<c>d"e'f`)).toBe('a&amp;b&lt;c&gt;d&quot;e&apos;f');
	});

	it('passes plain text through unchanged', () => {
		expect(escapeXml('plain text 123')).toBe('plain text 123');
	});
});

describe('blocksToDocumentXml', () => {
	it('emits a paragraph with a single run', () => {
		const xml = blocksToDocumentXml([PARAGRAPH]);

		expect(xml).toContain('<w:p>');
		expect(xml).toContain('<w:t xml:space="preserve">Hello from the DOCX fixture</w:t>');
	});

	it('marks bold and italic runs', () => {
		const xml = blocksToDocumentXml([
			{
				type: 'paragraph',
				runs: [
					{ text: 'bold', bold: true },
					{ text: 'italic', italic: true },
					{ text: 'both', bold: true, italic: true },
					{ text: 'plain' }
				]
			}
		]);

		expect(xml).toContain('<w:b/>');
		expect(xml).toContain('<w:i/>');
		expect(xml).toContain('plain');
	});

	it('maps headings to Word heading styles', () => {
		const xml = blocksToDocumentXml([
			{ type: 'heading1', runs: [{ text: 'H1' }] },
			{ type: 'heading2', runs: [{ text: 'H2' }] },
			{ type: 'heading3', runs: [{ text: 'H3' }] }
		]);

		expect(xml).toContain('<w:pStyle w:val="Heading1"/>');
		expect(xml).toContain('<w:pStyle w:val="Heading2"/>');
		expect(xml).toContain('<w:pStyle w:val="Heading3"/>');
	});

	it('marks list items with numbering properties', () => {
		const xml = blocksToDocumentXml([
			{ type: 'bullet', runs: [{ text: 'bullet item' }] },
			{ type: 'number', runs: [{ text: 'numbered item' }] }
		]);

		expect(xml).toContain('<w:numPr>');
		expect(xml).toContain('bullet item');
		expect(xml).toContain('numbered item');
	});

	it('escapes run text', () => {
		const xml = blocksToDocumentXml([{ type: 'paragraph', runs: [{ text: 'a&b<c>' }] }]);

		expect(xml).toContain('a&amp;b&lt;c&gt;');
	});

	it('emits an empty paragraph when given no blocks', () => {
		const xml = blocksToDocumentXml([]);

		expect(xml).toContain('<w:body>');
		expect(xml).toContain('<w:p>');
	});
});

describe('buildDocxParts', () => {
	it('includes every part a minimal .docx needs', () => {
		const parts = buildDocxParts(blocksToDocumentXml([PARAGRAPH]));

		expect(Object.keys(parts).sort()).toEqual(
			[
				'[Content_Types].xml',
				'_rels/.rels',
				'docProps/app.xml',
				'docProps/core.xml',
				'word/_rels/document.xml.rels',
				'word/document.xml',
				'word/numbering.xml',
				'word/styles.xml'
			].sort()
		);
		expect(parts['word/document.xml']).toContain('Hello from the DOCX fixture');
	});
});

describe('exportDocxBytes', () => {
	it('produces a zip archive with the document MIME type', () => {
		expect(DOCX_MIME_TYPE).toBe(
			'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
		);
	});

	it('produces bytes starting with the zip magic that reopen as a valid .docx', async () => {
		const bytes = await exportDocxBytes([PARAGRAPH]);

		expect(bytes[0]).toBe(0x50);
		expect(bytes[1]).toBe(0x4b);
		const zip = await JSZip.loadAsync(bytes);
		const documentXml = await zip.file('word/document.xml')?.async('string');

		expect(documentXml).toContain('Hello from the DOCX fixture');
	});

	it('round-trips formatting through the exported package', async () => {
		const bytes = await exportDocxBytes([
			{ type: 'heading1', runs: [{ text: 'Title', bold: true }] },
			{ type: 'bullet', runs: [{ text: 'item', italic: true }] }
		]);
		const zip = await JSZip.loadAsync(bytes);
		const documentXml = (await zip.file('word/document.xml')?.async('string')) ?? '';

		expect(documentXml).toContain('<w:pStyle w:val="Heading1"/>');
		expect(documentXml).toContain('<w:b/>');
		expect(documentXml).toContain('<w:i/>');
		expect(documentXml).toContain('<w:numPr>');
	});
});
