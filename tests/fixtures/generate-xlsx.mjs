// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
// Generates the multi-sheet XLSX fixture for the xlsx engine, viewer, and
// editor tests.
// Usage: node tests/fixtures/generate-xlsx.mjs
// Writes tests/fixtures/sample.xlsx (unit tests) and static/fixtures/sample.xlsx
// (same bytes, served to the Playwright harness page).
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { utils, write } from 'xlsx';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..');

const workbook = utils.book_new();

const inventory = utils.aoa_to_sheet([
	['SKU', 'Item', 'Qty', 'Warehouse'],
	['A-9001', 'Resistor kit', 120, 'Reno'],
	['A-9002', 'Capacitor set', 85, 'Austin'],
	['A-9003', 'Breadboard', 200, 'Reno'],
	['A-9004', 'Jumper wires', 340, 'Austin'],
	['A-9005', 'Multimeter', 42, 'Reno']
]);
utils.book_append_sheet(workbook, inventory, 'Inventory');

// Formula cells carry SheetJS's cached value (v) next to the formula (f),
// the way Excel saves them.
const summary = utils.aoa_to_sheet([
	['Metric', 'Value'],
	['Total SKUs', { t: 'n', v: 5, f: 'COUNTA(Inventory!A2:A6)' }],
	['Total units', { t: 'n', v: 787, f: 'SUM(Inventory!C2:C6)' }]
]);
utils.book_append_sheet(workbook, summary, 'Summary');

const notes = utils.aoa_to_sheet([
	['Note', 'Author', 'Day'],
	['Cycle count Reno', 'Ada', 'Monday'],
	['Reorder jumpers', 'Grace', 'Tuesday'],
	['Audit Austin', 'Linus', 'Wednesday']
]);
utils.book_append_sheet(workbook, notes, 'Notes');

// Data starts at B2 with a blank row 4, so A1 positions must survive load
// and export unchanged.
const lanes = {};
utils.sheet_add_aoa(
	lanes,
	[
		['Lane', 'Loads', 'Miles'],
		['Reno-Austin', 4, 1650],
		[],
		['Austin-Reno', 3, 1650],
		['Total', { t: 'n', v: 7, f: 'SUM(C3:C5)' }, { t: 'n', v: 3300, f: 'SUM(D3:D5)' }]
	],
	{ origin: 'B2' }
);
// Excel saves the used range, not A1, as the sheet dimension.
lanes['!ref'] = 'B2:D6';
utils.book_append_sheet(workbook, lanes, 'Lanes');

// Cells that must keep their types: text starting with =, a boolean, numeric
// text, formulas whose saved results are a number (one stale, as saved with
// manual calculation), a boolean, and an error, plus a literal error.
const checks = {
	'!ref': 'A1:I1',
	A1: { t: 's', v: '=abc' },
	B1: { t: 'n', v: 10 },
	C1: { t: 'b', v: true },
	D1: { t: 's', v: '5' },
	E1: { t: 'n', v: 10, f: 'SUM(B1:D1)' },
	F1: { t: 'n', v: 999, f: 'B1*2' },
	G1: { t: 'b', v: true, f: '1=1' },
	H1: { t: 'e', v: 0x07, f: '1/0' },
	I1: { t: 'e', v: 0x2a }
};
utils.book_append_sheet(workbook, checks, 'Checks');

const bytes = write(workbook, { type: 'buffer', bookType: 'xlsx' });

const targets = [
	join(repoRoot, 'tests', 'fixtures', 'sample.xlsx'),
	join(repoRoot, 'static', 'fixtures', 'sample.xlsx')
];
for (const target of targets) {
	mkdirSync(dirname(target), { recursive: true });
	writeFileSync(target, bytes);
	console.log(`wrote ${target} (${bytes.length} bytes)`);
}
