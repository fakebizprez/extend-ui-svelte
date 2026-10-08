// MIT License — Svelte 5 port of Extend UI xlsx-viewer. Upstream: extend-hq/ui (MIT).
import type { ComponentProps } from 'svelte';
import type XlsxViewer from './XlsxViewer.svelte';

export { default as XlsxViewer } from './XlsxViewer.svelte';
export { default } from './XlsxViewer.svelte';
export type XlsxViewerProps = ComponentProps<typeof XlsxViewer>;
