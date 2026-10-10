import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('package manager is Bun', () => {
	const pkg = JSON.parse(read('package.json'));

	it('has a Bun lockfile and no pnpm or npm lockfile', () => {
		expect(existsSync('bun.lock')).toBe(true);
		expect(existsSync('pnpm-lock.yaml')).toBe(false);
		expect(existsSync('package-lock.json')).toBe(false);
	});

	it('pins Bun in packageManager', () => {
		expect(pkg.packageManager).toMatch(/^bun@\d+\.\d+\.\d+$/);
	});

	it('scripts do not call pnpm or npm', () => {
		for (const [name, script] of Object.entries<string>(pkg.scripts)) {
			expect(script, name).not.toMatch(/\b(pnpm|npm)\b/);
		}
	});

	it('playwright starts the server with Bun', () => {
		const config = read('playwright.config.ts');
		expect(config).not.toMatch(/\b(pnpm|npm)\b/);
		expect(config).toMatch(/bun run/);
	});

	it('README documents Bun commands only', () => {
		const readme = read('README.md');
		expect(readme).not.toMatch(/\bpnpm\b/);
		expect(readme).toMatch(/bun /);
	});
});
