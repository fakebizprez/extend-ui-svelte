import { describe, expect, it } from 'vitest';
import registry from '../../registry.json';

const EXPECTED_COMPONENTS = [
	'file-upload',
	'csv-tsv-viewer',
	'document-viewer-sidebar',
	'file-thumbnail',
	'pdf-viewer',
	'docx-viewer',
	'xlsx-viewer',
	'pptx-viewer',
	'pdf-editor',
	'docx-editor',
	'xlsx-editor',
	'file-system',
	'document-splits',
	'schema-builder',
	'layout-blocks',
	'bounding-box-citations',
	'e-signature',
	'group',
	'color-picker',
	'toggle'
];

describe('registry.json skeleton', () => {
	it('lists every Phase 1 component exactly once', () => {
		const names = registry.items.map((item) => item.name);

		expect(names).toHaveLength(EXPECTED_COMPONENTS.length);
		expect(names).toEqual(expect.arrayContaining(EXPECTED_COMPONENTS));
	});
});
