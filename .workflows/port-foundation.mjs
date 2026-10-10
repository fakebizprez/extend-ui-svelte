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
  host.log("Wave 1: project setup plus upstream inventory in parallel");

  const setupInput = [
    "You are setting up a new Svelte 5 component library in the existing repo at " + ROOT + ".",
    "The repo currently holds only AGENTS.md, CLAUDE.md, docs/, and .git. PRESERVE all of them.",
    "Phase 1 tasks from docs/conversion-steps.md:",
    "1. Scaffold a SvelteKit project with Svelte 5, TypeScript, and pnpm WITHOUT wiping the repo:",
    "scaffold into /tmp/svelte-scaffold first, then copy needed files into the repo.",
    "Never delete docs/, AGENTS.md, CLAUDE.md, or .git.",
    "2. Library package: src/lib with svelte-package, package.json exports map with types",
    "and svelte conditions, publint configured.",
    "3. Install and configure: vitest, @testing-library/svelte, @testing-library/jest-dom,",
    "playwright, jsdom. The pnpm test script must run vitest; pnpm build must build the library.",
    "4. Pre-install engine deps so later workers only add source files",
    "(nobody else may edit package.json): papaparse, pdfjs-dist, docx-preview, jszip,",
    "xlsx, pdf-lib, signature_pad.",
    "5. Docs site skeleton: SvelteKit routes with one placeholder preview page per component:",
    "file-upload, csv-tsv-viewer, document-viewer-sidebar, file-thumbnail, pdf-viewer,",
    "docx-viewer, xlsx-viewer, pptx-viewer, pdf-editor, docx-editor, xlsx-editor, file-system,",
    "document-splits, schema-builder, layout-blocks, bounding-box-citations, e-signature,",
    "group, color-picker, toggle.",
    "6. A shadcn-svelte style registry.json skeleton listing those components.",
    "7. MIT LICENSE crediting extend-hq/ui as upstream.",
    "8. Use current docs (web search for Svelte 5 / SvelteKit / svelte-package setup) before writing config.",
    "Acceptance gate: pnpm install plus pnpm test plus pnpm build all passing in the repo.",
    "Iterate until green. Svelte 5 runes only. Do NOT edit docs/conversion-steps.md.",
    "Do NOT commit. Write new files only under your scope.",
    "Return schema complete/evidence/unresolved: evidence lists commands plus results plus files;",
    "unresolved lists anything not green.",
  ].join(" ");

  const upstreamInput = [
    "You are analyzing the upstream React library for a Svelte port.",
    "READ-ONLY on the repo at " + ROOT + ": inspect docs/conversion-steps.md and AGENTS.md,",
    "but DO NOT write any file inside the repo.",
    "Phase 0 tasks from docs/conversion-steps.md:",
    "1. Clone https://github.com/extend-hq/ui into /tmp/extend-ui-upstream (shallow clone is fine).",
    "Never clone into the repo.",
    "2. Read apps/v4/components (or equivalent) plus every package.json for EXACT dependency",
    "versions of each of the 18 components: csv-tsv-viewer, file-upload, file-thumbnail,",
    "document-viewer-sidebar, group, color-picker, toggle, e-signature, pdf-viewer, pdf-editor,",
    "docx-viewer, docx-editor, xlsx-viewer, xlsx-editor, pptx-viewer, file-system,",
    "document-splits, schema-builder, layout-blocks, bounding-box-citations.",
    "3. Close the inventory gaps: pdf-editor deps, docx-editor deps, bounding-box-citations deps,",
    "document-viewer-sidebar deps, Tailwind version, PPTX engine candidates",
    "(pptxviewjs vs pptx-browser), and confirm which React deps are framework-free vs React-only.",
    "4. Record each component public props (especially the dark-mode contract",
    "isDark/onIsDarkChange) so porting agents can match the contract.",
    "Return schema complete/evidence/unresolved: evidence holds one string per component with",
    "name, exact deps and versions, public props, and port notes, plus the Tailwind version",
    "and PPTX recommendation; unresolved holds anything you could not determine.",
  ].join(" ");

  const wave1 = await host.parallel([
    { label: "project-setup", schema, input: setupInput },
    { label: "upstream-inventory", schema, input: upstreamInput },
  ]);

  const setup = wave1[0];
  const setupOk = setup !== null && !setup.error_kind && setup.data && setup.data.complete === true;
  if (!setupOk) {
    return {
      status: "partial",
      refs: wave1.map((r) => (r ? r.ref : null)),
      summary: "Wave 1 setup did not complete; phase 2 porting work is blocked on a green scaffold.",
      unresolved: ["project-setup incomplete; rerun setup before foundation work"],
    };
  }

  host.log("Wave 2: foundation plus simple components in parallel");

  const noInstall = "Setup is complete and green; DO NOT edit package.json, config files, or run pnpm install. Only add source files and run tests. ";
  const tdd = "Test-driven with Vitest plus Svelte Testing Library: write each test file FIRST, watch it fail, implement, then make it pass. Run only your own test files with npx vitest run and explicit file paths. ";
  const ret = "Return schema complete/evidence/unresolved: evidence lists test files plus results; unresolved lists gaps.";

  const wave2 = await host.parallel([
    {
      label: "primitives",
      schema,
      input:
        "You are porting shared primitives for the Svelte 5 library at " + ROOT + ". " + noInstall +
        "Port docs/conversion-steps.md phase 3: group, color-picker, toggle as Svelte 5 runes components " +
        "under src/lib/components/ (one folder each: Component.svelte + index.ts + Component.test.ts). " +
        "Match upstream React prop names; keep the dark-mode contract (isDark + onIsDarkChange) controlled by the parent; " +
        "add the MIT header crediting extend-hq/ui to each file. " + tdd +
        "Cover props, events, and the dark-mode contract. Finish with your tests green. " + ret,
    },
    {
      label: "shared-foundation",
      schema,
      input:
        "You are building shared foundation modules for the Svelte 5 library at " + ROOT + ". " + noInstall +
        "Build docs/conversion-steps.md phase 3: (1) src/lib/dark-mode.ts with the shared dark-mode contract " +
        "types (isDark, onIsDarkChange) used by all components; (2) src/lib/virtual-list/ with a shared virtual " +
        "list helper (VirtualList.svelte + logic + VirtualList.test.ts) for pages, sheet rows, and slide lists " +
        "so large content never renders all at once. Svelte 5 runes, MIT header crediting extend-hq/ui. " + tdd +
        "Cover contract type behavior, virtualization windowing with large lists, and edge cases: " +
        "empty list, single item, scroll to end. " + ret,
    },
    {
      label: "file-upload",
      schema,
      input:
        "You are porting the file-upload component for the Svelte 5 library at " + ROOT + ". " + noInstall +
        "Port docs/conversion-steps.md phase 4 item 1: src/lib/components/file-upload/ " +
        "(FileUpload.svelte + index.ts + FileUpload.test.ts): drop zone and file input, native file input " +
        "plus CSS effect (upstream used border-beam), dark-mode contract (isDark + onIsDarkChange), " +
        "MIT header crediting extend-hq/ui. Also wire the docs preview page for file-upload to render it. " + tdd +
        "Cover file select, drop, multiple files, accept filter, events, dark-mode contract. " + ret,
    },
    {
      label: "sidebar",
      schema,
      input:
        "You are porting the document-viewer-sidebar component for the Svelte 5 library at " + ROOT + ". " + noInstall +
        "Port docs/conversion-steps.md phase 4 item 3: src/lib/components/document-viewer-sidebar/ " +
        "(DocumentViewerSidebar.svelte + index.ts + DocumentViewerSidebar.test.ts): layout only per the inventory, " +
        "dark-mode contract (isDark + onIsDarkChange), MIT header crediting extend-hq/ui. " +
        "Also wire the docs preview page for document-viewer-sidebar to render it. " + tdd +
        "Cover sections render, active item event, collapsed state, dark-mode contract. " + ret,
    },
    {
      label: "csv-viewer",
      schema,
      input:
        "You are porting the csv-tsv-viewer component for the Svelte 5 library at " + ROOT + ". " + noInstall +
        "papaparse is already installed; import it directly. Prefer the shared virtual list at " +
        "src/lib/virtual-list if it exists, else implement local windowing and note it. " +
        "Port docs/conversion-steps.md phase 4 item 2: src/lib/components/csv-tsv-viewer/ " +
        "(CsvTsvViewer.svelte + index.ts + CsvTsvViewer.test.ts): parse with papaparse, render with a virtual " +
        "table, add search, dark-mode contract (isDark + onIsDarkChange), MIT header crediting extend-hq/ui. " +
        "Browser-only parsing must load on the client. Also wire the docs preview page for csv-tsv-viewer " +
        "to render it with sample data. " + tdd +
        "Cover CSV and TSV parsing, search filter, virtualization with many rows, empty input, dark-mode contract. " + ret,
    },
  ]);

  host.log("Verify: full suite plus synthesis");
  const verify = await host.agent({
    label: "verify",
    schema,
    input:
      "You are verifying the Svelte 5 library at " + ROOT + " after parallel porting work. " +
      "DO NOT write source files; you may only run commands and read files. " +
      "1. Run the full unit suite (pnpm test or npx vitest run) and pnpm build in the repo; " +
      "record exact pass/fail counts and any failures. " +
      "2. Check each touched component (group, color-picker, toggle, dark-mode, virtual-list, file-upload, " +
      "document-viewer-sidebar, csv-tsv-viewer) has: .svelte implementation, .test.ts, MIT header " +
      "crediting extend-hq/ui, dark-mode contract (isDark + onIsDarkChange). " +
      "3. Confirm docs preview pages exist for the ported components. " +
      "4. Compare briefly against conversion-steps.md phases 1-4 to state what is done vs outstanding " +
      "(do not start new implementation). " +
      "Return schema complete/evidence/unresolved: complete is true only if the full suite AND build are green; " +
      "evidence holds suite and build outputs plus the per-component checklist; unresolved holds every failure or gap.",
  });

  const allRefs = [];
  for (const r of wave1) allRefs.push(r ? r.ref : null);
  for (const r of wave2) allRefs.push(r ? r.ref : null);
  allRefs.push(verify ? verify.ref : null);
  const gaps = [];
  const workers = wave2.concat([verify]);
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
    summary: "Setup + upstream inventory + foundation/simple-component ports with full-suite verification.",
    unresolved: gaps,
  };
}
