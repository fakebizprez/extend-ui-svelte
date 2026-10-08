# Extend UI to Svelte 5: conversion steps

Goal and rules are in `CLAUDE.md` (or `AGENTS.md` if you prefer). Work in order. Each phase ends with its tests passing.

## 0. Get the upstream source

- Clone `extend-hq/ui` into the scratchpad, not into this repo.
- Read `apps/v4/components` and each `package.json` for exact dependency versions.
- Record the versions in a table in this file's section 2.

## 1. Project setup

- Initialize a SvelteKit project with Svelte 5, TypeScript, and pnpm.
- Set up the library package with `svelte-package`, an exports map with `types` and `svelte` conditions, and `publint`.
- Add Vitest, Svelte Testing Library, and Playwright.
- Add a docs site (SvelteKit) with one preview page per component.
- Add the shadcn-svelte registry template so components can be installed with the CLI.

## 2. Component inventory

Fill this in during phase 0. Columns: component, React deps, Svelte path (reuse engine / wrap / rewrite), difficulty.

| component | React deps | Svelte path | difficulty |
|---|---|---|---|
| csv-tsv-viewer | glide-data-grid, papaparse | papaparse + Svelte virtual table | medium |
| file-upload | border-beam | native file input + CSS effect | low |
| file-thumbnail | depends on PDF render | PDF.js page render | low-medium |
| document-viewer-sidebar | none captured | rewrite | low |
| group, color-picker, toggle | shadcn primitives | shadcn-svelte equivalents | low |
| e-signature | pdf-lib, signature_pad | both framework-free, wrap | medium |
| pdf-viewer | @embedpdf/*, pdf-lib | PDF.js wrapper | high |
| pdf-editor | not captured | check upstream source | high |
| docx-viewer | @extend-ai/react-docx | docx-preview wrapper | high |
| docx-editor | base-ui, react-docx | rewrite | very high |
| xlsx-viewer | @extend-ai/react-xlsx | SheetJS + custom table | high |
| xlsx-editor | xlsx-viewer, primitives | rewrite on the viewer | very high |
| pptx-viewer | @extend-ai/react-pptx, tanstack virtual | pptxviewjs or pptx-browser wrapper | high |
| file-system | @pierre/trees, hugeicons | rewrite or wrap if vanilla API | medium |
| document-splits | dnd-kit | Svelte DnD | medium |
| schema-builder | dnd-kit, @pierre/diffs | rewrite | high |
| layout-blocks | tanstack virtual, react-markdown | rewrite with unified/remark | medium |
| bounding-box-citations | not captured | overlay on PDF viewer | medium |

Cross-cutting: replace `@hugeicons/react` with a Svelte icon set or the SVG assets. Port the registry, not just the components.

Installed Svelte-side versions (from `package.json`, phase 5/7): `svelte@^5.57.1`, `@sveltejs/kit@^3.0.0`, `pdfjs-dist@^6.4.299`, `docx-preview@^0.4.1` + `jszip@^3.10.2`, `xlsx@^0.18.5`, `pptx-browser@^4.1.5` (picked over `pptxviewjs`, see `src/lib/engines/pptx/DECISION.md`), `papaparse@^5.7.0`, `pdf-lib@^1.17.1`, `signature_pad@^5.1.4`, `marked@^18.1.0`. Test toolchain: `vitest@^4.1.8`, `@testing-library/svelte@^5.4.2`, `@playwright/test@^1.60.0`, `publint@^0.3.21`. No Tailwind: components use scoped CSS. No DnD library: native HTML5 drag-and-drop.

## 3. Foundation

- Add the shared primitives first: group, toggle, color-picker. Everything else depends on them.
- Add the dark-mode contract (`isDark`, `onIsDarkChange`) as a shared type.
- Add a shared virtual list helper.
- Tests: each primitive has unit tests for props, events, and the dark-mode contract.

## 4. Simple components

Port in this order. Each is done when its tests pass and it renders on the docs site.

1. `file-upload`: drop zone and file input.
2. `csv-tsv-viewer`: parse with papaparse, render with the virtual table, add search.
3. `document-viewer-sidebar`: layout only.
4. `file-thumbnail`: depends on the PDF engine wrapper from step 5, so port it after step 5.

## 5. Engine wrappers

One wrapper per engine. Each wrapper loads its library on the client only and exposes a small API.

1. PDF: wrap PDF.js. Set the worker URL explicitly. Expose page count, render page, and page change events. Check `svelte-pdf-view` before writing from scratch.
2. DOCX: wrap docx-preview (needs jszip). Expose render and a thumbnail sidebar flag.
3. XLSX: wrap SheetJS. Convert sheets to rows with `sheet_to_json` for the viewer.
4. PPTX: evaluate `pptxviewjs` and `pptx-browser` on the fixture decks. Pick one and record why.

Tests: each wrapper has a Playwright test that renders a fixture file and checks the page count, sheet count, or slide count.

## 6. Viewers

1. `pdf-viewer`: toolbar, zoom, rotate, page overlay, download, active page event.
2. `docx-viewer`: preview with thumbnail sidebar and dark mode.
3. `xlsx-viewer`: sheet tabs, virtual rows, dark mode.
4. `pptx-viewer`: slide list with virtual rendering.
5. `pdf-thumbnail` reuse: wire `file-thumbnail` to the PDF wrapper.

## 7. Editors and complex components

1. `pdf-editor`: confirm the upstream structure first, then port.
2. `docx-editor`: rewrite. Scope the features against the upstream docs before starting.
3. `xlsx-editor`: built on the XLSX viewer. Formulas, cell styling, export.
4. `file-system`, `document-splits`, `schema-builder`, `layout-blocks`, `bounding-box-citations`: port after the viewers they depend on.
5. `e-signature`: pdf-lib for placing the signature, signature_pad for drawing.

## 8. Registry and packaging

- Build the registry JSON for each component so `npx shadcn-svelte add <url>` works.
- Build the npm package with `svelte-package` for the viewers and editors.
- Check licenses of every dependency before publishing.
- Add the MIT attribution to the package and README.

## 9. Verification

- Run the full unit and Playwright suites. Record the output.
- Run the docs site and check each component page in light and dark mode.
- Check the package with `publint` and a clean install into a fresh SvelteKit app.
- Compare behavior with the React version on the same fixtures.

## 10. Release

- Tag a version, publish the npm package, and publish the registry.
- Write a migration note for teams porting from the React version.

## Open decisions

- Copy-in registry, npm package, or both for each component.
- Exact prop parity with React, or a Svelte-first API for bindable values and snippets.
- Which PPTX engine to use, decided in step 5.
- Tailwind version, confirmed against upstream.
