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
  host.log("Registry build, then final verification");

  const registry = await host.agent({
    label: "registry",
    schema,
    input:
      "You are finishing packaging for the Svelte 5 library at " + ROOT + ". " +
      "DO NOT edit package.json dependencies or versions, pnpm-lock.yaml, vite.config.ts, and do not run pnpm install. " +
      "You may edit registry.json, README.md, docs, and add test files. Use #lib imports if you add source. " +
      "Phase 8 tasks from docs/conversion-steps.md: " +
      "1. Fix and complete registry.json so every component (all dirs under src/lib/components plus shared deps dark-mode, virtual-list, engines) lists its REAL file paths (verify each path exists; the skeleton guesses names like file-upload.svelte which may not match) with correct registryDependencies and dependencies (npm packages each component needs, matching installed package.json versions). " +
      "2. Add a unit test (src/lib/registry.test.ts exists — extend it) asserting every registry file path exists on disk and every listed dependency is in package.json. Test-driven: extend the test first, watch it fail, fix registry.json, make it pass. Run npx vitest run on that file only. " +
      "3. Check licenses of every runtime dependency (pnpm licenses list or package.json license fields) and record any non-MIT/Apache/BSD/ISC findings in your evidence. " +
      "4. Write docs/migration-react-to-svelte.md: migration note for teams porting from the React version (prop parity, isDark/onIsDarkChange contract, bindable values, snippets vs render props, registry install command). " +
      "Return schema complete/evidence/unresolved: evidence lists the registry test result, license findings, and files changed; unresolved lists gaps.",
  });

  const verify = await host.agent({
    label: "final-verify",
    schema,
    input:
      "You are running final verification (phase 9) for the Svelte 5 library at " + ROOT + ". " +
      "DO NOT write source files; you may only run commands and read files. " +
      "1. Run pnpm build, npx vitest run, and npx playwright test; record exact pass/fail counts. " +
      "2. Run publint (part of prepack) and confirm clean. " +
      "3. Clean-install check: pnpm pack, scaffold a minimal fresh SvelteKit app in /tmp (or plain node import test of the packed tarball against svelte), install the tarball, and confirm the package imports resolve. Record what you did and the result. " +
      "4. Spot-check the docs site in light and dark mode: start the preview server, visit at least 3 component pages with Playwright or curl, confirm they render. " +
      "5. Confirm every conversion-steps.md phase 1-8 deliverable exists: 20 component dirs with tests, 4 engine wrappers with fixtures, docs pages, registry.json, LICENSE attribution, migration note. " +
      "Return schema complete/evidence/unresolved: complete is true only if build, both suites, and publint are green; " +
      "evidence holds all outputs; unresolved holds every failure or gap. Do NOT publish or tag anything.",
  });

  const refs = [registry ? registry.ref : null, verify ? verify.ref : null];
  const gaps = [];
  for (const r of [registry, verify]) {
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
    refs,
    summary: "Registry completion plus final phase-9 verification.",
    unresolved: gaps,
  };
}
