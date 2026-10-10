# CLAUDE.md

## Project intent

Port Extend UI, an open-source React component library for document-heavy apps, to a **Svelte 5 component library**.

- Upstream: `extend-hq/ui` (MIT). Docs are on Context7 as `/extend-hq/ui`.
- Target: Svelte 5 with runes. Components are published as a copy-in registry in the shadcn-svelte style, plus an npm package for the heavy viewers and editors.
- Scope: the 18 upstream components. Viewers and editors for PDF, DOCX, XLSX, PPTX, and CSV. Plus file upload, file thumbnail, file system, document splits, schema builder, layout blocks, bounding-box citations, sidebar, e-signature, and primitives (group, color-picker, toggle).

## Status

All 18 components are ported and in `registry.json`. Work now is parity fixes, polish, and keeping tests green.

## Commands

Bun is the package manager (`docs/bun-migration.md`). Node runs Vite, Vitest, and Playwright.

- `bun run check` runs svelte-check.
- `bun run test:unit -- --run` runs Vitest once. `bun run test:e2e` runs Playwright. `bun run test` runs both.
- `bun run build` builds the docs site and packages the library.
- Known flake: unit runs sometimes exit 1 with "EnvironmentTeardownError" from `pdf.worker.mjs` even though all tests pass.

## Rules for this work

- **Keep the public contract.** Dark mode stays controlled by the parent: `isDark` plus `onIsDarkChange`. Prop names match the React versions unless a deliberate change is recorded in the docs.
- **Reuse the framework-free engines.** Use PDF.js, SheetJS, docx-preview, pdf-lib, signature_pad, and papaparse directly. Do not port the `@extend-ai/react-*` packages; they are React-only.
- **Use Svelte 5 runes.** `$props` for inputs, `$bindable` for two-way values, `$state` and `$derived` for local state, `$effect` for side effects with cleanup. Use `$state.raw` for large parsed documents so they are not deep-proxied.
- **Browser-only code loads on the client.** Engines touch `window`, canvas, and workers. Load them with dynamic `import()` inside `onMount` or guard with `browser`.
- **Virtualize large content.** Pages, sheet rows, and slide lists must not render all at once.
- **Attribution.** Keep the MIT license and credit `extend-hq/ui` in the package and each ported component's header.
- **Do not edit upstream.** Work only in this repo. Read upstream through Context7 or a clone in the scratchpad.
- **Tests come with each feature.** Unit tests with Vitest and Svelte Testing Library. Playwright tests for rendering real PDF and Office fixtures.
- **Verify before claiming done.** A component is done when its tests pass and it renders in the docs site.
- **Run the Svelte autofixer.** After writing or editing any `.svelte` or `.svelte.ts` file, run the Svelte MCP `svelte-autofixer` until it is clean. Use the `svelte-file-editor` agent for non-trivial edits.
- **Parity ledger.** `src/lib/parity/port-parity.test.ts` compares each component's props with upstream (`extend-hq/ui@54adccfb`). Its known-gap lists must match reality exactly. Closing or opening a gap fails the suite until the list is updated.
- **Commit on the current branch.** Do not create new branches unless asked.
- **Look up current docs.** Use Context7 for Svelte, shadcn-svelte, PDF.js, SheetJS, and other libraries before writing code against them.

## Key references

- Bun migration and the teardown flake: `docs/bun-migration.md`
- React to Svelte migration note: `docs/migration-react-to-svelte.md`
- Conversion steps: `docs/conversion-steps.md`
- Upstream component list and dependencies: see the port inventory in `docs/conversion-steps.md`, section 2.
