// MIT License — Svelte 5 port of Extend UI docx-editor. Upstream: extend-hq/ui (MIT).
// Pure .docx export helpers: editor blocks become a minimal Word package built
// with jszip (MIT). This module is DOM-free; jszip loads through a dynamic
// import() inside exportDocxBytes so importing this module has no side effects.

/** One styled text run inside an editor block. */
export interface DocxEditorRun {
	text: string;
	bold?: boolean;
	italic?: boolean;
}

/** Block kinds the editor round-trips: paragraphs, headings, and list items. */
export type DocxEditorBlockType =
	| 'paragraph'
	| 'heading1'
	| 'heading2'
	| 'heading3'
	| 'bullet'
	| 'number';

/** One editor block: a block kind plus its styled runs. */
export interface DocxEditorBlock {
	type: DocxEditorBlockType;
	runs: DocxEditorRun[];
}

export const DOCX_MIME_TYPE =
	'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** Escapes the five XML special characters in run text. */
export function escapeXml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

/** Word paragraph style for a block kind, or null for the default style. */
function styleForBlock(type: DocxEditorBlockType): string | null {
	switch (type) {
		case 'heading1':
			return 'Heading1';
		case 'heading2':
			return 'Heading2';
		case 'heading3':
			return 'Heading3';
		default:
			return null;
	}
}

/** Numbering id for list blocks: 1 is the bullet list, 2 the numbered list. */
function numberingIdForBlock(type: DocxEditorBlockType): number | null {
	if (type === 'bullet') return 1;
	if (type === 'number') return 2;
	return null;
}

/** Serializes one styled run to WordprocessingML. */
function runToXml(run: DocxEditorRun): string {
	let properties = '';
	if (run.bold) properties += '<w:b/>';
	if (run.italic) properties += '<w:i/>';
	const props = properties ? `<w:rPr>${properties}</w:rPr>` : '';
	return `<w:r>${props}<w:t xml:space="preserve">${escapeXml(run.text)}</w:t></w:r>`;
}

/** Serializes one editor block to a w:p element. */
function blockToXml(block: DocxEditorBlock): string {
	let paragraphProps = '';
	const style = styleForBlock(block.type);
	if (style) paragraphProps += `<w:pStyle w:val="${style}"/>`;
	const numberingId = numberingIdForBlock(block.type);
	if (numberingId !== null) {
		paragraphProps += `<w:numPr><w:ilvl w:val="0"/><w:numId w:val="${numberingId}"/></w:numPr>`;
	}
	const props = paragraphProps ? `<w:pPr>${paragraphProps}</w:pPr>` : '';
	const runs = block.runs.length > 0 ? block.runs.map(runToXml).join('') : '<w:r></w:r>';
	return `<w:p>${props}${runs}</w:p>`;
}

/**
 * Serializes editor blocks to word/document.xml. An empty block list still
 * yields a valid body with one empty paragraph so Word opens the export.
 */
export function blocksToDocumentXml(blocks: DocxEditorBlock[]): string {
	const paragraphs =
		blocks.length > 0 ? blocks.map(blockToXml).join('') : '<w:p><w:r></w:r></w:p>';
	return (
		'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
		'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">\n' +
		`  <w:body>${paragraphs}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/></w:sectPr></w:body>\n` +
		'</w:document>'
	);
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`;

const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/></w:style>
  <w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/></w:style>
</w:styles>`;

const NUMBERING = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:abstractNum w:abstractNumId="0">
    <w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="&#x2022;"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl>
  </w:abstractNum>
  <w:abstractNum w:abstractNumId="1">
    <w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl>
  </w:abstractNum>
  <w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
  <w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num>
</w:numbering>`;

const DOCUMENT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
</Relationships>`;

const CORE = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <dc:title>Document edited with extend-ui-svelte</dc:title>
</cp:coreProperties>`;

const APP = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
  <Application>extend-ui-svelte docx-editor</Application>
</Properties>`;

/**
 * Builds every part of a minimal .docx package for the given document.xml.
 * Pure and DOM-free; the map keys are zip paths.
 */
export function buildDocxParts(documentXml: string): Record<string, string> {
	return {
		'[Content_Types].xml': CONTENT_TYPES,
		'_rels/.rels': RELS,
		'word/document.xml': documentXml,
		'word/styles.xml': STYLES,
		'word/numbering.xml': NUMBERING,
		'word/_rels/document.xml.rels': DOCUMENT_RELS,
		'docProps/core.xml': CORE,
		'docProps/app.xml': APP
	};
}

/**
 * Exports editor blocks as .docx bytes. jszip is browser-safe and loads here
 * through a dynamic import() so importing this module stays side-effect free.
 */
export async function exportDocxBytes(blocks: DocxEditorBlock[]): Promise<Uint8Array> {
	const { default: JSZip } = await import('jszip');
	const zip = new JSZip();
	const parts = buildDocxParts(blocksToDocumentXml(blocks));
	for (const [path, content] of Object.entries(parts)) {
		zip.file(path, content);
	}
	return await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}
