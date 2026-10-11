# Migrate from pnpm to Bun

The repo is on pnpm today (`pnpm-lock.yaml`), not npm. Bun replaces it as the package manager and script runner. Node stays the runtime for Vite, Vitest, and Playwright.

Baseline before the change: 44 unit test files, 489 tests, all passing.

## Steps

1. **Red.** Add `src/lib/package-manager.test.ts`. It fails while pnpm is still wired in.
2. **Config (main thread).**
   - Run `bun install` to create `bun.lock`.
   - Delete `pnpm-lock.yaml`.
   - Replace `pnpm run` with `bun run` in `package.json` scripts and `playwright.config.ts`.
   - Add a `packageManager` field set to `bun@1.4.0`.
3. **Docs (parallel subagent).** Update `README.md` and `docs/conversion-steps.md` command references. Leave `.workflows/` alone: those are finished one-shot scripts and rewriting them changes history.
4. **Green.** The new test passes.
5. **Verify (fresh subagent).** Clean install, `bun run check`, unit tests, `bun run build`, and Playwright. Counts must match the baseline.

## Decisions

- `.npmrc` keeps `engine-strict=true`. Bun ignores it and it does no harm.
- `npx shadcn-svelte add` lines in the migration note stay. They describe what consumers run, not this repo.
- `bun run test` still calls Vitest and Playwright, which run on Node. No test code changes.

## Rollback

Revert the branch. `pnpm-lock.yaml` returns with it.

## Fixed flake (not caused by this migration)

The original pnpm commit exited 1 in about 4 of 6 unit runs: "EnvironmentTeardownError" while loading `pdfjs-dist/build/pdf.worker.mjs?url` after a test file finished. Components import the PDF engine in `onMount`, and a test file could end before that import resolved. `vitest-setup-client.ts` now loads the engine module up front, so those imports resolve from the cache (0 errors in 8 client runs after the change, against 2 in 4 before).
