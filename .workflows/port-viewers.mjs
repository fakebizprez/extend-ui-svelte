export default async function workflow(host) {
  const schema = {
    type: "object",
    required: ["complete", "evidence", "unresolved"],
    properties: {
      complete: { type: "boolean" },
      evidence: { type: "array", items: { type: "string" } },
      unresolved: { type: "array", items: { type: "string" } },
    },
  };
  const ROOT = "/Users/fakebizprez/Developer/projects/extend-ui-svelte";
  host.log("Wave: viewers in parallel");

  const noInstall = "DO NOT edit package.json, pnpm-lock.yaml, vite.config.ts, or run pnpm install. Only add source files and run tests. Use #lib subpath imports, never $lib. ";
  const tdd = "Test-driven: write each test file FIRST, watch it fail, implement, then make it pass. Run only your own test files (npx vitest run with explicit paths; npx playwright test with your spec file only). ";
  const ret = "Return schema complete/evidence/unresolved: evidence lists test files plus results; unresolved lists gaps.";
  const common = "Svelte 5 runes. Reuse the engine wrapper under src/lib/engines/<name>/ and the shared virtual list plus dark-mode contract. Browser-only code loads on the client via dynamic import() inside onMount or a browser guard. Virtualize large content (pages, rows, slides) — never render all at once. MIT header crediting extend-hq/ui on each new source file. Match upstream React prop names; dark-mode contract (isDark + onIsDarkChange) controlled by the parent. ";

  const wave = await host.parallel([
    {
      label: "pdf-viewer",
      schema,
      input:
        "You are porting the pdf-viewer component for the Svelte 5 library at " + ROOT + ". " + noInstall + common +
        "Port docs/conversion-steps.md phase 6 item 1: src/lib/components/pdf-viewer/ (PdfViewer.svelte + index.ts + PdfViewer.test.ts + PdfViewer.svelte.test.ts as the repo conventions require). " +
        "Features: toolbar, zoom, rotate, page overlay, download, active page event. Reuse src/lib/engines/pdf. " +
        "Wire the docs preview page at src/routes/pdf-viewer to render it with the tests/fixtures/sample.pdf fixture. " +
        "Add Playwright spec tests/pdf-viewer.e2e.ts asserting the viewer renders the fixture page count and zoom changes state. " + tdd + ret,
    },
    {
      label: "docx-viewer",
      schema,
      input:
        "You are porting the docx-viewer component for the Svelte 5 library at " + ROOT + ". " + noInstall + common +
        "Port docs/conversion-steps.md phase 6 item 2: src/lib/components/docx-viewer/ (DocxViewer.svelte + index.ts + tests). " +
        "Features: preview with thumbnail sidebar and dark mode. Reuse src/lib/engines/docx. " +
        "Wire the docs preview page at src/routes/docx-viewer to render it with tests/fixtures/sample.docx. " +
        "Add Playwright spec tests/docx-viewer.e2e.ts asserting fixture text renders. " + tdd + ret,
    },
    {
      label: "xlsx-viewer",
      schema,
      input:
        "You are porting the xlsx-viewer component for the Svelte 5 library at " + ROOT + ". " + noInstall + common +
        "Port docs/conversion-steps.md phase 6 item 3: src/lib/components/xlsx-viewer/ (XlsxViewer.svelte + index.ts + tests). " +
        "Features: sheet tabs, virtual rows, dark mode. Reuse src/lib/engines/xlsx. " +
        "Wire the docs preview page at src/routes/xlsx-viewer to render it with tests/fixtures/sample.xlsx. " +
        "Add Playwright spec tests/xlsx-viewer.e2e.ts asserting sheet tabs and cell values render. " + tdd + ret,
    },
    {
      label: "pptx-viewer",
      schema,
      input:
        "You are porting the pptx-viewer component for the Svelte 5 library at " + ROOT + ". " + noInstall + common +
        "Port docs/conversion-steps.md phase 6 item 4: src/lib/components/pptx-viewer/ (PptxViewer.svelte + index.ts + tests). " +
        "Features: slide list with virtual rendering. Reuse src/lib/engines/pptx (pptx-browser). " +
        "Wire the docs preview page at src/routes/pptx-viewer to render it with tests/fixtures/sample.pptx. " +
        "Add Playwright spec tests/pptx-viewer.e2e.ts asserting the slide count renders. " + tdd + ret,
    },
    {
      label: "file-thumbnail",
      schema,
      input:
        "You are porting the file-thumbnail component for the Svelte 5 library at " + ROOT + ". " + noInstall + common +
        "Port docs/conversion-steps.md phase 6 item 5 (and phase 4 item 4): src/lib/components/file-thumbnail/ (FileThumbnail.svelte + index.ts + tests). " +
        "Wire it to the PDF engine wrapper in src/lib/engines/pdf to render a page thumbnail on a canvas; accept a file/URL plus page number and size props. " +
        "Wire the docs preview page at src/routes/file-thumbnail to render it with tests/fixtures/sample.pdf. " +
        "Add Playwright spec tests/file-thumbnail.e2e.ts asserting a thumbnail canvas renders. " + tdd + ret,
    },
  ]);

  host.log("Verify: full suite plus synthesis");
  const verify = await host.agent({
    label: "verify-viewers",
    schema,
    input:
      "You are verifying the Svelte 5 library at " + ROOT + " after parallel viewer work. " +
      "DO NOT write source files; you may only run commands and read files. " +
      "1. Run pnpm build, the full unit suite (npx vitest run), and the full Playwright suite (npx playwright test); record exact pass/fail counts and failures. " +
      "2. Check each viewer (pdf-viewer, docx-viewer, xlsx-viewer, pptx-viewer, file-thumbnail under src/lib/components/) has: .svelte implementation with MIT header, tests, dark-mode contract (isDark + onIsDarkChange), docs preview page rendering the fixture, e2e spec. " +
      "3. Compare briefly against conversion-steps.md phase 6 to state done vs outstanding (do not implement). " +
      "Return schema complete/evidence/unresolved: complete is true only if build AND both suites are green; " +
      "evidence holds build/suite outputs plus the per-viewer checklist; unresolved holds every failure or gap.",
  });

  const allRefs = [];
  for (const r of wave) allRefs.push(r ? r.ref : null);
  allRefs.push(verify ? verify.ref : null);
  const gaps = [];
  const workers = wave.concat([verify]);
  for (const r of workers) {
    if (r === null || r.error_kind) {
      gaps.push("worker error or missing result");
    } else if (r.data && Array.isArray(r.data.unresolved)) {
      for (const u of r.data.unresolved) {
        if (u) gaps.push(u);
      }
    }
  }
  const verifyOk = verify !== null && !verify.error_kind && verify.data && verify.data.complete === true;
  return {
    status: verifyOk && gaps.length === 0 ? "complete" : "partial",
    refs: allRefs,
    summary: "Viewers (PDF, DOCX, XLSX, PPTX) plus file-thumbnail with fixtures and e2e verification.",
    unresolved: gaps,
  };
}
