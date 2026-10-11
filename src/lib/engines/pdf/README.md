<!-- MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT). -->
# PDF engine wrapper

Framework-free wrapper around PDF.js (`pdfjs-dist`) for phase 5 of
`docs/conversion-steps.md`. The phase 6 `pdf-viewer` builds on this engine.

## API

- `createPdfEngine()` returns a `PdfEngine`:
  - `load(source)` — load from a URL string, `URL`, `ArrayBuffer`, or `Uint8Array`; resolves with the page count.
    Last call wins: a load superseded by a newer `load()` or `destroy()` destroys its own task,
    leaves the engine unchanged, and rejects with an error for which `isPdfLoadSuperseded(error)` is true.
  - `getPageSizes()` — every page's size at scale 1, including the page's own rotation.
  - `pageCount` / `currentPage` — numbers (0 when unloaded).
  - `renderPage(pageNumber, canvas, { scale, rotation })` — render a 1-based page to canvas; resolves with the page size.
  - `setCurrentPage(page)` — clamped navigation; fires page-change listeners.
  - `onPageChange(handler)` — subscribe; returns an unsubscribe function.
  - `destroy()` — release the document and reset.
- `setPdfWorkerSrc(url)` — override the worker URL. The default is the worker
  bundled with the installed `pdfjs-dist` (imported via `?url`), so the worker
  stays version-locked to the API by construction.

PDF.js itself is loaded lazily with dynamic `import()` on first use, and the
worker URL is always assigned before `getDocument`, so this module is safe to
import during SSR.

## Why not `svelte-pdf-view`?

Checked on npm before writing this wrapper (`svelte-pdf-view@0.3.3`,
published 2025-12-30). It does not fit:

1. It is a full viewer UI component, not a small engine API. Phase 5 needs
   load/page-count/render/page-change primitives that the phase 6 `pdf-viewer`
   (toolbar, zoom, rotate, overlay) builds on; wrapping a prebuilt viewer
   would bypass that layering.
2. Its peer dependency is `pdfjs-dist@^5.0.0`, which conflicts with the
   installed `pdfjs-dist@6.4.299`.
3. `AGENTS.md` mandates reusing the framework-free engines directly.
4. It is a 0.x single-maintainer package, immature for a library dependency.

So the wrapper below uses PDF.js directly.
