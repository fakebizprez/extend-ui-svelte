// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
// Ported from apps/v4/components/extend/document-viewer-sidebar.tsx
// (useElementWidth, useInlineThumbnailSidebar).
import type { Attachment } from 'svelte/attachments';

export const INLINE_THUMBNAIL_SIDEBAR_MIN_WIDTH = 768;

/**
 * Port of upstream `useElementWidth`. React returns `[ref, width]`; here `ref`
 * is an attachment (`<div {@attach shell.ref}>`) and `width` is reactive.
 */
export function useElementWidth<TElement extends HTMLElement = HTMLElement>() {
	let width = $state(0);

	const ref: Attachment<TElement> = (element) => {
		const updateWidth = () => {
			const nextWidth = element.getBoundingClientRect().width;

			// Keep the last real measurement while the element is hidden or
			// detached (display:none ancestors): a zero-width pass would re-lay-out
			// the viewer for nothing and flash blank when it comes back.
			if (nextWidth === 0) return;
			width = nextWidth;
		};

		updateWidth();

		const observer = new ResizeObserver(updateWidth);
		observer.observe(element);

		return () => observer.disconnect();
	};

	return {
		ref,
		get width() {
			return width;
		}
	};
}

/** Port of upstream `useInlineThumbnailSidebar`: inline at 768px and wider. */
export function useInlineThumbnailSidebar(width: number): boolean {
	return width >= INLINE_THUMBNAIL_SIDEBAR_MIN_WIDTH;
}
