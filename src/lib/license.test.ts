// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
// MIT requires the upstream copyright notices to ship with the port.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('LICENSE', () => {
	it('keeps the upstream Extend UI and shadcn copyright notices', () => {
		const license = readFileSync('LICENSE', 'utf8');
		expect(license).toContain('Copyright (c) 2026 CrowdView Inc, dba Extend');
		expect(license).toContain('Portions Copyright (c) 2023 shadcn');
	});
});
