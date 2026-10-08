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
  host.log("Wave: complex components in parallel");

  const noInstall = "DO NOT edit package.json, pnpm-lock.yaml, vite.config.ts, or run pnpm install. Only add source files and run tests. Use #lib subpath imports, never $lib. Use only already-installed dependencies plus native browser APIs (native HTML5 drag-and-drop, no DnD library; marked is available for markdown). ";
  const tdd = "Test-driven: write each test file FIRST, watch it fail, implement, then make it pass. Run only your own test files (npx vitest run with explicit paths; npx playwright test with your spec file only). ";
  const ret = "Return schema complete/evidence/unresolved: evidence lists test files plus results; unresolved lists gaps.";
  const common = "Svelte 5 runes. Reuse the viewers, engines, virtual list, primitives, and dark-mode contract where they fit. Browser-only code loads on the client via dynamic import() inside onMount or a browser guard. MIT header crediting extend-hq/ui on each new source file. Match upstream React prop names where known (check /tmp/extend-ui-upstream, cloning https://github.com/extend-hq/ui there shallowly if missing and useful; never into the repo); dark-mode contract (isDark + onIsDarkChange) controlled by the parent. ";

  const wave = await host.parallel([
    {
      label: "file-system",
      schema,
      input:
        "You are porting the file-system component for the Svelte 5 library at " + ROOT + ". " + noInstall + common +
        "Port docs/conversion-steps.md phase 7 item 4 (file-system): src/lib/components/file-system/ (FileSystem.svelte + index.ts + tests). " +
        "Features: file/folder tree browser with expand/collapse, selection events, keyboard navigation, inline rename; use SVG icons (no hugeicons dependency). " +
        "Wire the docs preview page at src/routes/file-system with sample tree data. " +
        "Add Playwright spec tests/file-system.e2e.ts asserting expand, select, and rename. " + tdd + ret,
    },
    {
      label: "document-splits",
      schema,
      input:
        "You are porting the document-splits component for the Svelte 5 library at " + ROOT + ". " + noInstall + common +
        "Port docs/conversion-steps.md phase 7 item 4 (document-splits): src/lib/components/document-splits/ (DocumentSplits.svelte + index.ts + tests). " +
        "Features: split a document page range into named sections with native HTML5 drag-and-drop reorder, split/move/remove operations, change events. " +
        "Wire the docs preview page at src/routes/document-splits with the sample PDF page count. " +
        "Add Playwright spec tests/document-splits.e2e.ts asserting split creation and reorder via the component controls. " + tdd + ret,
    },
    {
      label: "schema-builder",
      schema,
      input:
        "You are porting the schema-builder component for the Svelte 5 library at " + ROOT + ". " + noInstall + common +
        "Port docs/conversion-steps.md phase 7 item 4 (schema-builder) as a REWRITE: src/lib/components/schema-builder/ (SchemaBuilder.svelte + index.ts + tests). " +
        "Features: visual JSON-schema field builder — add/remove/reorder fields with native drag-and-drop, field types (string, number, boolean, enum, object, array), required flags, live schema output event. " +
        "Wire the docs preview page at src/routes/schema-builder. " +
        "Add Playwright spec tests/schema-builder.e2e.ts asserting field add/edit/remove updates the emitted schema. " + tdd + ret,
    },
    {
      label: "layout-blocks",
      schema,
      input:
        "You are porting the layout-blocks component for the Svelte 5 library at " + ROOT + ". " + noInstall + common +
        "Port docs/conversion-steps.md phase 7 item 4 (layout-blocks): src/lib/components/layout-blocks/ (LayoutBlocks.svelte + index.ts + tests). " +
        "Features: render document layout blocks (headings, paragraphs, tables, figures) with virtualized scrolling for long documents and markdown rendering via marked for text blocks. " +
        "Wire the docs preview page at src/routes/layout-blocks with sample blocks. " +
        "Add Playwright spec tests/layout-blocks.e2e.ts asserting blocks render and windowing limits the DOM. " + tdd + ret,
    },
    {
      label: "bounding-box-citations",
      schema,
      input:
        "You are porting the bounding-box-citations component for the Svelte 5 library at " + ROOT + ". " + noInstall + common +
        "Port docs/conversion-steps.md phase 7 item 4 (bounding-box-citations): src/lib/components/bounding-box-citations/ (BoundingBoxCitations.svelte + index.ts + tests). " +
        "Features: overlay citation bounding boxes on the PDF viewer — box list synced with page canvas overlays, click-to-highlight both directions, active citation event. Reuse the pdf-viewer/pdf engine. " +
        "Wire the docs preview page at src/routes/bounding-box-citations with tests/fixtures/sample.pdf and sample boxes. " +
        "Add Playwright spec tests/bounding-box-citations.e2e.ts asserting overlays render and selection syncs. " + tdd + ret,
    },
  ]);

  host.log("Verify: full suite plus synthesis");
  const verify = await host.agent({
    label: "verify-complex",
    schema,
    input:
      "You are verifying the Svelte 5 library at " + ROOT + " after parallel complex-component work. " +
      "DO NOT write source files; you may only run commands and read files. " +
      "1. Run pnpm build, the full unit suite (npx vitest run), and the full Playwright suite (npx playwright test); record exact pass/fail counts and failures. " +
      "2. Check each component (file-system, document-splits, schema-builder, layout-blocks, bounding-box-citations under src/lib/components/) has: .svelte implementation with MIT header, tests, dark-mode contract (isDark + onIsDarkChange), docs preview page, e2e spec. " +
      "3. Compare briefly against conversion-steps.md phase 7 item 4 to state done vs outstanding (do not implement). " +
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
    summary: "Complex components (file-system, document-splits, schema-builder, layout-blocks, bounding-box-citations) with e2e verification.",
    unresolved: gaps,
  };
}
