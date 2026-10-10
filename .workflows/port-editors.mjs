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
  host.log("Wave: editors plus e-signature in parallel");

  const noInstall = "DO NOT edit package.json, pnpm-lock.yaml, vite.config.ts, or run pnpm install. Only add source files and run tests. Use #lib subpath imports, never $lib. Use only already-installed dependencies plus native browser APIs. ";
  const tdd = "Test-driven: write each test file FIRST, watch it fail, implement, then make it pass. Run only your own test files (npx vitest run with explicit paths; npx playwright test with your spec file only). ";
  const ret = "Return schema complete/evidence/unresolved: evidence lists test files plus results; unresolved lists gaps.";
  const common = "Svelte 5 runes. Reuse the engine wrappers, viewers, virtual list, and dark-mode contract where they fit. Browser-only code loads on the client via dynamic import() inside onMount or a browser guard. MIT header crediting extend-hq/ui on each new source file. Match upstream React prop names where known; dark-mode contract (isDark + onIsDarkChange) controlled by the parent. ";

  const wave = await host.parallel([
    {
      label: "pdf-editor",
      schema,
      input:
        "You are porting the pdf-editor component for the Svelte 5 library at " + ROOT + ". " + noInstall + common +
        "Port docs/conversion-steps.md phase 7 item 1. First confirm the upstream structure: read the upstream React pdf-editor source in /tmp/extend-ui-upstream if it exists (clone https://github.com/extend-hq/ui there shallowly if missing; never clone into the repo), else scope from conversion-steps.md and the local pdf-viewer. " +
        "Build src/lib/components/pdf-editor/ (PdfEditor.svelte + index.ts + tests): edit PDFs on top of the pdf-viewer/pdf engine — page rotate/delete/reorder plus pdf-lib export/download of the modified document. " +
        "Wire the docs preview page at src/routes/pdf-editor to edit tests/fixtures/sample.pdf. " +
        "Add Playwright spec tests/pdf-editor.e2e.ts asserting an edit operation changes state and export produces a download. " + tdd + ret,
    },
    {
      label: "docx-editor",
      schema,
      input:
        "You are porting the docx-editor component for the Svelte 5 library at " + ROOT + ". " + noInstall + common +
        "Port docs/conversion-steps.md phase 7 item 2 as a REWRITE: scope features against the upstream docs/source in /tmp/extend-ui-upstream (clone https://github.com/extend-hq/ui there shallowly if missing; never into the repo). " +
        "Build src/lib/components/docx-editor/ (DocxEditor.svelte + index.ts + tests): rich-text editing with native contenteditable (no new deps) — bold/italic/headings/lists, loading docx text via the docx engine, and export back to .docx bytes with jszip. " +
        "Wire the docs preview page at src/routes/docx-editor with tests/fixtures/sample.docx. " +
        "Add Playwright spec tests/docx-editor.e2e.ts asserting formatting applies and export produces a download. " + tdd + ret,
    },
    {
      label: "xlsx-editor",
      schema,
      input:
        "You are porting the xlsx-editor component for the Svelte 5 library at " + ROOT + ". " + noInstall + common +
        "Port docs/conversion-steps.md phase 7 item 3, built on the XLSX viewer/engine: src/lib/components/xlsx-editor/ (XlsxEditor.svelte + index.ts + tests). " +
        "Features: cell editing, basic formulas (SUM/AVERAGE/etc evaluated locally), cell styling (bold, alignment, fill), export to .xlsx via SheetJS. " +
        "Wire the docs preview page at src/routes/xlsx-editor with tests/fixtures/sample.xlsx. " +
        "Add Playwright spec tests/xlsx-editor.e2e.ts asserting a cell edit persists and export produces a download. " + tdd + ret,
    },
    {
      label: "e-signature",
      schema,
      input:
        "You are porting the e-signature component for the Svelte 5 library at " + ROOT + ". " + noInstall + common +
        "Port docs/conversion-steps.md phase 7 item 5: src/lib/components/e-signature/ (ESignature.svelte + index.ts + tests). " +
        "Use signature_pad (already installed) for drawing the signature and pdf-lib (already installed) for placing it onto a PDF at a chosen position/scale, with download of the signed PDF. " +
        "Wire the docs preview page at src/routes/e-signature with tests/fixtures/sample.pdf. " +
        "Add Playwright spec tests/e-signature.e2e.ts asserting drawing enables placement and export produces a download. " + tdd + ret,
    },
  ]);

  host.log("Verify: full suite plus synthesis");
  const verify = await host.agent({
    label: "verify-editors",
    schema,
    input:
      "You are verifying the Svelte 5 library at " + ROOT + " after parallel editor work. " +
      "DO NOT write source files; you may only run commands and read files. " +
      "1. Run pnpm build, the full unit suite (npx vitest run), and the full Playwright suite (npx playwright test); record exact pass/fail counts and failures. " +
      "2. Check each component (pdf-editor, docx-editor, xlsx-editor, e-signature under src/lib/components/) has: .svelte implementation with MIT header, tests, dark-mode contract (isDark + onIsDarkChange), docs preview page, e2e spec. " +
      "3. Compare briefly against conversion-steps.md phase 7 items 1-3 and 5 to state done vs outstanding (do not implement). " +
      "Return schema complete/evidence/unresolved: complete is true only if build AND both suites are green; " +
      "evidence holds build/suite outputs plus the per-component checklist; unresolved holds every failure or gap.",
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
    summary: "Editors (PDF, DOCX, XLSX) plus e-signature with e2e verification.",
    unresolved: gaps,
  };
}
