// MIT License — Svelte 5 port of Extend UI csv-viewer. Upstream: extend-hq/ui (MIT).
import type { ComponentProps } from 'svelte';
import type CsvTsvViewer from './CsvTsvViewer.svelte';

export { default as CsvTsvViewer } from './CsvTsvViewer.svelte';
export { default } from './CsvTsvViewer.svelte';
export { parseDelimitedText, type ParsedTable } from './parse.js';
export type CsvTsvViewerProps = ComponentProps<typeof CsvTsvViewer>;
