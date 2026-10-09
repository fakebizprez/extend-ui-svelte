# extend-ui-svelte

Svelte 5 port of [Extend UI](https://github.com/extend-hq/ui) (MIT): components
for document-heavy apps. Library plus docs site in one SvelteKit project.

## Scripts

- `bun dev` — docs site with live component previews
- `bun run test` — Vitest unit/component suite, then Playwright end-to-end
- `bun run test:unit` — Vitest in watch mode
- `bun run test:e2e` — Playwright docs-site tests
- `bun run build` — docs site plus `svelte-package` library build with `publint`
- `bun run check` — `svelte-check` type checking

## Layout

- `src/lib/` — published library (`svelte-package`, entry `src/lib/index.ts`)
- `src/routes/` — docs site, one preview page per component
- `tests/` — Playwright end-to-end tests (`*.e2e.ts`)
- `registry.json` — shadcn-svelte style registry skeleton
- `docs/conversion-steps.md` — port plan and component inventory

## Status

Phase 1 skeleton: packaging, test wiring, docs shell, and registry are in
place. Components land in later phases; each ships with Vitest coverage and a
docs preview page.

## License

MIT. Upstream credit: `extend-hq/ui`.
