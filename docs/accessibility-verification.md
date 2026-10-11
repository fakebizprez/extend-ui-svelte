# Accessibility verification

Verified on 2026-10-11 against `http://localhost:5174` using agent-browser and Chromium with axe-core 4.12.1. Audits include WCAG 2 A/AA, 2.1 AA, and 2.2 AA rule tags.

| Coverage | Widths | Themes | Scans | Automated violations |
| --- | --- | --- | --- | --- |
| Home and mobile navigation | 1440, 390, 320px | Light and dark | 10 | 0 |
| Nine viewers and editors | 1440, 390px | Light and dark | 36 | 0 |
| Eleven file, data, sidebar, and primitive demos | 1280, 375px | Light and dark | 44 | 0 |

The component matrix covers all 20 primary demo routes. The shell scans include the open mobile menu. Evidence is saved in `/tmp/shell-a11y-summary.json`, `/tmp/shell-keyboard.json`, `/tmp/viewers-a11y-final/`, and `/tmp/controls-wcag-final.json`.

Confirmed keyboard skip navigation, mobile dialog containment and focus return, PDF/DOCX/PPTX/CSV scrolling, and spreadsheet navigation with one Tab stop. Confirmed site-theme changes and persistence across reload, mobile toolbar wrapping, and no horizontal page overflow. The home page passes text-spacing overrides at 320px; all eleven control demos also reflow without page overflow at 320px.

Fixes include meaningful page titles, hydration-ready menu/theme controls, focus restoration, focusable document/JSON scroll areas, readable zoom labels and layout/review metadata, and 24px document-split move targets.

Regression tests were observed failing before their fixes. Final unit suite: 1,049 tests passed. Full Playwright suite: 266 tests passed against the live docs server. Svelte check: zero errors and three existing ColorPicker initial-state warnings. Production build and package validation passed.

## Limits

Axe reports incomplete contrast checks in 41 component scenarios: symbolic glyphs, overlapping native controls, partially obscured fields, and unsupported OKLCH color evaluation. Mobile picker screenshots and viewport focus/spacing were inspected; incomplete checks are not counted as passes or violations.

This is a browser audit, not a full WCAG conformance certification. Screen-reader workflows, Firefox/Safari, every interactive state, fixture-only nested routes, and the accessibility of uploaded document content were not comprehensively assessed. Document viewing engines and their rendered content need separate assessment.
