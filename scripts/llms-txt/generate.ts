// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
// Generates static/llms.txt and static/llms-full.txt from the docs catalogue.
// Run with `bun run llms`. The /engines/* and other harness routes are test
// pages, not public docs, so they are deliberately excluded.
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PREVIEW_COMPONENTS } from '../../src/routes/components';
import { NAV_GROUPS } from '../../src/routes/_shell/nav';

export const BASE_URL = 'https://extend-ui-svelte.linehaul.ai';
const REPO_URL = 'https://github.com/fakebizprez/extend-ui-svelte';
const UPSTREAM_URL = 'https://github.com/extend-hq/ui';

const TAGLINE =
	'Svelte 5 component library for document-heavy apps: PDF, DOCX, XLSX, PPTX and CSV viewers and editors, file handling, and data-display primitives.';

const HOME_DESCRIPTION =
	'Docs home with install instructions for the copy-in registry and the extend-ui-svelte npm package, plus the MIT license note.';

const GROUP_NOTE: Record<string, string> = {
	Files:
		'Client-side file handling with Svelte 5 runes; dark mode is parent-controlled through isDark and onIsDarkChange.',
	Viewers:
		'PDF pages, spreadsheet rows, and slide lists render virtualized; dark mode is parent-controlled through isDark and onIsDarkChange.',
	Editors:
		'In-browser editing with Svelte 5 runes; dark mode is parent-controlled through isDark and onIsDarkChange.',
	'Data and layout':
		'Data-display components with Svelte 5 runes; dark mode is parent-controlled through isDark and onIsDarkChange.',
	Primitives:
		'Small controlled primitives with Svelte 5 runes; dark mode follows the parent isDark value.'
};

interface DocEntry {
	title: string;
	url: string;
	description: string;
}

function entry({ title, url, description }: DocEntry): string {
	return `- [${title}](${url}): ${description}`;
}

/** Count markdown link entries in a document. */
export function countEntries(content: string): number {
	return content.match(/^- \[[^\]]+\]\(https?:\/\//gm)?.length ?? 0;
}

function keyFactsSection(extended: boolean): string[] {
	const lines = [
		'## Key Facts',
		'',
		`- Svelte 5 port of extend-hq/ui (${UPSTREAM_URL}) for document-heavy apps`,
		`- ${PREVIEW_COMPONENTS.length} documented components in ${NAV_GROUPS.length} groups: ${NAV_GROUPS.map((group) => group.title).join(', ')}`,
		'- Copy-in registry in the shadcn-svelte style, plus the extend-ui-svelte npm package for the heavy viewers and editors',
		'- Dark mode is parent-controlled through isDark and onIsDarkChange',
		'- MIT licensed'
	];
	if (extended) {
		lines.push(
			'- Viewers and editors reuse framework-free engines directly: PDF.js, SheetJS, docx-preview, pdf-lib, signature_pad, and papaparse',
			'- Large content stays virtualized: PDF pages, spreadsheet rows, and slide lists never render all at once',
			'- Browser-only engine code loads on the client with dynamic import() inside onMount'
		);
	}
	return lines;
}

function contactSection(): string[] {
	return [
		'## Contact',
		'',
		`- Website: ${BASE_URL}`,
		`- Repository: ${REPO_URL}`,
		`- Upstream: ${UPSTREAM_URL}`
	];
}

function repositorySection(): string[] {
	return [
		'## Repository',
		'',
		entry({
			title: 'extend-ui-svelte repository',
			url: REPO_URL,
			description:
				'MIT-licensed source for the Svelte 5 port, the docs site, the copy-in registry, and the npm package with its Vitest and Playwright suites.'
		}),
		entry({
			title: 'registry.json',
			url: `${REPO_URL}/blob/main/registry.json`,
			description:
				'Shadcn-svelte style registry catalogue listing every component, its files, and its dependencies for copy-in installs.'
		}),
		entry({
			title: 'conversion-steps.md',
			url: `${REPO_URL}/blob/main/docs/conversion-steps.md`,
			description:
				'Port inventory and conversion procedure documenting how each of the upstream React components maps to its Svelte 5 equivalent.'
		}),
		entry({
			title: 'migration-react-to-svelte.md',
			url: `${REPO_URL}/blob/main/docs/migration-react-to-svelte.md`,
			description:
				'Migration note for React users of extend-hq/ui covering prop parity, the dark-mode contract, and Svelte runes usage.'
		}),
		entry({
			title: 'bun-migration.md',
			url: `${REPO_URL}/blob/main/docs/bun-migration.md`,
			description:
				'Package-manager and tooling notes for the repo: Bun scripts, the pdf.worker.mjs teardown flake, and CI expectations.'
		})
	];
}

function buildDocument(extended: boolean): string {
	const lines: string[] = ['# Extend UI Svelte', '', `> ${TAGLINE}`, ''];
	lines.push('## Docs', '', entry({ title: 'Extend UI Svelte', url: `${BASE_URL}/`, description: HOME_DESCRIPTION }), '');
	for (const group of NAV_GROUPS) {
		lines.push(`## ${group.title}`, '');
		if (extended && GROUP_NOTE[group.title]) {
			lines.push(GROUP_NOTE[group.title], '');
		}
		for (const item of group.items) {
			lines.push(
				entry({ title: item.title, url: `${BASE_URL}/${item.slug}`, description: item.description })
			);
		}
		lines.push('');
	}
	if (extended) {
		lines.push(...repositorySection(), '');
	}
	lines.push(...keyFactsSection(extended), '', ...contactSection(), '');
	return `${lines.join('\n')}\n`;
}

/** Concise llms.txt covering every public docs page. Pure. */
export function generateLlmsTxt(): string {
	return buildDocument(false);
}

/** Extended llms-full.txt with deeper descriptions and repo pointers. Pure. */
export function generateLlmsFullTxt(): string {
	return buildDocument(true);
}

const THIS_FILE = fileURLToPath(import.meta.url);
const invokedAsScript = process.argv[1]?.endsWith('scripts/llms-txt/generate.ts') ?? false;

if (invokedAsScript) {
	const staticDir = join(dirname(THIS_FILE), '..', '..', 'static');
	writeFileSync(join(staticDir, 'llms.txt'), generateLlmsTxt());
	writeFileSync(join(staticDir, 'llms-full.txt'), generateLlmsFullTxt());
	console.log('Wrote static/llms.txt and static/llms-full.txt');
}
