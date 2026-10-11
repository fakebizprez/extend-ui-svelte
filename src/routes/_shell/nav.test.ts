// Tests for the docs sidebar grouping and prev/next navigation.
// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).

import { describe, expect, it } from "vitest";
import { PREVIEW_COMPONENTS } from "../components";
import { NAV_GROUPS, NAV_ORDER, findComponent, groupOf, prevNext } from "./nav";

describe("nav", () => {
  it("puts every component in exactly one group", () => {
    for (const { slug } of PREVIEW_COMPONENTS) {
      const hits = NAV_GROUPS.filter((g) =>
        g.items.some((i) => i.slug === slug),
      );
      expect(hits, slug).toHaveLength(1);
    }
    expect(NAV_ORDER).toHaveLength(PREVIEW_COMPONENTS.length);
    expect(new Set(NAV_ORDER.map((c) => c.slug)).size).toBe(
      PREVIEW_COMPONENTS.length,
    );
  });

  it("flattens groups in sidebar order", () => {
    expect(NAV_GROUPS.map((g) => g.id)).toEqual([
      "files",
      "viewers",
      "editors",
      "data",
      "primitives",
    ]);
    expect(NAV_ORDER[0].slug).toBe("file-upload");
    expect(NAV_ORDER.at(-1)?.slug).toBe("toggle");
  });

  it("prevNext handles first, middle, and last", () => {
    expect(prevNext("file-upload")).toMatchObject({
      prev: null,
      next: { slug: "file-thumbnail" },
    });
    expect(prevNext("pdf-viewer")).toMatchObject({
      prev: { slug: "document-viewer-sidebar" },
      next: { slug: "docx-viewer" },
    });
    expect(prevNext("toggle")).toMatchObject({
      prev: { slug: "color-picker" },
      next: null,
    });
  });

  it("returns nulls for unknown slugs", () => {
    expect(prevNext("nope")).toEqual({ prev: null, next: null });
    expect(groupOf("nope")).toBeNull();
    expect(findComponent("nope")).toBeNull();
  });

  it("finds components and their groups", () => {
    expect(findComponent("pdf-editor")?.title).toBe("PDF Editor");
    expect(groupOf("pdf-editor")?.id).toBe("editors");
  });

  it("gives every component a description", () => {
    for (const c of PREVIEW_COMPONENTS) {
      expect(c.description.length, c.slug).toBeGreaterThan(0);
      expect(c.description.length, c.slug).toBeLessThan(100);
    }
  });
});
