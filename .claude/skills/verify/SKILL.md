---
name: verify
description: How to run and drive the docs site to verify a change in this repo.
---

# Verifying changes in extend-ui-svelte

Surface: the SvelteKit docs site (every component has a preview page).

1. Start the app: `bunx vite dev --port 5180 --strictPort --host 127.0.0.1` (5173 is the user's other app; 5175 may already be theirs).
2. Chrome through the browser extension cannot open local addresses here (it shows its own error page). Drive the page with headless Playwright instead: write a throwaway `tests/zz-*.e2e.ts` and run `E2E_BASE_URL=http://127.0.0.1:5180 bunx playwright test tests/zz-*.e2e.ts --reporter=line`. Print observations with `console.log('OBS', ...)` and save screenshots to the scratchpad. Delete the throwaway file when done.
3. The dev server is slow to start the page's scripts. After every `goto` or `reload`, wait for the shell to finish loading, for example `await page.waitForFunction(() => document.documentElement.dataset.theme !== undefined)`. Without it, menu clicks and the on-this-page list look broken when they are not.
4. For results that judge pass or fail, prefer the production build (`bun run build`, then Playwright with no `E2E_BASE_URL`); dev-server timing flakes some specs.

Flows worth driving: theme switch (flips, survives reload, bad or blocked storage), phone menu (opens, Escape and link click close it), previous/next links, a route not in the sidebar (`/engines/pdf`), an unknown route (404 keeps the shell), 900px width (sidebar yes, on-this-page list no).
