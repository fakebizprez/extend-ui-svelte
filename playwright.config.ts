import { defineConfig } from '@playwright/test';

// E2E_BASE_URL=http://localhost:5173 runs the specs against an already-running dev server.
const baseURL = process.env.E2E_BASE_URL;

export default defineConfig({
	webServer: baseURL ? undefined : { command: 'bun run build && bun run preview', port: 4173 },
	use: baseURL ? { baseURL } : {},
	testMatch: '**/*.e2e.{ts,js}'
});
