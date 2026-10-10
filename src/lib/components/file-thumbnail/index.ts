// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
import type { ComponentProps } from 'svelte';
import type FileThumbnail from './FileThumbnail.svelte';

export { default as FileThumbnail } from './FileThumbnail.svelte';
export { default } from './FileThumbnail.svelte';
export type { ThumbnailFile } from './FileThumbnail.svelte';
export type FileThumbnailProps = ComponentProps<typeof FileThumbnail>;
export {
	clampPageNumber,
	DEFAULT_THUMBNAIL_PAGE,
	DEFAULT_THUMBNAIL_WIDTH,
	renderPdfThumbnail,
	thumbnailScale
} from './pdf-thumbnail.js';
export type { PdfThumbnailRenderOptions, PdfThumbnailRenderResult } from './pdf-thumbnail.js';
