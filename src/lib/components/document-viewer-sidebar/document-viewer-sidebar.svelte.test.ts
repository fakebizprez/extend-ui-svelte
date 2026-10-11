import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	INLINE_THUMBNAIL_SIDEBAR_MIN_WIDTH,
	useElementWidth,
	useInlineThumbnailSidebar
} from './document-viewer-sidebar.svelte.js';

describe('useInlineThumbnailSidebar', () => {
	it('goes inline at 768px and wider, like upstream', () => {
		expect(INLINE_THUMBNAIL_SIDEBAR_MIN_WIDTH).toBe(768);
		expect(useInlineThumbnailSidebar(0)).toBe(false);
		expect(useInlineThumbnailSidebar(767)).toBe(false);
		expect(useInlineThumbnailSidebar(768)).toBe(true);
		expect(useInlineThumbnailSidebar(1200)).toBe(true);
	});
});

describe('useElementWidth', () => {
	let resize: () => void = () => {};
	const disconnect = vi.fn();

	class FakeResizeObserver {
		constructor(callback: () => void) {
			resize = callback;
		}
		observe() {}
		disconnect = disconnect;
	}

	afterEach(() => {
		vi.unstubAllGlobals();
		disconnect.mockClear();
	});

	function elementWithWidth(initial: number) {
		let width = initial;
		const element = document.createElement('div');
		element.getBoundingClientRect = () => ({ width }) as DOMRect;
		return { element, setWidth: (next: number) => (width = next) };
	}

	it('starts at 0 and measures the element once attached', () => {
		vi.stubGlobal('ResizeObserver', FakeResizeObserver);
		const shell = useElementWidth();
		const { element } = elementWithWidth(900);

		expect(shell.width).toBe(0);
		shell.ref(element);
		expect(shell.width).toBe(900);
	});

	it('follows resizes and keeps the last real width while hidden', () => {
		vi.stubGlobal('ResizeObserver', FakeResizeObserver);
		const shell = useElementWidth();
		const { element, setWidth } = elementWithWidth(900);
		shell.ref(element);

		setWidth(500);
		resize();
		expect(shell.width).toBe(500);

		setWidth(0);
		resize();
		expect(shell.width).toBe(500);
	});

	it('disconnects the observer on cleanup', () => {
		vi.stubGlobal('ResizeObserver', FakeResizeObserver);
		const shell = useElementWidth();
		const cleanup = shell.ref(elementWithWidth(900).element);

		expect(typeof cleanup).toBe('function');
		(cleanup as () => void)();
		expect(disconnect).toHaveBeenCalledTimes(1);
	});
});

describe('document-viewer-sidebar docs', () => {
	it('lists every port-only export under Differences from upstream', async () => {
		const exports = Object.keys(await import('./index.js'));
		const page = (await import('../../../routes/document-viewer-sidebar/+page.svelte?raw')).default as string;
		const differences = page.slice(page.indexOf('Differences from upstream'));
		// Runtime exports of upstream components/extend/document-viewer-sidebar.tsx.
		const upstream = new Set(['useElementWidth', 'useInlineThumbnailSidebar', 'DocumentViewerThumbnailSidebar', 'DocumentViewerSidebarSkeleton']);
		const missing = exports.filter(
			(name) => !upstream.has(name) && !differences.includes(`<code>${name}</code>`)
		);
		expect(missing).toEqual([]);
	});
});
