// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
// Generates the multi-sheet XLSX fixture for the xlsx engine wrapper tests.
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

const summary = utils.aoa_to_sheet([
	['Metric', 'Value'],
	['Total SKUs', 5],
	['Total units', 787]
]);
utils.book_append_sheet(workbook, summary, 'Summary');

const notes = utils.aoa_to_sheet([
	['Note', 'Author', 'Day'],
	['Cycle count Reno', 'Ada', 'Monday'],
	['Reorder jumpers', 'Grace', 'Tuesday'],
	['Audit Austin', 'Linus', 'Wednesday']
]);
utils.book_append_sheet(workbook, notes, 'Notes');

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
