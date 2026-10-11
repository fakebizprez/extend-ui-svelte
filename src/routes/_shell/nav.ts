// Sidebar grouping and prev/next navigation for the docs site.
// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).

import { PREVIEW_COMPONENTS, type PreviewComponent } from "../components";

export interface NavGroup {
  id: string;
  title: string;
  items: PreviewComponent[];
}

const bySlug = new Map(PREVIEW_COMPONENTS.map((c) => [c.slug, c]));

const group = (id: string, title: string, slugs: string[]): NavGroup => ({
  id,
  title,
  items: slugs.map((s) => bySlug.get(s)!),
});

export const NAV_GROUPS: NavGroup[] = [
  group("files", "Files", ["file-upload", "file-thumbnail", "file-system"]),
  group("viewers", "Viewers", [
    "document-viewer-sidebar",
    "pdf-viewer",
    "docx-viewer",
    "xlsx-viewer",
    "pptx-viewer",
    "csv-tsv-viewer",
  ]),
  group("editors", "Editors", [
    "pdf-editor",
    "docx-editor",
    "xlsx-editor",
    "e-signature",
  ]),
  group("data", "Data and layout", [
    "document-splits",
    "schema-builder",
    "layout-blocks",
    "bounding-box-citations",
  ]),
  group("primitives", "Primitives", ["group", "color-picker", "toggle"]),
];

export const NAV_ORDER: PreviewComponent[] = NAV_GROUPS.flatMap((g) => g.items);

export function findComponent(slug: string): PreviewComponent | null {
  return bySlug.get(slug) ?? null;
}

export function groupOf(slug: string): NavGroup | null {
  return NAV_GROUPS.find((g) => g.items.some((i) => i.slug === slug)) ?? null;
}

export function prevNext(slug: string): {
  prev: PreviewComponent | null;
  next: PreviewComponent | null;
} {
  const i = NAV_ORDER.findIndex((c) => c.slug === slug);
  if (i < 0) return { prev: null, next: null };
  return { prev: NAV_ORDER[i - 1] ?? null, next: NAV_ORDER[i + 1] ?? null };
}
