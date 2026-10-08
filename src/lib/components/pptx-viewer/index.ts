// MIT License — Svelte 5 port of Extend UI pptx-viewer. Upstream: extend-hq/ui (MIT).
import type { ComponentProps } from 'svelte';
import type PptxViewer from './PptxViewer.svelte';

export { default as PptxViewer } from './PptxViewer.svelte';
export { default } from './PptxViewer.svelte';
export { default as PptxSlide } from './PptxSlide.svelte';
export type PptxViewerProps = ComponentProps<typeof PptxViewer>;
