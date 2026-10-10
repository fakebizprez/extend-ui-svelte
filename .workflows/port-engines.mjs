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
  host.log("Wave: engine wrappers in parallel");

  const noInstall = "DO NOT edit package.json, pnpm-lock.yaml, vite.config.ts, or run pnpm install. Only add source files and run tests. Use #lib subpath imports, never $lib. ";
  const tdd = "Test-driven: write each test file FIRST, watch it fail, implement, then make it pass. Run only your own test files (npx vitest run with explicit paths; npx playwright test with your spec file only). ";
  const ret = "Return schema complete/evidence/unresolved: evidence lists test files plus results; unresolved lists gaps.";
  const common = "Svelte 5 runes. Browser-only engine code must load on the client via dynamic import() inside onMount or a browser guard. MIT header crediting extend-hq/ui on each new source file. ";

  const wave = await host.parallel([
    {
      label: "pdf-engine",
      schema,
      input:
        "You are building the PDF engine wrapper for the Svelte 5 library at " + ROOT + ". " + noInstall + common +
        "Build docs/conversion-steps.md phase 5 item 1: src/lib/engines/pdf/ wrapping PDF.js (pdfjs-dist, already installed). " +
        "Set the worker URL explicitly. Expose a small API: load document from URL/bytes, page count, render page to canvas, page change events. " +
        "Check svelte-pdf-view on npm/web first; if it fits, wrap it and record why, else write the wrapper directly and record why. " +
        "Fixtures and tests: generate a small multi-page PDF fixture with pdf-lib into tests/fixtures/sample.pdf via a script you keep (tests/fixtures/generate-pdf.mjs). " +
        "Add a unit test for the wrapper API shape plus a Playwright spec tests/pdf-engine.e2e.ts that renders the fixture through a test harness page " +
        "(add src/routes/engines/pdf/+page.svelte harness rendering the fixture with page count) and asserts the page count. " + tdd + ret,
    },
    {
      label: "docx-engine",
      schema,
      input:
        "You are building the DOCX engine wrapper for the Svelte 5 library at " + ROOT + ". " + noInstall + common +
        "Build docs/conversion-steps.md phase 5 item 2: src/lib/engines/docx/ wrapping docx-preview (needs jszip; both already installed). " +
        "Expose a small API: render docx bytes/URL into a container element, plus a thumbnail sidebar flag. " +
        "Fixtures and tests: craft a minimal valid .docx fixture with jszip into tests/fixtures/sample.docx via a script you keep (tests/fixtures/generate-docx.mjs). " +
        "Add a unit test for the wrapper API shape plus a Playwright spec tests/docx-engine.e2e.ts that renders the fixture through a test harness page " +
        "(add src/routes/engines/docx/+page.svelte harness) and asserts expected text appears. " + tdd + ret,
    },
    {
      label: "xlsx-engine",
      schema,
      input:
        "You are building the XLSX engine wrapper for the Svelte 5 library at " + ROOT + ". " + noInstall + common +
        "Build docs/conversion-steps.md phase 5 item 3: src/lib/engines/xlsx/ wrapping SheetJS (xlsx package, already installed). " +
        "Expose a small API: load workbook from URL/bytes, list sheet names, convert a sheet to rows with sheet_to_json for the viewer. " +
        "Fixtures and tests: generate a multi-sheet .xlsx fixture with the xlsx package into tests/fixtures/sample.xlsx via a script you keep (tests/fixtures/generate-xlsx.mjs). " +
        "Add a unit test for sheet-to-rows conversion plus a Playwright spec tests/xlsx-engine.e2e.ts that loads the fixture through a test harness page " +
        "(add src/routes/engines/xlsx/+page.svelte harness showing sheet names and row counts) and asserts sheet count and row counts. " + tdd + ret,
    },
    {
      label: "pptx-engine",
      schema,
      input:
        "You are building the PPTX engine wrapper for the Svelte 5 library at " + ROOT + ". " + noInstall + common +
        "Build docs/conversion-steps.md phase 5 item 4: evaluate pptxviewjs and pptx-browser (both already installed) on a fixture deck. " +
        "Craft a minimal 2-slide .pptx fixture with jszip into tests/fixtures/sample.pptx via a script you keep (tests/fixtures/generate-pptx.mjs). " +
        "Pick ONE engine, record WHY in src/lib/engines/pptx/DECISION.md, and wrap it in src/lib/engines/pptx/ with a small API: load deck, slide count, render slide. " +
        "Add a unit test for the wrapper API shape plus a Playwright spec tests/pptx-engine.e2e.ts through a test harness page " +
        "(add src/routes/engines/pptx/+page.svelte harness) asserting the slide count. Do NOT remove the losing dependency (parent handles that). " + tdd + ret,
    },
  ]);

  host.log("Verify: full suite plus synthesis");
  const verify = await host.agent({
    label: "verify-engines",
    schema,
    input:
      "You are verifying the Svelte 5 library at " + ROOT + " after parallel engine work. " +
      "DO NOT write source files; you may only run commands and read files. " +
      "1. Run the full unit suite (npx vitest run) and the full Playwright suite (npx playwright test); record exact pass/fail counts and failures. " +
      "2. Check each engine (pdf, docx, xlsx, pptx under src/lib/engines/) has: wrapper source with MIT header, fixture generator plus fixture binary, unit test, e2e spec, harness page. " +
      "3. Confirm the PPTX DECISION.md exists and names the picked engine with reasons. " +
      "4. Compare briefly against conversion-steps.md phase 5 to state done vs outstanding (do not implement). " +
      "Return schema complete/evidence/unresolved: complete is true only if BOTH suites are green; " +
      "evidence holds suite outputs plus the per-engine checklist; unresolved holds every failure or gap.",
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
    summary: "Engine wrappers (PDF, DOCX, XLSX, PPTX) with fixtures and e2e verification.",
    unresolved: gaps,
  };
}
