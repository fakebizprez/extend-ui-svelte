// MIT License — Svelte 5 port of Extend UI xlsx-viewer. Upstream: extend-hq/ui (MIT).
import type { ComponentProps } from 'svelte';
import type XlsxViewer from './XlsxViewer.svelte';

export { default as XlsxViewer } from './XlsxViewer.svelte';
/** Upstream React name. */
export { default as XlsxViewerPreview } from './XlsxViewer.svelte';
export { default } from './XlsxViewer.svelte';
/** Sheet tab strip shared by the viewer and editor (upstream WorkbookSheetTabs). */
export { default as WorkbookSheetTabs } from './WorkbookSheetTabs.svelte';
export type XlsxViewerProps = ComponentProps<typeof XlsxViewer>;
