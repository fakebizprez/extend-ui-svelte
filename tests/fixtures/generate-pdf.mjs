// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
// Generates the multi-page PDF fixture used by the PDF engine tests.
// Usage: node tests/fixtures/generate-pdf.mjs
//
// Writes the canonical fixture to tests/fixtures/sample.pdf and a served
// copy to static/fixtures/sample.pdf so the test harness page can load it
// over HTTP in dev and preview builds.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const PAGE_COUNT = 3;

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..');

async function main() {
	const doc = await PDFDocument.create();
	const font = await doc.embedFont(StandardFonts.Helvetica);

	for (let i = 1; i <= PAGE_COUNT; i += 1) {
		const page = doc.addPage([612, 792]);
		page.drawText(`Extend UI Svelte — PDF engine fixture, page ${i} of ${PAGE_COUNT}`, {
			x: 72,
			y: 720,
			size: 14,
			font,
			color: rgb(0.1, 0.1, 0.1)
		});
		page.drawText(`Page number: ${i}`, { x: 72, y: 690, size: 12, font });
	}

	const bytes = await doc.save();
	const targets = [
		join(repoRoot, 'tests', 'fixtures', 'sample.pdf'),
		join(repoRoot, 'static', 'fixtures', 'sample.pdf')
	];
	for (const target of targets) {
		mkdirSync(dirname(target), { recursive: true });
		writeFileSync(target, bytes);
		console.log(`wrote ${target} (${PAGE_COUNT} pages, ${bytes.length} bytes)`);
	}
}

await main();
